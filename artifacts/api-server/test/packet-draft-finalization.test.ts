import assert from "node:assert/strict";
import test from "node:test";
import type pg from "pg";
import { createAgencyPacketStore,PacketError } from "../src/lib/agency-packet-store.js";
import type { AgencyIdentity } from "../src/security/agencyIdentity.js";
import {createHash} from "node:crypto";
import {hashUserIdentifier as hash} from "../src/utils/cryptoUtils.js";

const fto:AgencyIdentity={id:"TEST-fto",badge:"TEST-2",role:"FTO"};
const contentHash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const report={id:"TEST-packet",date:"2026-11-22",phase:1,className:"TEST ONLY",recruitBadge:"TEST-1",ftoBadge:"TEST-2",status:"draft",
  reportingForDuty:{reviewedAt:"2026-11-22T12:00:00Z"},ratingsReviewedAt:"2026-11-22T12:00:00Z",runs:[]};
const assignment={id:"TEST-assignment",fto_id:fto.id,fto_badge:fto.badge,po_id:"TEST-po",po_badge:"TEST-1",coordinator_id:"TEST-coordinator",class_name:report.className,phase:1,
  fto_badge_hash:hash(fto.badge),po_badge_hash:hash("TEST-1"),po_id_hash:hash("TEST-po")};
const operation="00000000-0000-4000-8000-000000000001";
function fixture(options:{
  prior?:Record<string,unknown>; assigned?:boolean; packet?:Record<string,unknown>;
  readRows?:Record<string,unknown>[];
}={}) {
  const statements:{sql:string;values:unknown[]}[]=[];
  const client={
    async query(sql:string,values:unknown[]=[]){
      statements.push({sql,values});
      if(sql.includes("SELECT id, fto_name")) return {rows:options.assigned===false?[]:[assignment]};
      if(sql.startsWith("SELECT operation_id")) return {rows:options.prior?[{
        assignment_id:assignment.id,record_date:report.date,phase:report.phase,...options.prior,
      }]:[]};
      if(sql.includes("SELECT p.server_version")) return {rows:options.assigned===false?[]:[{
        server_version:1,content_hash:contentHash(report),submission_status:"local_draft_pending",finalization_operation_id:null,report,po_id:assignment.po_id,po_badge:assignment.po_badge,
        po_id_hash:assignment.po_id_hash,po_badge_hash:assignment.po_badge_hash,...options.packet,
      }]};
      if(sql.includes("SELECT pc.coordinator_id FROM")) return {rows:[{coordinator_id:assignment.coordinator_id}]};
      if(sql.includes("lock_packet_assignment")) return {rows:options.assigned===false?[]:[{id:assignment.id}]};
      if(sql.includes("p.record_date::text")) return {rows:options.readRows??
        (statements.some(item=>item.sql.includes("SET submission_status='submitted'"))?
          [{id:report.id,server_version:1,submission_status:"submitted",report}]:[])};
      return {rows:[]};
    },
    release(){},
  };
  const pool={connect:async()=>client} as unknown as pg.Pool;
  const raw=createAgencyPacketStore(pool);
  const audit={requestId:operation,clientIp:"192.0.2.1"};
  return {store:{
    sync:(identity:AgencyIdentity,changes:Parameters<typeof raw.sync>[2])=>raw.sync(identity,audit,changes),
    read:(identity:AgencyIdentity)=>raw.read(identity,audit),
    finalize:(identity:AgencyIdentity,id:string,op:string,version:number)=>raw.finalize(identity,audit,id,
      {operation_id:op,content_hash:version===1?contentHash(report):"f".repeat(64)}),
  },statements};
}

test("sync writes an editable draft, never a submitted packet",async()=>{
  const {store,statements}=fixture();
  const receipts=await store.sync(fto,[{report,operation_id:operation,base_version:0}]);
  assert.equal(receipts[0].sync_status,"local_draft_pending");
  const insert=statements.find(item=>item.sql.includes("INSERT INTO agency_training.packets"))!;
  assert.match(insert.sql,/'local_draft_pending'/);
  assert.ok(statements.some(item=>item.sql.includes("'DRAFT_SYNC'")));
  assert.ok(!statements.some(item=>item.sql.includes("'SUBMIT'")));
  assert.equal(statements.at(-1)?.sql,"COMMIT");
});

