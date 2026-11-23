import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDispatchPrefill, applyDispatchPrefillValue, mapDispatchPrefillResponse, mapDispatchIncidentResponse, selectDispatchIncidentMatch, type DispatchPrefillDraft } from "./dispatch-prefill.js";

test('incident lookup matches the entered unit without borrowing another PO’s timings',()=>{
  const rows=[
    {incidentNumber:'TEST-INCIDENT',unitNumber:'UNIT-A',dispatchedAt:'2026-11-23T14:00:00Z',locationCity:'Shared City',zone:'Shared Zone'},
    {incidentNumber:'TEST-INCIDENT',unitNumber:'UNIT-B',dispatchedAt:'2026-11-23T14:05:00Z',locationCity:'Shared City',zone:'Shared Zone'},
  ];
  const selected=selectDispatchIncidentMatch(rows,'test-incident',' unit-b ');
  assert.equal(selected.status,'matched');
   if(selected.status==='matched') {
     assert.equal(selected.match.dispatchedAt,rows[1].dispatchedAt);
     assert.equal(selected.match.locationCity,'Shared City');
     assert.equal(selected.match.zone,'Shared Zone');
   }
  assert.equal(selectDispatchIncidentMatch(rows,'TEST-INCIDENT','UNKNOWN').status,'empty');
  assert.equal(selectDispatchIncidentMatch(rows,'TEST-INCIDENT','').status,'empty');
  assert.equal(selectDispatchIncidentMatch([...rows,rows[1]],'TEST-INCIDENT','UNIT-B').status,'ambiguous');
  assert.equal(selectDispatchIncidentMatch(rows,'OTHER-INCIDENT','UNIT-B').status,'empty');
  assert.equal(selectDispatchIncidentMatch(rows,'TEST-INCIDENT','UNIT-B').status,'matched','One PO looking up the incident does not consume it for other POs');
});
test('incident parser is defensive, preserves shared metrics and excludes clocks without a unit',()=>{
  const envelope=(data:unknown[])=>({status:'success',metadata:{total_records:data.length},data});
  assert.deepEqual(mapDispatchIncidentResponse(envelope([])),[]);
  assert.equal(mapDispatchIncidentResponse(null),undefined);
  assert.equal(mapDispatchIncidentResponse({status:'success',metadata:{total_records:2},data:[]}),undefined);
  assert.equal(mapDispatchIncidentResponse(envelope([null])),undefined);
  assert.equal(mapDispatchIncidentResponse(envelope([{incidentNumber:'TEST',dispatchedAt:'bad'}])),undefined);
  const rows=mapDispatchIncidentResponse(envelope([{
    incidentNumber:'TEST',dispatchedCode:'10-17',clearanceCode:'3V',eventDate:'2026-11-23',
    locationAddress:'100 Main',locationCity:'Columbus',locationState:'OH',locationZip:'43215',
    zone:'Z1',cruiserDistrict:'D1',officerName:'DO NOT COPY',
    dispatchedAt:'2026-11-23T14:00:00Z',
  }]));
  assert.equal(rows?.[0].dispatchedCode,'17');
  assert.equal(rows?.[0].clearanceCode,'3V');
  assert.equal(rows?.[0].eventDate,'2026-11-23');
  assert.equal(rows?.[0].locationAddress,'100 Main');
  assert.equal(rows?.[0].locationCity,'Columbus');
  assert.equal(rows?.[0].locationState,'OH');
  assert.equal(rows?.[0].locationZip,'43215');
  assert.equal(rows?.[0].zone,'Z1');
  assert.equal(rows?.[0].cruiserDistrict,'D1');
  assert.equal('officerName' in (rows?.[0]??{}),false);
  assert.equal(rows?.[0].dispatchedAt,undefined);
  assert.equal(selectDispatchIncidentMatch(rows??[],'TEST','UNIT-A').status,'matched');
});

test('dispatch parser rejects malformed address fields and validates optional clearance codes',()=>{
  const envelope=(data:unknown[])=>({status:'success',metadata:{total_records:data.length},data});
  assert.equal(mapDispatchIncidentResponse(envelope([{incidentNumber:'TEST',locationState:'OHO'}])),undefined);
  assert.equal(mapDispatchIncidentResponse(envelope([{incidentNumber:'TEST',locationZip:'4'}])),undefined);
  assert.equal(mapDispatchIncidentResponse(envelope([{incidentNumber:'TEST',clearanceCode:'ARREST'}])),undefined);
  assert.equal(mapDispatchIncidentResponse(envelope([{incidentNumber:'TEST',eventDate:'2026-02-30'}])),undefined);
  assert.equal(mapDispatchIncidentResponse(envelope([{incidentNumber:'TEST',eventIngressAt:'2026-11-23T14:00:00'}])),undefined);
});

test("maps a successful dispatch response while allowing absent fields", () => {
  assert.deepEqual(mapDispatchPrefillResponse({
    status: "success",
    metadata: { total_records: 1 },
    data: [{
      eventIngressAt: "2026-11-23T19:05:00.000Z",
      incidentNumber: "INC-2468",
      dispatchedCode: "17a",
      eventDate: "2026-11-23",
      locationAddress: "100 Main Street",
      locationCity: "Columbus",
      locationState: "OH",
      locationZip: "43215",
      zone: "Z1",
      cruiserDistrict: "D1",
      clearanceCode: "3V",
    }],
  }), {
    eventIngressAt: "2026-11-23T19:05:00.000Z",
    incidentNumber: "INC-2468",
    dispatchedCode: "17A",
    eventDate: "2026-11-23",
    locationAddress: "100 Main Street",
    locationCity: "Columbus",
    locationState: "OH",
    locationZip: "43215",
    zone: "Z1",
    cruiserDistrict: "D1",
    clearanceCode: "3V",
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

test('structured dispatch location and clearance prefill only untouched fields',()=>{
  const initial:DispatchPrefillDraft={runDateTimeText:'11/23/2026',runTimeText:'',incidentNumber:'INC',runLocation:'',runLocationCity:'',runLocationState:'',runLocationZip:'',runZone:'',runCruiserDistrict:'',clearanceCode:'',dispatchedCode:''};
  const prefill={locationAddress:'100 Main Street',locationCity:'Columbus',locationState:'OH',locationZip:'43215',zone:'Z1',cruiserDistrict:'D1',clearanceCode:'3V' as const};
  assert.deepEqual(applyDispatchPrefill(initial,initial,prefill),{
    ...initial,runLocation:'100 Main Street',runLocationCity:'Columbus',runLocationState:'OH',runLocationZip:'43215',
    runZone:'Z1',runCruiserDistrict:'D1',clearanceCode:'3V',
  });
  assert.equal(applyDispatchPrefill({...initial,runLocationCity:'FTO correction'},initial,prefill).runLocationCity,'FTO correction');
});

test("dispatch ingress time is a default only until the FTO changes it", () => {
  assert.equal(applyDispatchPrefillValue("11/23/2026", "11/23/2026", "11/22/2026 14:05"), "11/22/2026 14:05");
  assert.equal(applyDispatchPrefillValue("11/23/2026 13:55", "11/23/2026", "11/22/2026 14:05"), "11/23/2026 13:55");
});
