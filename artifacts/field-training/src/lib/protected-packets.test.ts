import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyWorkspace } from "./empty-workspace.js";
import { applyPacketSyncState, authoredReportSnapshot, preserveProtectedPackets } from "./protected-packets.js";
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

test("sync metadata cannot overwrite newer authored narrative, runs, or workspace settings",()=>{
  const base=createEmptyWorkspace();
  const report={id:"packet",narrative:"new narrative",runs:[{id:"run",narrative:"new run"}],
    serverVersion:0,syncStatus:"local_draft_pending"} as Report;
  const current={...base,role:"po" as const,reports:[report]};
  const stored={...base,reports:[{...report,narrative:"old narrative",runs:[],
    serverVersion:1,serverContentHash:"a".repeat(64),draftSyncPending:false}]};
  const merged=applyPacketSyncState(current,stored);
  assert.equal(merged.role,"po");
  assert.equal(merged.reports[0].narrative,"new narrative");
  assert.deepEqual(merged.reports[0].runs,report.runs);
  assert.equal(merged.reports[0].serverVersion,1);
  assert.equal(merged.reports[0].draftSyncPending,true);
  assert.equal(merged.reports[0].serverContentHash,undefined);
  assert.equal(authoredReportSnapshot(merged.reports[0]),authoredReportSnapshot(report));
});
