import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import secureRecordsRouter from "../src/routes/secureRecords.ts";
import { GovApiIntegrationError, fetchGovSecureRecords } from "../src/services/govApiIntegration.ts";
import { normalizeSecureRecords } from "../src/lib/secure-records.ts";

const realApiConfig = {
  REAL_API_URL: "https://records.example.gov/api/v1/secure-records",
  REAL_API_KEY: "server-only-test-key",
};

async function withApiServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use("/api", secureRecordsRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a port.");
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("mock mode returns clearly labeled synthetic records and a request ID", async () => {
  const previousFlag = process.env.USE_REAL_API;
  const previousAuditKey = process.env.AUDIT_ID_HMAC_KEY;
  process.env.USE_REAL_API = "false";
  process.env.AUDIT_ID_HMAC_KEY = "test-only-audit-hmac-key-with-at-least-32-bytes";
  try {
    await withApiServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/secure-records`);
      const payload = await response.json() as {
        status: string;
        metadata: { total_records: number };
        data: Array<{ id: string; status: string; updated_at: string }>;
      };
      assert.equal(response.status, 200);
      assert.equal(payload.status, "success");
      assert.equal(payload.metadata.total_records, 3);
      assert.equal(payload.data.length, 3);
      assert.ok(payload.data.every((record) => record.id.startsWith("MOCK-")));
      assert.ok(payload.data.every((record) => /^\d{4}-\d{2}-\d{2}$/.test(record.updated_at)));
    });
  } finally {
    if (previousFlag === undefined) delete process.env.USE_REAL_API;
    else process.env.USE_REAL_API = previousFlag;
    if (previousAuditKey === undefined) delete process.env.AUDIT_ID_HMAC_KEY;
    else process.env.AUDIT_ID_HMAC_KEY = previousAuditKey;
  }
});

test("real mode never calls upstream without a verified signed-in user", async () => {
  const previousFlag = process.env.USE_REAL_API;
  const previousAuditKey = process.env.AUDIT_ID_HMAC_KEY;
  process.env.USE_REAL_API = "true";
  process.env.AUDIT_ID_HMAC_KEY = "test-only-audit-hmac-key-with-at-least-32-bytes";
  try {
    await withApiServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/secure-records`, {
        headers: { Authorization: "Bearer client-input-is-not-identity" },
      });
      const payload = await response.json() as { status: string; error_code: string };
      assert.equal(response.status, 401);
      assert.equal(payload.status, "error");
      assert.equal(payload.error_code, "AUTHENTICATION_REQUIRED");
    });
  } finally {
    if (previousFlag === undefined) delete process.env.USE_REAL_API;
    else process.env.USE_REAL_API = previousFlag;
    if (previousAuditKey === undefined) delete process.env.AUDIT_ID_HMAC_KEY;
    else process.env.AUDIT_ID_HMAC_KEY = previousAuditKey;
  }
});

test("mock mode fails closed when keyed audit logging is not configured", async () => {
  const previousFlag = process.env.USE_REAL_API;
  const previousAuditKey = process.env.AUDIT_ID_HMAC_KEY;
  process.env.USE_REAL_API = "false";
  delete process.env.AUDIT_ID_HMAC_KEY;
  try {
    await withApiServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/secure-records`);
      const payload = await response.json() as { status: string; error_code: string; message: string };
      assert.equal(response.status, 503);
      assert.equal(payload.status, "error");
      assert.equal(payload.error_code, "AUDIT_NOT_CONFIGURED");
      assert.equal(payload.message, "Secure records access logging is unavailable.");
    });
  } finally {
    if (previousFlag === undefined) delete process.env.USE_REAL_API;
    else process.env.USE_REAL_API = previousFlag;
    if (previousAuditKey === undefined) delete process.env.AUDIT_ID_HMAC_KEY;
    else process.env.AUDIT_ID_HMAC_KEY = previousAuditKey;
  }
});

test("live integration uses only the server-side REAL_API_KEY credential", async () => {
  let capturedAuthorization: string | undefined;
  const records = await fetchGovSecureRecords(
    realApiConfig,
    async (url, init) => {
      assert.equal(url.href, realApiConfig.REAL_API_URL);
      assert.equal(init.redirect, "error");
      capturedAuthorization = new Headers(init.headers).get("authorization") ?? undefined;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "19" }),
        text: async () => '[{"recordId":"R-1"}]',
      };
    },
  );
  assert.equal(capturedAuthorization, "Bearer server-only-test-key");
  assert.deepEqual(records, [{ recordId: "R-1" }]);
});

test("live integration rejects unconfigured or unsafe endpoints before network access", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    throw new Error("must not be called");
  };
  await assert.rejects(
    fetchGovSecureRecords(
      { REAL_API_URL: realApiConfig.REAL_API_URL },
      fetchImpl,
    ),
    (error: unknown) => error instanceof GovApiIntegrationError && error.code === "REAL_API_NOT_CONFIGURED",
  );
  await assert.rejects(
    fetchGovSecureRecords(
      { ...realApiConfig, REAL_API_URL: "http://records.example.gov/api/v1/secure-records" },
      fetchImpl,
    ),
    (error: unknown) => error instanceof GovApiIntegrationError && error.code === "REAL_API_NOT_CONFIGURED",
  );
  assert.equal(called, false);
});

test("live integration returns a stable error for upstream failures", async () => {
  await assert.rejects(
    fetchGovSecureRecords(
      realApiConfig,
      async () => ({
        ok: false,
        status: 503,
        headers: new Headers(),
        text: async () => "upstream details must not be returned",
      }),
    ),
    (error: unknown) => error instanceof GovApiIntegrationError && error.code === "REAL_API_UPSTREAM_ERROR",
  );
});

test("live integration maps network timeouts to a stable timeout error", async () => {
  await assert.rejects(
    fetchGovSecureRecords(
      realApiConfig,
      async (_url, init) => await new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
      1,
    ),
    (error: unknown) => error instanceof GovApiIntegrationError && error.code === "REAL_API_TIMEOUT",
  );
});

test("normalization emits the shared success envelope and rejects incomplete records", () => {
  const response = normalizeSecureRecords([
    { id: "R-1", status: "Pending", updated_at: "2026-11-20" },
  ]);
  assert.equal(response.status, "success");
  assert.deepEqual(response.metadata, { total_records: 1 });
  assert.deepEqual(response.data, [
    { id: "R-1", status: "Pending", updated_at: "2026-11-20" },
  ]);
  assert.throws(() => normalizeSecureRecords([{ id: "R-2" }]));
});
