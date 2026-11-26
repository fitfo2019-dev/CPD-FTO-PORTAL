import 'fake-indexeddb/auto';
import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDispatchIncidentRetry, applyDispatchPrefill, applyDispatchPrefillValue, isDispatchedRunMissingIncidentNumber, mapDispatchPrefillResponse, mapDispatchIncidentResponse, restoreDispatchPrefillFields, selectDispatchIncidentMatch, serializeDispatchPrefillFields, type DispatchIncidentDraftFields, type DispatchPrefillDraft } from "./dispatch-prefill.js";
import { lookupDispatchIncident } from "../components/dispatch-incident-lookup.js";
import { OfflineStorage } from "./offlineStorage.js";
import type { TrainingRun } from "./model.js";
import { searchTrainingRunsByIncidentNumber } from "./training-run-search.js";

test("saved runs search by incident-number text without losing long or leading-zero values",()=>{
  const runs=[
    {id:"short",incidentNumber:"012345678"},
    {id:"long",incidentNumber:"0123456789012345"},
    {id:"other",incidentNumber:"998877665"},
    {id:"missing"},
  ];
  assert.deepEqual(searchTrainingRunsByIncidentNumber(runs,""),runs);
  assert.deepEqual(searchTrainingRunsByIncidentNumber(runs," 012345678 "),runs.slice(0,2));
  assert.deepEqual(searchTrainingRunsByIncidentNumber(runs,"0123456789012345"),[runs[1]]);
  assert.deepEqual(searchTrainingRunsByIncidentNumber(runs,"123000000"),[]);
});

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

