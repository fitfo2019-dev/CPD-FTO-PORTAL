import assert from "node:assert/strict";
import test from "node:test";
import { agencyPacketsEnvelope, createPacketReviewCommand, packetCommandSatisfied,
  packetReviewError, type AgencyPacket } from "./agency-packets.js";

const hash = "a".repeat(64);
const packet = (overrides: Partial<AgencyPacket> = {}): AgencyPacket => ({
  id: "packet-1", assignment_id: "11111111-1111-4111-8111-111111111111",
  record_date: "2026-11-23", phase: 1, server_version: 1, sync_status: "submitted_complete",
  handoff_status: "awaiting_coordinator_receipt", po_totals: null,
  report: {
    id: "packet-1", date: "2026-11-23", phase: 1, className: "Class A",
    recruitName: "Synthetic PO", recruitBadge: "20", ftoName: "Synthetic FTO", ftoBadge: "30",
    runs: [], status: "recruit_signed", activity: {}, reportingForDuty: {}, ratings: {},
    narrative: "Source record", remedial: "", recruitComments: "",
    signatures: { recruit: { signed: true } }, extraSourceField: { notes: "Preserved verbatim" },
  },
  content_hash: hash, released_to_po: false, released_at: null, withdrawn_at: null,
  withdrawal_reason: null, amendment_of: null, amendment_reason: null, acknowledgment: null,
  ...overrides,
});

test("packet envelope preserves complete unverified report properties and parses server-owned timestamps", () => {
  const result = agencyPacketsEnvelope.parse({
    status: "success", metadata: { total_records: 1, role: "FTO_COORDINATOR" },
    data: [{ ...packet(), released_at: "2026-11-23T12:00:00Z" }],
  });
  assert.ok(result.data[0].report);
  assert.deepEqual(result.data[0].report.signatures, { recruit: { signed: true } });
  assert.deepEqual(result.data[0].report.extraSourceField, { notes: "Preserved verbatim" });
  assert.ok(result.data[0].released_at instanceof Date);
});

test("packet envelope accepts a PO-owned released summary without a full report", () => {
  const result = agencyPacketsEnvelope.parse({
    status: "success", metadata: { total_records: 1, role: "PO" },
    data: [{ ...packet({
      handoff_status: "awaiting_po_acknowledgment",
      released_to_po: true,
      released_at: new Date("2026-11-23T12:00:00Z"),
      report: null,
    }) }],
  });
  assert.equal(result.data[0].report, null);
  assert.equal(result.data[0].po_totals, null);
});

test("each action binds one operation UUID to exact server hash and validated confirmation fields", () => {
  const source = packet();
  const release = createPacketReviewCommand(source, { action: "release" });
  assert.match(release.input.operation_id, /^[0-9a-f-]{36}$/i);
  assert.equal(release.input.content_hash, hash);
  assert.equal(release.input.review_confirmed, true);
  assert.equal(release.action, "release");

  const acknowledgment = createPacketReviewCommand(source, { action: "acknowledge", comments: "Reviewed." });
  assert.notEqual(acknowledgment.input.operation_id, release.input.operation_id);
  assert.equal(acknowledgment.input.content_hash, hash);
  assert.equal(acknowledgment.input.review_confirmed, true);
  assert.equal(acknowledgment.input.comments, "Reviewed.");

  const withdrawal = createPacketReviewCommand(source, { action: "withdraw", reason: "Correct the narrative." });
  assert.equal(withdrawal.input.reason, "Correct the narrative.");
  assert.equal(withdrawal.input.review_confirmed, undefined);
});

test("uncertain-action reconciliation relies only on server workflow state", () => {
  const source = packet();
  const release = createPacketReviewCommand(source, { action: "release" });
  assert.equal(packetCommandSatisfied(release, source), false);
  assert.equal(packetCommandSatisfied(release, packet({
    released_to_po: true, released_at: new Date(), report: { ...source.report!, status: "draft", signatures: {} },
  })), true);

  const acknowledgment = createPacketReviewCommand(source, { action: "acknowledge", comments: "Reviewed." });
  const acknowledged = packet({
    released_to_po: true, released_at: new Date(),
    acknowledgment: { acknowledged_at: new Date(), content_hash: hash, comments: "Reviewed." },
  });
  assert.equal(packetCommandSatisfied(acknowledgment, acknowledged), true);
  assert.equal(packetCommandSatisfied(acknowledgment, packet({
    released_to_po: true,
    acknowledgment: { acknowledged_at: new Date(), content_hash: "b".repeat(64), comments: "Reviewed." },
  })), false);

  const withdrawal = createPacketReviewCommand(source, { action: "withdraw", reason: "Correct the narrative." });
  assert.equal(packetCommandSatisfied(withdrawal, packet({
    withdrawn_at: new Date(), withdrawal_reason: "Different reason",
  })), false);
  assert.equal(packetCommandSatisfied(withdrawal, packet({
    withdrawn_at: new Date(), withdrawal_reason: "Correct the narrative.",
  })), true);
});

test("API failures receive plain, role-neutral corrective messages", () => {
  assert.match(packetReviewError({ status: 401 }), /Sign in again/);
  assert.match(packetReviewError({ status: 403 }), /verified agency account/);
  assert.match(packetReviewError({ status: 404 }), /no longer available/);
  assert.match(packetReviewError({ status: 409 }), /Refresh and review/);
  assert.match(packetReviewError({ status: 503 }), /do not assume it failed/);
});
