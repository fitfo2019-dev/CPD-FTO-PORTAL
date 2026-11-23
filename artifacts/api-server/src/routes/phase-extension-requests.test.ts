import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import express from "express";
import test from "node:test";
import type { PhaseExtensionRequestInput } from "@workspace/api-zod";
import type {
  PhaseExtensionRequestStore,
  SharedPhaseExtensionRequest,
} from "../lib/phase-extension-store.js";
import {
  createPhaseExtensionRequestsRouter,
  getPhaseExtensionRoleFromPublicMetadata,
} from "./phase-extension-requests.js";

const input: PhaseExtensionRequestInput = {
  id: "extension-request-1",
  className: "Training Class",
  recruitName: "Example Officer",
  recruitBadge: "4747",
  phase: 1,
  phaseStartDate: "2027-01-03",
  requestingFtoName: "Example FTO",
  requestingFtoBadge: "1222",
  extensionType: "training_weeks",
  requestedWeeks: 1,
  justification: "Additional coaching is needed.",
};

function createMemoryStore() {
  const records = new Map<string, SharedPhaseExtensionRequest>();
  const owners = new Map<string, string>();
  const store: PhaseExtensionRequestStore = {
    async listForFto(userId) {
      return [...records.values()].filter(item => owners.get(item.id) === userId);
    },
    async listPending() {
      return [...records.values()].filter(item => item.status === "pending");
    },
    async create(userId, request) {
      const existing = records.get(request.id);
      if (existing) {
        if (owners.get(request.id) !== userId) throw new Error("PHASE_EXTENSION_ID_CONFLICT");
        return { request: existing, created: false };
      }
      const saved: SharedPhaseExtensionRequest = {
        ...request,
        status: "pending",
        createdAt: "2027-02-01T12:00:00.000Z",
        reviewedAt: null,
      };
      records.set(saved.id, saved);
      owners.set(saved.id, userId);
      return { request: saved, created: true };
    },
    async review(id, _reviewerUserId, decision) {
      const current = records.get(id);
      if (!current) return { request: null, alreadyResolved: false };
      if (current.status !== "pending") return { request: current, alreadyResolved: true };
      const updated = {
        ...current,
        status: decision === "approve" ? "approved" as const : "denied" as const,
        reviewedAt: "2027-02-02T12:00:00.000Z",
      };
      records.set(id, updated);
      return { request: updated, alreadyResolved: false };
    },
  };
  return store;
}

async function withApi(
  role: "FTO" | "FTO_COORDINATOR" | null,
  store: PhaseExtensionRequestStore,
  run: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use(createPhaseExtensionRequestsRouter({
    resolveCaller: async () => role
      ? { caller: { userId: role === "FTO" ? "verified-fto" : "verified-coordinator", role } }
      : { error: { status: 401, code: "AUTHENTICATION_REQUIRED", message: "Sign in." } },
    getStore: () => store,
  }));
  const server: Server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server failed to start.");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("FTO submits a shared request and a separate Coordinator session reviews it", async () => {
  const store = createMemoryStore();
  await withApi("FTO", store, async baseUrl => {
    const submitted = await fetch(`${baseUrl}/v1/phase-extension-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(submitted.status, 201);
    const payload = await submitted.json() as { data: SharedPhaseExtensionRequest[] };
    assert.equal(payload.data[0].status, "pending");
  });

  await withApi("FTO_COORDINATOR", store, async baseUrl => {
    const list = await fetch(`${baseUrl}/v1/phase-extension-requests`);
    const payload = await list.json() as { data: SharedPhaseExtensionRequest[] };
    assert.equal(payload.data.length, 1);
    const reviewed = await fetch(`${baseUrl}/v1/phase-extension-requests/${input.id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    assert.equal(reviewed.status, 200);
  });

  await withApi("FTO", store, async baseUrl => {
    const list = await fetch(`${baseUrl}/v1/phase-extension-requests`);
    const payload = await list.json() as { data: SharedPhaseExtensionRequest[] };
    assert.equal(payload.data[0].status, "approved");
  });
});

test("client role preview data cannot authorize Coordinator review", async () => {
  const store = createMemoryStore();
  await withApi("FTO", store, async baseUrl => {
    const submitted = await fetch(`${baseUrl}/v1/phase-extension-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(submitted.status, 201);
  });
  await withApi("FTO", store, async baseUrl => {
    const denied = await fetch(`${baseUrl}/v1/phase-extension-requests/${input.id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve", role: "FTO_COORDINATOR" }),
    });
    assert.equal(denied.status, 403);
  });
});

test("unauthenticated clients cannot list shared requests", async () => {
  await withApi(null, createMemoryStore(), async baseUrl => {
    const response = await fetch(`${baseUrl}/v1/phase-extension-requests`);
    assert.equal(response.status, 401);
  });
});

test("only server-managed FieldReady role metadata grants request access", () => {
  assert.equal(getPhaseExtensionRoleFromPublicMetadata({ fieldreadyRole: "FTO" }), "FTO");
  assert.equal(getPhaseExtensionRoleFromPublicMetadata({ fieldreadyRole: "FTO_COORDINATOR" }), "FTO_COORDINATOR");
  assert.equal(getPhaseExtensionRoleFromPublicMetadata({ fieldreadyRole: "FTO_COORDINATOR", role: "FTO" }), "FTO_COORDINATOR");
  assert.equal(getPhaseExtensionRoleFromPublicMetadata({ fieldreadyRole: "FTO", clientPreview: "FTO_COORDINATOR" }), "FTO");
  assert.equal(getPhaseExtensionRoleFromPublicMetadata({ fieldreadyRole: "fto_coordinator" }), null);
  assert.equal(getPhaseExtensionRoleFromPublicMetadata(null), null);
});
