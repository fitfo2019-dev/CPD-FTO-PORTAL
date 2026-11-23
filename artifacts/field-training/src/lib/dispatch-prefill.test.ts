import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDispatchPrefill, applyDispatchPrefillValue, mapDispatchPrefillResponse, mapDispatchIncidentResponse, selectDispatchIncidentMatch } from "./dispatch-prefill.js";

test('incident lookup matches the entered unit without borrowing another PO’s timings',()=>{
  const rows=[
    {incidentNumber:'TEST-INCIDENT',unitNumber:'UNIT-A',dispatchedAt:'2026-11-23T14:00:00Z'},
    {incidentNumber:'TEST-INCIDENT',unitNumber:'UNIT-B',dispatchedAt:'2026-11-23T14:05:00Z'},
  ];
  const selected=selectDispatchIncidentMatch(rows,'test-incident',' unit-b ');
  assert.equal(selected.status,'matched');
  if(selected.status==='matched')assert.equal(selected.match.dispatchedAt,rows[1].dispatchedAt);
  assert.equal(selectDispatchIncidentMatch(rows,'TEST-INCIDENT','UNKNOWN').status,'empty');
  assert.equal(selectDispatchIncidentMatch(rows,'TEST-INCIDENT','').status,'empty');
  assert.equal(selectDispatchIncidentMatch([...rows,rows[1]],'TEST-INCIDENT','UNIT-B').status,'ambiguous');
  assert.equal(selectDispatchIncidentMatch(rows,'OTHER-INCIDENT','UNIT-B').status,'empty');
  assert.equal(selectDispatchIncidentMatch(rows,'TEST-INCIDENT','UNIT-B').status,'matched','One PO looking up the incident does not consume it for other POs');
});
test('incident parser is defensive, preserves ambiguity and excludes clocks without a unit',()=>{
  const envelope=(data:unknown[])=>({status:'success',metadata:{total_records:data.length},data});
  assert.deepEqual(mapDispatchIncidentResponse(envelope([])),[]);
  assert.equal(mapDispatchIncidentResponse(null),undefined);
  assert.equal(mapDispatchIncidentResponse({status:'success',metadata:{total_records:2},data:[]}),undefined);
  assert.equal(mapDispatchIncidentResponse(envelope([null])),undefined);
  assert.equal(mapDispatchIncidentResponse(envelope([{incidentNumber:'TEST',dispatchedAt:'bad'}])),undefined);
  const rows=mapDispatchIncidentResponse(envelope([{incidentNumber:'TEST',dispatchedCode:'17',runKind:'unknown',dispatchedAt:'2026-11-23T14:00:00Z'}]));
  assert.equal(rows?.[0].runKind,undefined);
  assert.equal(rows?.[0].dispatchedAt,undefined);
  assert.equal(selectDispatchIncidentMatch(rows??[],'TEST','UNIT-A').status,'matched');
});

test("maps a successful dispatch response while allowing absent fields", () => {
  assert.deepEqual(mapDispatchPrefillResponse({
    status: "success",
    metadata: { total_records: 1 },
    data: [{
      eventIngressAt: "2026-11-23T19:05:00.000Z",
      incidentNumber: "INC-2468",
      dispatchedCode: "17a",
    }],
  }), {
    eventIngressAt: "2026-11-23T19:05:00.000Z",
    incidentNumber: "INC-2468",
    dispatchedCode: "17A",
  });
  assert.deepEqual(mapDispatchPrefillResponse({
    status: "success",
    metadata: { total_records: 0 },
    data: [],
  }), {});
  assert.equal(mapDispatchPrefillResponse({ status: "error" }), undefined);
  assert.equal(mapDispatchPrefillResponse({
    status: "success",
    metadata: { total_records: 1 },
    data: [],
  }), undefined);
});

test("dispatch defaults fill untouched fields but preserve FTO corrections", () => {
  const initial = {
    runDateTimeText: "11/23/2026",
    runTimeText: "",
    incidentNumber: "",
    runLocation: "",
    dispatchedCode: "",
  };
  assert.deepEqual(applyDispatchPrefill(
    { ...initial, incidentNumber: "FTO-entered-number", runLocation: "FTO-entered location" },
    initial,
    {
      incidentNumber: "INC-2468",
      location: "100 Main Street",
      dispatchedCode: "17A",
    },
  ), {
    ...initial,
    incidentNumber: "FTO-entered-number",
    runLocation: "FTO-entered location",
    dispatchedCode: "17A",
  });
});

test("dispatch ingress time is a default only until the FTO changes it", () => {
  assert.equal(applyDispatchPrefillValue("11/23/2026", "11/23/2026", "11/22/2026 14:05"), "11/22/2026 14:05");
  assert.equal(applyDispatchPrefillValue("11/23/2026 13:55", "11/23/2026", "11/22/2026 14:05"), "11/23/2026 13:55");
});