test("draft edits increment the version; stale edits roll back",async()=>{
  const prior={operation_id:"other",server_version:2,submission_status:"local_draft_pending"};
  const updated=fixture({prior});
  const receipts=await updated.store.sync(fto,[{report,operation_id:operation,base_version:2}]);
  assert.equal(receipts[0].server_version,3);
  assert.ok(updated.statements.some(item=>item.sql.startsWith("UPDATE agency_training.packets")));
  const stale=fixture({prior});
  await assert.rejects(stale.store.sync(fto,[{report,operation_id:operation,base_version:1}]),/PACKET_VERSION_CONFLICT/);
  assert.equal(stale.statements.at(-1)?.sql,"ROLLBACK");
});

test("drafts are excluded from PO and Coordinator reads by the server query",async()=>{
  for(const role of ["PO","FTO_COORDINATOR"] as const) {
    const {store,statements}=fixture();
    assert.deepEqual(await store.read({...fto,role}),[]);
    const read=statements.find(item=>item.sql.includes("p.record_date::text"))!;
    assert.match(read.sql,/p.submission_status = 'submitted' OR \$1 = 'FTO'/);
    assert.equal(read.values[0],role);
    assert.match(read.sql,/pc\.coordinator_id=\$5/);
  }
});

test("only explicit finalization submits and rechecks the active roster intersection",async()=>{
  const {store,statements}=fixture();
  const receipt=await store.finalize(fto,report.id,operation,1);
  assert.equal(receipt[0].sync_status,"submitted_complete");
  const query=statements.find(item=>item.sql.includes("SELECT p.server_version"))!;
  for(const text of ["a.active","a.fto_id=$2","a.fto_badge=$3","a.po_badge=p.report->>'recruitBadge'","a.fto_id_hash=$4","a.fto_badge_hash=$5","FOR UPDATE OF p"])
    assert.ok(query.sql.includes(text));
  assert.ok(statements.some(item=>item.sql.includes("submission_status='submitted'")));
  assert.ok(statements.some(item=>item.sql.includes("'SUBMIT'")));
});

test("unassigned, stale, unready, and non-FTO finalizations cannot submit",async()=>{
  const cases=[
    {options:{assigned:false},version:1,error:/PACKET_ASSIGNMENT_REQUIRED/},
    {options:{},version:4,error:/PACKET_SNAPSHOT_CONFLICT/},
    {options:{packet:{server_version:1,submission_status:"local_draft_pending",report:{...report,ratingsReviewedAt:undefined}}},version:1,error:/PACKET_NOT_READY/},
  ];
  for(const item of cases) {
    const {store,statements}=fixture(item.options);
    await assert.rejects(store.finalize(fto,report.id,operation,item.version),item.error);
    assert.ok(!statements.some(entry=>entry.sql.includes("'SUBMIT'")));
    assert.equal(statements.at(-1)?.sql,"ROLLBACK");
  }
  const {store}=fixture();
  await assert.rejects(store.finalize({...fto,role:"FTO_COORDINATOR"},report.id,operation,1),/PACKET_SUBMIT_FORBIDDEN/);
});

test("raw PO metadata cannot replace a different canonical hashed identity at final submission",async()=>{
  const {store,statements}=fixture({packet:{po_id:'a-different-account'}});
  await assert.rejects(store.finalize(fto,report.id,operation,1),error=>
    error instanceof PacketError&&error.code==='PACKET_ASSIGNMENT_REQUIRED');
  assert.ok(!statements.some(item=>item.sql.includes('INSERT INTO agency_training.packet_submissions')));
  assert.ok(statements.some(item=>item.sql==='ROLLBACK'));
});
