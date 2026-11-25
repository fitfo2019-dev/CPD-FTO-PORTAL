import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { OperationalIdentitySnapshot, parseOperationalIdentity } from "@workspace/api-zod/operational-profile";
import { createUiPreviewWorkspace } from "./empty-workspace.js";
import { createDailyReportDraft } from "./daily-report-draft.js";
import { OfflineStorage } from "./offlineStorage.js";
import { mapDispatchIncidentResponse, mapDispatchPrefillResponse, selectDispatchIncidentMatch } from "./dispatch-prefill.js";

test("vault reopening retains unsided, sided, and historical identities without reinterpretation",async()=>{
  const folder=createUiPreviewWorkspace().caseFolder!;
  const historical={assignmentToken:"9150E-1",cruiserNumber:"9150",cadUnit:"9150E",company:"E",side:"1"} as const;
  assert.deepEqual(OperationalIdentitySnapshot.parse(historical),historical);
  const reports=["9150E","9150E-1","9150E-2"].map((token,index)=>{
    const report=createDailyReportDraft({...folder,ftoAssignment:"80C"},"2026-11-24",undefined,parseOperationalIdentity(token));
    report.reportingForDuty.cruiserId=`MANUAL-${index}`;
    return report;
  });
  reports.push({...structuredClone(reports[0]),id:"HISTORICAL",operationalIdentity:historical});
  reports.push({...structuredClone(reports[0]),id:"FORMER-FULL-CAD",operationalIdentity:{
    assignmentToken:"9150E-2",districtToken:"9150",cadUnit:"9150E-2",company:"E",side:"2",
  }});
  const original=structuredClone(reports);
  const namespace=`optional-side-${crypto.randomUUID()}`;
  const vault=new OfflineStorage(namespace);
  const pass=new TextEncoder().encode("fictional-test-passphrase");
  await vault.unlock(pass); await vault.save("workspace",{reports}); vault.lock();
  const reopened=new OfflineStorage(namespace);
  await reopened.unlock(pass);
  try{
    const saved=await reopened.get<{reports:typeof reports}>("workspace");
    assert.deepEqual(saved?.reports,original);
    assert.equal("side" in saved!.reports[0].operationalIdentity!,false);
    const next=createDailyReportDraft(folder,"2026-11-25",saved!.reports[1],parseOperationalIdentity("1234A"));
    assert.equal(next.reportingForDuty.cruiserId,"MANUAL-1");
    assert.equal(next.operationalIdentity?.districtToken,"1234");
    assert.equal(next.ftoAssignment,folder.ftoAssignment);
    assert.equal(next.shift,folder.shift);
    assert.equal(next.cruiserDistrict,folder.cruiserDistrict);
    assert.deepEqual(saved?.reports,original);
  }finally{reopened.lock();}
});

test("dispatch identities are optional, exact and validated separately from incident geography",()=>{
  const envelope=(data:unknown[])=>({status:"success",metadata:{total_records:data.length},data});
  const rows=["9150E","9151E","9152E"].map(unitNumber=>({
    incidentNumber:"TEST",unitNumber,cadIdentity:parseOperationalIdentity(unitNumber),
    cruiserDistrict:"INCIDENT-DISTRICT",dispatchedAt:"2026-11-24T14:00:00Z",
  }));
  const parsed=mapDispatchIncidentResponse(envelope(rows))!;
  for(const unit of ["9150E","9151E","9152E"]) {
    const result=selectDispatchIncidentMatch(parsed,"TEST",unit);
    assert.equal(result.status,"matched");
    if(result.status==="matched") {
      assert.equal(result.match.cadIdentity?.cadUnit,unit);
      assert.equal(result.match.cruiserDistrict,"INCIDENT-DISTRICT");
    }
    assert.equal(selectDispatchIncidentMatch([...parsed,parsed.find(row=>row.unitNumber===unit)!],"TEST",unit).status,"ambiguous");
  }
  assert.equal(mapDispatchIncidentResponse(envelope([{...rows[0],cadIdentity:rows[1].cadIdentity}])),undefined);
  assert.equal(parseOperationalIdentity("9150E-1").cadUnit,parseOperationalIdentity("9150E-2").cadUnit,
    "Internal division sides are not CAD unit distinctions");
  for(const cadIdentity of [{...rows[0].cadIdentity,districtToken:"OTHER"},
    {...rows[0].cadIdentity,side:"1"}, {...rows[0].cadIdentity,company:"D"}, null]) {
    assert.equal(mapDispatchPrefillResponse(envelope([{incidentNumber:"TEST",cadIdentity}])),undefined);
  }
  assert.deepEqual(mapDispatchPrefillResponse(envelope([{incidentNumber:"TEST"}])),{incidentNumber:"TEST"});
});
