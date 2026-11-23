import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyWorkspace } from "./empty-workspace.js";
import { preserveProtectedPackets } from "./protected-packets.js";
import type { Report } from "./model.js";

test("state-wide reconciliation cannot normalize or remove an uncertain packet", () => {
  const base = createEmptyWorkspace();
  const pending = { id: "pending", syncAttemptPending: true, narrative: "original" } as Report;
  const sealed = { id: "sealed", syncStatus: "synchronized_complete" } as Report;
  const previous = { ...base, reports: [pending, sealed] };
  const changed = { ...base, reports: [{ ...pending, narrative: "changed", legacyActivity: {} }] };
  const next = preserveProtectedPackets(previous, changed);
  assert.equal(next.reports[0], pending);
  assert.equal(next.reports[1], sealed);
});
