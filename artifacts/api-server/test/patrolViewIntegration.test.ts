import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchPatrolViewEvent,
  mapPatrolViewEvent,
  PatrolViewIntegrationError,
  type PatrolViewConfig,
} from "../src/services/patrolViewIntegration.ts";

const config: PatrolViewConfig = {
  PATROLVIEW_EVENT_LOOKUP_URL: "https://dispatch.agency.example/v1/events/{eventId}",
  PATROLVIEW_API_TOKEN: "server-only-test-token",
};

function response(body: string, options: { ok?: boolean; status?: number; headers?: Headers } = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: options.headers ?? new Headers({ "content-length": String(Buffer.byteLength(body)) }),
    text: async () => body,
  };
}

test("maps approved event ingress and incident fields from adapter snake_case payloads", () => {
  assert.deepEqual(mapPatrolViewEvent({
    data: {
      event_ingress_time: "2026-11-23T14:05:00-05:00",
      incident_number: "INC-2468",
      location_text: "100 Main Street",
      ten_code: "10-17a",
    },
  }), {
    eventIngressAt: "2026-11-23T19:05:00.000Z",
    incidentNumber: "INC-2468",
    location: "100 Main Street",
    dispatchedCode: "17A",
  });
});

test("missing approved incident fields map to an empty editable prefill", () => {
  assert.deepEqual(mapPatrolViewEvent({ data: {} }), {});
  assert.deepEqual(mapPatrolViewEvent({}), {});
});

test("upstream corrections are reflected in each new lookup response", async () => {
  const corrected = await fetchPatrolViewEvent("EVT-1", config, async () =>
    response(JSON.stringify({ event: { eventIngressAt: "2026-11-23T12:05:00Z", incidentNumber: "INC-CORRECTED" } })),
  );
  assert.deepEqual(corrected, {
    eventIngressAt: "2026-11-23T12:05:00.000Z",
    incidentNumber: "INC-CORRECTED",
  });
});

test("only the server-side token is sent upstream and redirects are disabled", async () => {
  let authorization: string | null = null;
  let target: URL | undefined;
  await fetchPatrolViewEvent("EVT-2", config, async (url, init) => {
    target = url;
    authorization = new Headers(init.headers).get("authorization");
    assert.equal(init.redirect, "error");
    return response(JSON.stringify({ eventIngressAt: "2026-11-23T12:00:00Z" }));
  });
  assert.equal(target?.href, "https://dispatch.agency.example/v1/events/EVT-2");
  assert.equal(authorization, "Bearer server-only-test-token");
});

test("missing adapter configuration and unsafe endpoints fail before network access", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    throw new Error("must not be called");
  };
  await assert.rejects(
    fetchPatrolViewEvent("EVT-1", {}, fetchImpl),
    (error: unknown) => error instanceof PatrolViewIntegrationError && error.code === "PATROLVIEW_NOT_CONFIGURED",
  );
  await assert.rejects(
    fetchPatrolViewEvent("EVT-1", {
      ...config,
      PATROLVIEW_EVENT_LOOKUP_URL: "http://dispatch.agency.example/v1/events/{eventId}",
    }, fetchImpl),
    (error: unknown) => error instanceof PatrolViewIntegrationError && error.code === "PATROLVIEW_NOT_CONFIGURED",
  );
  assert.equal(called, false);
});

test("feed failure becomes a stable unavailable error without upstream details", async () => {
  await assert.rejects(
    fetchPatrolViewEvent("EVT-1", config, async () => {
      throw new Error("private upstream response details");
    }),
    (error: unknown) => error instanceof PatrolViewIntegrationError
      && error.code === "PATROLVIEW_UNAVAILABLE"
      && !error.message.includes("private upstream"),
  );
});

test("invalid mapped fields and oversized feed responses are rejected", async () => {
  assert.throws(
    () => mapPatrolViewEvent({ eventIngressAt: "not-a-timestamp" }),
    (error: unknown) => error instanceof PatrolViewIntegrationError && error.code === "PATROLVIEW_INVALID_RESPONSE",
  );
  await assert.rejects(
    fetchPatrolViewEvent("EVT-1", config, async () =>
      response("{}", { headers: new Headers({ "content-length": "999999" }) }),
    ),
    (error: unknown) => error instanceof PatrolViewIntegrationError && error.code === "PATROLVIEW_INVALID_RESPONSE",
  );
});