test('dispatch retries stay available after repeated failures and reuse the same event', async t => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  let attempts = 0;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_input, init) => {
    requests.push(String(init?.body));
    attempts += 1;
    if (attempts < 3) throw new Error('temporary outage');
    return new Response(JSON.stringify({
      status: 'success',
      metadata: { total_records: 1 },
      data: [{ incidentNumber: 'INC-2468', unitNumber: 'UNIT-A', locationAddress: '100 Main Street' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const results = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    results.push(await lookupDispatchIncident('INC-2468', 'UNIT-A', new AbortController().signal));
  }
  assert.deepEqual(results.map(result => result.status), ['unavailable', 'unavailable', 'matched']);
  assert.deepEqual(requests, Array(3).fill(JSON.stringify({ incidentNumber: 'INC-2468', unitNumber: 'UNIT-A' })));
});

test('a successful retry fills untouched fields but preserves manual corrections', () => {
  const initial: DispatchIncidentDraftFields = {
    location: '', locationCity: '', locationState: '', locationZip: '', zone: '', cruiserDistrict: '',
    occurredAtText: '', dispatchedAtText: '', clearedAtText: '', dispatchedCode: '', clearanceCode: '',
  };
  const corrected: DispatchIncidentDraftFields = {
    ...initial,
    location: 'FTO corrected location',
    locationCity: 'Corrected City',
    dispatchedCode: '17A',
  };
  assert.deepEqual(applyDispatchIncidentRetry(corrected, initial, {
    location: '100 Main Street',
    locationCity: 'Columbus',
    locationState: 'OH',
    zone: 'Z1',
    occurredAtText: '11/23/2026 14:05',
    dispatchedCode: '6',
    clearanceCode: '3V',
  }), {
    ...corrected,
    locationState: 'OH',
    zone: 'Z1',
    occurredAtText: '11/23/2026 14:05',
    clearanceCode: '3V',
  });
});

test('legacy runs reopen safely when structured dispatch fields are absent', () => {
  const legacyRun: TrainingRun = {
    id: 'legacy-dispatch-run',
    occurredAt: '2026-11-23T14:00:00.000Z',
    runKind: 'traffic_stop',
    isDispatched: true,
    trafficMode: 'motor_vehicle',
    arrestMade: false,
    transportedAfterArrest: false,
    oviProcessed: false,
    narrativeAdditionRequired: false,
    formStatus: 'complete',
    checklist: {},
    narrative: 'Legacy run with no structured dispatch details.',
  };
  const savedSnapshot = structuredClone(legacyRun);

  assert.deepEqual(restoreDispatchPrefillFields(legacyRun), {
    incidentNumber: '',
    runLocation: '',
    runLocationCity: '',
    runLocationState: '',
    runLocationZip: '',
    runZone: '',
    runCruiserDistrict: '',
    clearanceCode: '',
    dispatchedCode: '6',
  });
  assert.deepEqual(legacyRun, savedSnapshot, 'restoring editor defaults must not mutate the saved run');

  const correctedRun: TrainingRun = { ...legacyRun, dispatchedCode: '17A' };
  assert.equal(restoreDispatchPrefillFields(correctedRun).dispatchedCode, '17A');

  const intentionallyBlankRun: TrainingRun = { ...legacyRun, dispatchedCode: '' };
  assert.equal(restoreDispatchPrefillFields(intentionallyBlankRun).dispatchedCode, '');
});

test('only dispatched runs with blank incident numbers trigger the submission warning',()=>{
  assert.equal(isDispatchedRunMissingIncidentNumber({isDispatched:true}),true);
  assert.equal(isDispatchedRunMissingIncidentNumber({isDispatched:true,incidentNumber:'   '}),true);
  assert.equal(isDispatchedRunMissingIncidentNumber({isDispatched:true,incidentNumber:'INC-2468'}),false);
  assert.equal(isDispatchedRunMissingIncidentNumber({isDispatched:false}),false);
  assert.equal(isDispatchedRunMissingIncidentNumber({isDispatched:false,incidentNumber:''}),false);
});

test("dispatch ingress time is a default only until the FTO changes it", () => {
  assert.equal(applyDispatchPrefillValue("11/23/2026", "11/23/2026", "11/22/2026 14:05"), "11/22/2026 14:05");
  assert.equal(applyDispatchPrefillValue("11/23/2026 13:55", "11/23/2026", "11/22/2026 14:05"), "11/23/2026 13:55");
});

test('saved dispatch corrections survive vault reopening without traffic-stop defaults replacing them', async () => {
  const initial: DispatchPrefillDraft = {
    runDateTimeText: '11/23/2026 14:00',
    runTimeText: '14:00',
    incidentNumber: '',
    runLocation: '',
    runLocationCity: '',
    runLocationState: '',
    runLocationZip: '',
    runZone: '',
    runCruiserDistrict: '',
    clearanceCode: '',
    dispatchedCode: '6',
  };
  const dispatchDefaults = {
    incidentNumber: 'CAD-2468',
    locationAddress: '100 Main Street',
    locationCity: 'Columbus',
    locationState: 'OH',
    locationZip: '43215',
    zone: 'Z1',
    cruiserDistrict: 'D1',
    clearanceCode: '1V' as const,
    dispatchedCode: '6',
  };
  const populated = applyDispatchPrefill(initial, initial, dispatchDefaults);
  const corrected = {
    ...populated,
    incidentNumber: 'FTO-verified-2468',
    runLocation: '200 Oak Avenue',
    runLocationCity: 'Corrected City',
    dispatchedCode: '17A',
  };
  const run: TrainingRun = {
    id: 'dispatch-save-reopen-test',
    ...serializeDispatchPrefillFields(corrected),
    occurredAt: '2026-11-23T14:00:00.000Z',
    runKind: 'traffic_stop',
    isDispatched: true,
    trafficMode: 'motor_vehicle',
    arrestMade: false,
    transportedAfterArrest: false,
    oviProcessed: false,
    narrativeAdditionRequired: false,
    formStatus: 'complete',
    checklist: {},
    checklistReviewedAt: '2026-11-23T15:00:00.000Z',
    narrative: 'Fictional dispatch persistence test.',
  };

  const namespace = `dispatch-roundtrip-${crypto.randomUUID()}`;
  const passphrase = new TextEncoder().encode('dispatch-roundtrip-test-passphrase');
  const vault = new OfflineStorage(namespace);
  await vault.unlock(passphrase);
  await vault.save('workspace', { reports: [{ id: 'test-report', runs: [run] }] });
  vault.lock();

  const reopenedVault = new OfflineStorage(namespace);
  await reopenedVault.unlock(passphrase);
  const restoredWorkspace = await reopenedVault.get<{
    reports: Array<{ runs: TrainingRun[] }>;
  }>('workspace');
  assert.ok(restoredWorkspace);
  const restoredRun = restoredWorkspace.reports[0].runs[0];
  const reopenedFields = restoreDispatchPrefillFields(restoredRun);

  assert.equal(reopenedFields.incidentNumber, 'FTO-verified-2468');
  assert.equal(reopenedFields.runLocation, '200 Oak Avenue');
  assert.equal(reopenedFields.runLocationCity, 'Corrected City');
  assert.equal(reopenedFields.runLocationState, 'OH');
  assert.equal(reopenedFields.runLocationZip, '43215');
  assert.equal(reopenedFields.runZone, 'Z1');
  assert.equal(reopenedFields.runCruiserDistrict, 'D1');
  assert.equal(reopenedFields.dispatchedCode, '17A');
  assert.equal(reopenedFields.clearanceCode, '1V');
  assert.deepEqual(
    applyDispatchPrefill({ ...initial, ...reopenedFields }, initial, dispatchDefaults),
    { ...initial, ...reopenedFields },
  );
  reopenedVault.lock();
});
