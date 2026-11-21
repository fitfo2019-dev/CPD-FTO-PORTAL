import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import secureRecordsRouter from "../src/routes/secureRecords.ts";
import { GovApiIntegrationError, fetchGovSecureRecords } from "../src/services/govApiIntegration.ts";

const govConfig = {
  GOV_API_SECURE_RECORDS_URL: "https://records.example.gov/api/v1/secure-records",
  GOV_API_ALLOWED_HOSTS: "records.example.gov",
  GOV_API_AUDIENCE: "approved-records-api",
  GOV_API_AUTHORIZED_PARTIES: "https://portal.example.gov",
  CLERK_SECRET_KEY: "test-only-clerk-secret",
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
        mode: string;
        requestId: string;
        warning: string;
        records: Array<{ recordId: string }>;
      };
      assert.equal(response.status, 200);
      assert.equal(payload.status, "ok");
      assert.equal(payload.mode, "mock");
      assert.match(payload.requestId, /^[0-9a-f-]{36}$/i);
      assert.match(payload.warning, /synthetic/i);
      assert.equal(payload.records.length, 3);
      assert.ok(payload.records.every((record) => record.recordId.startsWith("MOCK-")));
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
      const payload = await response.json() as { status: string; error: { code: string } };
      assert.equal(response.status, 401);
      assert.equal(payload.status, "error");
      assert.equal(payload.error.code, "AUTHENTICATION_REQUIRED");
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
      const payload = await response.json() as { status: string; error: { code: string; requestId: string } };
      assert.equal(response.status, 503);
      assert.equal(payload.status, "error");
      assert.equal(payload.error.code, "AUDIT_NOT_CONFIGURED");
      assert.match(payload.error.requestId, /^[0-9a-f-]{36}$/i);
    });
  } finally {
    if (previousFlag === undefined) delete process.env.USE_REAL_API;
    else process.env.USE_REAL_API = previousFlag;
    if (previousAuditKey === undefined) delete process.env.AUDIT_ID_HMAC_KEY;
    else process.env.AUDIT_ID_HMAC_KEY = previousAuditKey;
  }
});

test("live integration forwards only an audience-approved bearer to the allowlisted HTTPS API", async () => {
  let capturedAuthorization: string | undefined;
  let verifiedTokenOptions: unknown;
  const records = await fetchGovSecureRecords(
    {
      authorizationHeader: "Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJzYW1wbGUifQ.signature",
      authenticatedUserId: "user-1",
    },
    govConfig,
    async (url, init) => {
      assert.equal(url.href, govConfig.GOV_API_SECURE_RECORDS_URL);
      assert.equal(init.redirect, "error");
      capturedAuthorization = new Headers(init.headers).get("authorization") ?? undefined;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "19" }),
        text: async () => '[{"recordId":"R-1"}]',
      };
    },
    async (_token, options) => {
      verifiedTokenOptions = options;
      return { sub: "user-1" };
    },
  );
  assert.equal(capturedAuthorization, "Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJzYW1wbGUifQ.signature");
  assert.deepEqual(verifiedTokenOptions, {
    secretKey: "test-only-clerk-secret",
    audience: "approved-records-api",
    authorizedParties: ["https://portal.example.gov"],
  });
  assert.deepEqual(records, [{ recordId: "R-1" }]);
});

test("live integration rejects invalid tokens and unapproved hosts before network access", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    throw new Error("must not be called");
  };
  await assert.rejects(
    fetchGovSecureRecords(
      { authorizationHeader: "Bearer token", authenticatedUserId: "user-1" },
      govConfig,
      fetchImpl,
      async () => { throw new Error("token audience or signature is invalid"); },
    ),
    (error: unknown) => error instanceof GovApiIntegrationError && error.code === "GOV_API_BEARER_INVALID",
  );
  await assert.rejects(
    fetchGovSecureRecords(
      { authorizationHeader: "Bearer token", authenticatedUserId: "user-1" },
      { ...govConfig, GOV_API_ALLOWED_HOSTS: "other.example.gov" },
      fetchImpl,
    ),
    (error: unknown) => error instanceof GovApiIntegrationError && error.code === "GOV_API_NOT_CONFIGURED",
  );
  assert.equal(called, false);
});

test("live integration returns a stable error for upstream failures", async () => {
  await assert.rejects(
    fetchGovSecureRecords(
      { authorizationHeader: "Bearer token", authenticatedUserId: "user-1" },
      govConfig,
      async () => ({
        ok: false,
        status: 503,
        headers: new Headers(),
        text: async () => "upstream details must not be returned",
      }),
      async () => ({ sub: "user-1" }),
    ),
    (error: unknown) => error instanceof GovApiIntegrationError && error.code === "GOV_API_UPSTREAM_ERROR",
  );
});

test("live integration maps network timeouts to a stable timeout error", async () => {
  await assert.rejects(
    fetchGovSecureRecords(
      { authorizationHeader: "Bearer token", authenticatedUserId: "user-1" },
      govConfig,
      async (_url, init) => await new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
      async () => ({ sub: "user-1" }),
      1,
    ),
    (error: unknown) => error instanceof GovApiIntegrationError && error.code === "GOV_API_TIMEOUT",
  );
});
