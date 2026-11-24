import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {parseOperationalIdentity} from "@workspace/api-zod/operational-profile";
import {createDailyReportDraft} from "./daily-report-draft.js";
import {createUiPreviewWorkspace} from "./empty-workspace.js";
import {activeFtoIdentity} from "../state/operational-profile.js";
import {parseRosterRows} from "./assignment-import.js";

test("new packets snapshot FTO CAD context without inferring fleet numbers; old packets and manual edits are unchanged",()=>{
  const folder=createUiPreviewWorkspace().caseFolder!;
  const profile={subject:"TEST",role:"FTO" as const,badge:folder.ftoBadge,version:1,identity:parseOperationalIdentity("9150E-1")};
  const prior=createDailyReportDraft(folder,"2026-11-23");
  prior.reportingForDuty.cruiserId="MANUAL";
  const original=structuredClone(prior);
  const draft=createDailyReportDraft(folder,"2026-11-24",prior,activeFtoIdentity(profile,folder));
  assert.equal(draft.reportingForDuty.cruiserId,"MANUAL");
  assert.deepEqual(draft.operationalIdentity,profile.identity);
  draft.reportingForDuty.cruiserId="CORRECTED";
  const saved=structuredClone(draft);
  profile.identity=parseOperationalIdentity("1234A");
  const next=createDailyReportDraft(folder,"2026-11-25",draft,activeFtoIdentity(profile,folder));
  assert.equal(next.reportingForDuty.cruiserId,"CORRECTED");
  assert.equal(next.operationalIdentity?.side,undefined);
  assert.equal(next.operationalIdentity?.cadUnit,"1234A");
  assert.equal(createDailyReportDraft(folder,"2026-11-25",undefined,profile.identity).reportingForDuty.cruiserId,undefined);
  assert.deepEqual(draft,saved);
  assert.deepEqual(prior,original);
  assert.equal(activeFtoIdentity({...profile,role:"PO"},folder),undefined);
  assert.equal(activeFtoIdentity({...profile,badge:"NOT-THE-ASSIGNED-FTO"},folder),undefined);
  assert.equal(activeFtoIdentity(undefined,folder),undefined);
  assert.equal(createDailyReportDraft(folder,"2026-11-25",prior).reportingForDuty.cruiserId,"MANUAL");
});

test("separate import columns validate operational tokens without changing legacy or universal roster grammar",()=>{
  const headers=["Class","PO Name","PO Badge","FTO Name","FTO Badge","Phase Start Date","Shift","Days Off","Zone","Precinct","Cruiser District","FTO Assignment","FTO Operational Assignment","PO Operational Assignment"];
  for(const roster of ["9010D","9010D1","80C","80C-2"]){
    const row=["TEST","Test PO","TEST-PO","Test FTO","TEST-FTO","11/24/2026","DMW","Sunday;Monday;Tuesday","1","1","9010",roster,"9150E","9150E-2"];
    const result=parseRosterRows([headers,row]);
    assert.deepEqual(result.errors,[]);
    assert.equal(result.ftos[0].operationalAssignmentToken,"9150E");
    assert.equal(result.assignments[0].poOperationalAssignmentToken,"9150E-2");
    assert.equal(result.assignments[0].ftoAssignment,roster);
    assert.equal(result.assignments[0].cruiserDistrict,"9010");
    row[12]="9150E1";
    assert.ok(parseRosterRows([headers,row]).errors.some(error=>error.includes("operational vehicle profile")));
  }
});

test("fictional account preview remains isolated after approved production-panel integration",async()=>{
  for(const file of ["../App.tsx","../pages/settings.tsx"]){
    const source=await readFile(new URL(file,import.meta.url),"utf8");
    assert.doesNotMatch(source,/CruiserIdentityPreview|OperationalProfileEditor|updateOperationalProfile/);
  }
  const preview=await readFile(new URL("../../../mockup-sandbox/src/components/mockups/CruiserIdentityPreview.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(preview,/\b(fetch|localStorage|sessionStorage|indexedDB)\s*[.(]/);
  const settings=await readFile(new URL("../pages/settings.tsx",import.meta.url),"utf8");
  assert.match(settings,/!w.previewOnly && <OperationalProfilePanel/);
});
