import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {test} from "node:test";
import type pg from "pg";
import express from "express";
import type {Server} from "node:http";
import {PGlite} from "@electric-sql/pglite";
import {createAgencyPacketStore} from "../src/lib/agency-packet-store.js";
import {createPacketReviewStore,type PacketReviewStore} from "../src/lib/packet-review-store.js";
import {createPacketReviewRouter} from "../src/routes/packet-review.js";
import {createPacketReceiptGate} from "../src/middlewares/packet-receipt-gate.js";
import type {AgencyIdentity} from "../src/security/agencyIdentity.js";
import {packetSubmissionReady} from "@workspace/api-zod/packet-readiness";
import {hashUserIdentifier as hash} from "../src/utils/cryptoUtils.js";

// Isolated, in-memory PostgreSQL engine. No agency database, real account,
// local vault or runtime configuration is read or changed by these fixtures.
const fto:AgencyIdentity={id:"TEST-fto",badge:"TEST-2",role:"FTO"};
const po:AgencyIdentity={id:"TEST-po",badge:"TEST-1",role:"PO"};
const coord:AgencyIdentity={id:"TEST-coordinator",badge:"TEST-3",role:"FTO_COORDINATOR"};
const other:AgencyIdentity={id:"TEST-other-coordinator",badge:"TEST-4",role:"FTO_COORDINATOR"};
const report={id:"TEST-packet",date:"2026-11-22",phase:1,className:"TEST ONLY",
  recruitBadge:po.badge,ftoBadge:fto.badge,recruitName:"TEST PO",ftoName:"TEST FTO",status:"draft",
  reportingForDuty:{reviewedAt:"2026-11-22T12:00:00Z"},ratingsReviewedAt:"2026-11-22T12:00:00Z",
  runs:[],narrative:"Authored MiXeD case / CAD TEXT",remedial:"Authored correction notes"};

test("packet submission readiness requires explicit sheet reviews, not a forged locked status",()=>{
  assert.equal(packetSubmissionReady(report),true);
  assert.equal(packetSubmissionReady({...report,status:"locked",ratingsReviewedAt:undefined}),false);
  assert.equal(packetSubmissionReady({...report,reportingForDuty:{}}),false);
  assert.equal(packetSubmissionReady({...report,runs:[{formStatus:"complete"}]}),false);
  assert.equal(packetSubmissionReady({...report,runs:[{formStatus:"complete",checklistReviewedAt:"reviewed"}]}),true);
  assert.equal(packetSubmissionReady({...report,limboDay:true,ratingsReviewedAt:undefined}),true);
});

test("real SQL packet lifecycle preserves snapshots, scopes access and separates receipt from approval",async t=>{
  const db=new PGlite();
  try{
    await db.exec(await readFile(new URL("../migrations/agency-training.sql",import.meta.url),"utf8"));
    await db.exec(await readFile(new URL("../migrations/agency-training-packet-review.sql",import.meta.url),"utf8"));
    await db.exec(await readFile(new URL("../migrations/agency-training-packet-guards.sql",import.meta.url),"utf8"));
    const query=async(sql:string,params:unknown[]=[])=>db.query(sql,params);
    let queue=Promise.resolve();
    const pool={query,connect:async()=>{
      const previous=queue;
      let release!:()=>void;
      queue=new Promise<void>(resolve=>{release=resolve;});
      await previous;
      return {query,release};
    }} as unknown as pg.Pool;
    const raw=createAgencyPacketStore(pool),review=createPacketReviewStore(pool);
    const audit=()=>({requestId:randomUUID(),clientIp:"192.0.2.1"});
    const packets={
      sync:(identity:AgencyIdentity,changes:Parameters<typeof raw.sync>[2])=>raw.sync(identity,audit(),changes),
      read:(identity:AgencyIdentity)=>raw.read(identity,audit()),
      finalize:(identity:AgencyIdentity,id:string,op:string,version:number)=>raw.finalize(identity,id,op,version,audit()),
    };
    const addRoster=async(_packetId:string)=>{
      const found=await query("SELECT id FROM agency_training.assignments WHERE fto_id_hash=$1",[hash(fto.id)]);
      if(found.rows.length)return;
      await query(`INSERT INTO agency_training.assignments
        (id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,po_id_hash,po_badge_hash,po_name,
         coordinator_id_hash,starts_on,ends_on,fto_id,fto_badge,po_id,po_badge,coordinator_id)
        VALUES ($1,$2,1,$3,$4,'TEST FTO',$5,$6,'TEST PO',$7,'2026-01-01','2026-12-31',$8,$9,$10,$11,$12)`,
        [randomUUID(),report.className,hash(fto.id),hash(fto.badge),hash(po.id),hash(po.badge),hash(coord.id),
          fto.id,fto.badge,po.id,po.badge,coord.id]);
    };
    await query("INSERT INTO agency_training.coordinator_directory (id,name) VALUES ($1,$2),($3,$4)",
      [coord.id,"TEST Coordinator",other.id,"TEST Other Coordinator"]);
    const assertPoRead=async(id:string,visible:boolean)=>{
      assert.equal((await review.list(po,0)).items.some(item=>item.id===id),visible);
      if(visible){
        const detail=await review.detail(po,id);
        assert.equal(detail.report.id,report.id);
        assert.ok(!detail.history.some(e=>e.note==='TEST written correction reason'));
      }else await assert.rejects(review.detail(po,id),/SUBMISSION_NOT_FOUND/);
      const app=express();
      app.use(createPacketReviewRouter((_req,res,next)=>{res.locals.agencyIdentity=po;next();},()=>review));
      await serve(app,async url=>{
        const list=await fetch(`${url}/v1/packet-review/submissions`);
        assert.equal(list.status,200);
        const page=await list.json() as {items:Array<{id:string}>};
        assert.equal(page.items.some(item=>item.id===id),visible);
        const response=await fetch(`${url}/v1/packet-review/submissions/${id}`);
        assert.equal(response.status,visible?200:404);
        const body=await response.json() as {report?:{id:string};history?:Array<{note:string}>};
        if(visible){
          assert.equal(body.report?.id,report.id);
          assert.ok(!body.history?.some(e=>e.note==='TEST written correction reason'));
        }else {
          assert.equal(body.report,undefined);
          assert.equal(body.history,undefined);
          assert.ok(!JSON.stringify(body).includes('Authored MiXeD'));
        }
      });
    };
    let originalSubmissionId='';
    await addRoster(report.id);
    await packets.sync(fto,[{operation_id:randomUUID(),base_version:0,report}]);
    let submissionId="";

    await t.test("draft sync never notifies; missing shared assignment blocks submission atomically",async()=>{
      assert.equal((await review.pending(coord)).count,0);
      assert.deepEqual(await packets.read(po),[]);
      await assert.rejects(packets.finalize(fto,report.id,randomUUID(),1),/ASSIGNED_COORDINATOR_REQUIRED/);
      const rows=await query("SELECT submission_status FROM agency_training.packets");
      assert.equal(rows.rows[0].submission_status,"local_draft_pending");
      assert.equal((await query("SELECT * FROM agency_training.packet_submissions")).rows.length,0);
    });
    await t.test("PO selects once; only a scoped Coordinator may subsequently edit",async()=>{
      const assigned=await review.assign(po,{po_id:po.id,coordinator_id:coord.id,expected_revision:0});
      assert.equal(assigned.revision,1);
      await assert.rejects(review.assign(po,{po_id:po.id,coordinator_id:other.id,expected_revision:1}),/REQUIRES_FTO_COORDINATOR/);
      await assert.rejects(review.assign(fto,{po_id:po.id,coordinator_id:other.id,expected_revision:1}),/ASSIGNMENT_FORBIDDEN/);
      await assert.rejects(review.assign(other,{po_id:po.id,coordinator_id:other.id,expected_revision:1}),/ASSIGNMENT_OUT_OF_SCOPE/);
      assert.equal((await review.context(po)).assignments.length,1);
    });
    await t.test("explicit submission routes once to the active, assigned Coordinator",async()=>{
      const operation=randomUUID();
      await packets.finalize(fto,report.id,operation,1);
      await packets.finalize(fto,report.id,operation,1);
      await assert.rejects(packets.finalize(fto,report.id,randomUUID(),1),/ALREADY_SUBMITTED/);
      const pending=await review.pending(coord);
      assert.equal(pending.count,1);submissionId=pending.item!.id;
      assert.equal((await review.pending(other)).count,0);
      assert.equal((await review.list(other,0)).items.length,0);
      assert.equal((await review.list(fto,0)).items[0].state,"submitted");
      assert.deepEqual(await packets.read(po),[]); // PO release remains a separate reviewed action.
      originalSubmissionId=submissionId;
      await assertPoRead(submissionId,false);
      assert.equal((await query("SELECT * FROM agency_training.packet_submissions")).rows.length,1);
      await assert.rejects(review.act(coord,submissionId,{operation_id:randomUUID(),action:"approve",note:""}),/ACKNOWLEDGMENT_REQUIRED/);
    });
    await t.test("acknowledgment is authorized, retry-safe and not approval",async()=>{
      await assert.rejects(review.act(other,submissionId,{operation_id:randomUUID(),action:"acknowledge",note:""}),/NOT_FOUND/);
      await assert.rejects(review.act(po,submissionId,{operation_id:randomUUID(),action:"acknowledge",note:""}),/REVIEW_FORBIDDEN/);
      const input={operation_id:randomUUID(),action:"acknowledge" as const,note:""};
      assert.equal((await review.act(coord,submissionId,input)).state,"acknowledged");
      await review.act(coord,submissionId,input);
      await review.act(coord,submissionId,{...input,operation_id:randomUUID()});
      assert.equal((await review.pending(coord)).count,0);
      const events=await query("SELECT * FROM agency_training.packet_review_events WHERE action='ACKNOWLEDGED'");
      assert.equal(events.rows.length,1);
      await assert.rejects(review.act(coord,submissionId,{operation_id:randomUUID(),action:"approve",note:""}),/OPEN_PACKET_BEFORE_APPROVAL/);
    });
    await t.test("correction requires a written reason and never changes the submitted snapshot",async()=>{
      const detail=await review.detail(coord,submissionId);
      assert.equal(detail.report.narrative,report.narrative);
      assert.equal(detail.report.status,"locked");
      await assert.rejects(review.act(coord,submissionId,{operation_id:randomUUID(),action:"return",note:"  "}),/CORRECTION_REASON_REQUIRED/);
      const input={operation_id:randomUUID(),action:"return" as const,note:"TEST written correction reason"};
      assert.equal((await review.act(coord,submissionId,input)).state,"correction_requested");
      await review.act(coord,submissionId,input);
      assert.equal((await packets.read(fto,report.id))[0].sync_status,"local_draft_pending");
      assert.equal((await review.detail(coord,submissionId)).report.narrative,report.narrative);
      await assertPoRead(submissionId,false);
      await assert.rejects(packets.finalize(fto,report.id,randomUUID(),1),/NEW_PACKET_REVISION_REQUIRED/);
    });
    await t.test("a revised packet creates a new snapshot and requires fresh acknowledgment",async()=>{
      const correction={...report,narrative:"Corrected MiXeD case"};
      await packets.sync(fto,[{operation_id:randomUUID(),base_version:1,report:correction}]);
      await packets.finalize(fto,report.id,randomUUID(),2);
      const page=await review.list(fto,0);
      assert.equal(page.items.length,1);
      assert.equal(page.items[0].packet_version,2);
      assert.equal(page.items[0].state,"submitted");
      assert.equal((await review.detail(coord,submissionId)).report.narrative,report.narrative);
      submissionId=page.items[0].id;
      assert.equal((await review.detail(coord,submissionId)).report.narrative,correction.narrative);
      assert.equal((await review.pending(coord)).count,1);
      await assertPoRead(originalSubmissionId,false);
      await assertPoRead(submissionId,false);
    });
    await t.test("reassignment moves pending work, resets receipt and denies the former Coordinator",async()=>{
      await review.act(coord,submissionId,{operation_id:randomUUID(),action:"acknowledge",note:""});
      await assert.rejects(review.assign(coord,{po_id:po.id,coordinator_id:other.id,expected_revision:99}),/VERSION_CONFLICT/);
      await assert.rejects(review.assign(coord,{po_id:po.id,coordinator_id:"TEST-missing",expected_revision:1}),/UNAVAILABLE/);
      await review.assign(coord,{po_id:po.id,coordinator_id:other.id,expected_revision:1});
      assert.equal((await review.pending(coord)).count,0);
      assert.equal((await review.pending(other)).count,1);
      const pending=(await review.pending(other)).item!;
      assert.equal(pending.acknowledged_at,null);
      assert.equal(pending.state,"submitted");
      await assert.rejects(review.detail(coord,submissionId),/NOT_FOUND/);
      assert.ok((await review.detail(other,submissionId)).history.some(e=>e.action==="REASSIGNED"));
    });
    await t.test("every pending receipt blocks approval; approved packets cannot be unsealed",async()=>{
      await review.act(other,submissionId,{operation_id:randomUUID(),action:"acknowledge",note:""});
      const next={...report,id:"TEST-second-packet"};
      await addRoster(next.id);
      await packets.sync(fto,[{operation_id:randomUUID(),base_version:0,report:next}]);
      await packets.finalize(fto,next.id,randomUUID(),1);
      await review.detail(other,submissionId);
      await assert.rejects(review.act(other,submissionId,{operation_id:randomUUID(),action:"approve",note:""}),/ACKNOWLEDGMENT_REQUIRED/);
      const pending=(await review.pending(other)).item!;
      await review.act(other,pending.id,{operation_id:randomUUID(),action:"acknowledge",note:""});
      const input={operation_id:randomUUID(),action:"approve" as const,note:"TEST reviewed"};
      assert.equal((await review.act(other,submissionId,input)).state,"approved");
      await review.act(other,submissionId,input);
      await assert.rejects(review.act(other,submissionId,{operation_id:randomUUID(),action:"return",note:"TEST"}),/ACKNOWLEDGE_BEFORE_REVIEW/);
      assert.equal((await packets.read(fto,report.id))[0].sync_status,"synchronized_complete");
      assert.equal((await review.list(fto,0)).items.find(s=>s.packet_id===report.id)!.state,"approved");
      const history=(await review.detail(other,submissionId)).history;
      assert.equal(history.filter(e=>e.action==="APPROVED").length,1);
      await review.assign(other,{po_id:po.id,coordinator_id:coord.id,expected_revision:2});
      const approved=(await review.detail(coord,submissionId)).submission;
      assert.equal(approved.state,"approved");
      assert.equal(approved.coordinator_id,other.id);
    });
    await t.test("inactive destination blocks submission; changed idempotency payload is rejected",async()=>{
      const next={...report,id:"TEST-third-packet"};
      await addRoster(next.id);
      await packets.sync(fto,[{operation_id:randomUUID(),base_version:0,report:next}]);
      await query("UPDATE agency_training.coordinator_directory SET active=false WHERE id=$1",[coord.id]);
      await assert.rejects(packets.finalize(fto,next.id,randomUUID(),1),/ASSIGNED_COORDINATOR_REQUIRED/);
      await query("UPDATE agency_training.coordinator_directory SET active=true WHERE id=$1",[coord.id]);
      const pending=(await review.pending(coord)).item!;
      const operation=randomUUID();
      await review.act(coord,pending.id,{operation_id:operation,action:"acknowledge",note:""});
      await assert.rejects(review.act(coord,pending.id,{operation_id:operation,action:"approve",note:""}),/OPERATION_CONFLICT/);
    });
    await t.test("restricted runtime can finish reviews but cannot edit trusted rosters, snapshots or audit events",async()=>{
      await db.exec(`CREATE ROLE test_packet_runtime;
        GRANT USAGE ON SCHEMA agency_training TO test_packet_runtime;
        GRANT SELECT ON agency_training.assignments,agency_training.packet_assignments,agency_training.coordinator_directory TO test_packet_runtime;
        GRANT SELECT,INSERT ON agency_training.packets,agency_training.packet_assignments TO test_packet_runtime;
        GRANT UPDATE(operation_id,content_hash,report,server_version,submission_status,finalization_operation_id,submitted_at,
          released_to_po,released_at,released_by_hash,withdrawn_at,withdrawn_by_hash,withdrawal_reason)
          ON agency_training.packets TO test_packet_runtime;
        GRANT INSERT ON agency_training.packet_events TO test_packet_runtime;
        GRANT SELECT,INSERT ON agency_training.po_coordinators,agency_training.packet_submissions,
          agency_training.packet_review_events,agency_training.packet_review_operations TO test_packet_runtime;
        GRANT UPDATE(coordinator_id,revision,updated_at) ON agency_training.po_coordinators TO test_packet_runtime;
        GRANT UPDATE(coordinator_id,state,acknowledged_at,reviewed_at,review_note)
          ON agency_training.packet_submissions TO test_packet_runtime;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA agency_training TO test_packet_runtime;
        GRANT EXECUTE ON FUNCTION agency_training.lock_packet_assignment(text,text,text),
          agency_training.lock_active_packet_coordinator(text) TO test_packet_runtime;
        SET ROLE test_packet_runtime;`);
      try{
        await packets.finalize(fto,"TEST-third-packet",randomUUID(),1);
        const pending=(await review.pending(coord)).item!;
        await review.act(coord,pending.id,{operation_id:randomUUID(),action:"acknowledge",note:""});
        await review.detail(coord,pending.id);
        assert.equal((await review.act(coord,pending.id,{operation_id:randomUUID(),action:"approve",note:"TEST reviewed"})).state,"approved");
        await review.assign(coord,{po_id:po.id,coordinator_id:other.id,expected_revision:3});
        await assert.rejects(query("UPDATE agency_training.packet_assignments SET active=false"),/permission denied/);
        await assert.rejects(query("UPDATE agency_training.assignments SET active=false"),/permission denied/);
        await assert.rejects(query("UPDATE agency_training.coordinator_directory SET active=false"),/permission denied/);
        await assert.rejects(query("UPDATE agency_training.packet_submissions SET report='{}'"),/permission denied/);
        await assert.rejects(query("UPDATE agency_training.packet_review_events SET note='tampered'"),/permission denied/);
      }finally{await db.exec("RESET ROLE");}
    });
    await t.test("PO store and HTTP reads require release of the exact version and revoke access on withdrawal",async()=>{
      await assertPoRead(submissionId,false); // Approval alone is not PO release.
      const current=await query<{content_hash:string}>(
        "SELECT content_hash FROM agency_training.packets WHERE id=$1",[report.id]);
      const content_hash=current.rows[0].content_hash;
      await raw.review(other,audit(),report.id,"release",{
        operation_id:randomUUID(),content_hash,review_confirmed:true,
      });
      assert.equal((await packets.read(po)).length,1);
      await assertPoRead(submissionId,true);
      await assertPoRead(originalSubmissionId,false); // Same packet ID is not enough.
      assert.ok((await review.detail(other,submissionId)).history.some(e=>e.note==="TEST written correction reason"));
      await raw.review(other,audit(),report.id,"withdraw",{
        operation_id:randomUUID(),content_hash,review_confirmed:true,reason:"TEST withdrawal",
      });
      assert.deepEqual(await packets.read(po),[]);
      await assertPoRead(submissionId,false);
      await assertPoRead(originalSubmissionId,false);
    });
  }finally{await db.close();}
});

async function serve(app:express.Express,run:(url:string)=>Promise<void>){
  let server:Server|undefined;
  try{
    server=await new Promise<Server>(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
    const address=server.address();assert.ok(address&&typeof address==="object");
    await run(`http://127.0.0.1:${address.port}`);
  }finally{if(server)await new Promise<void>((resolve,reject)=>server!.close(e=>e?reject(e):resolve()));}
}
test("server receipt gate allows only context/acknowledgment while a Coordinator has unread packets",async()=>{
  const app=express();app.use(express.json());
  app.use(createPacketReceiptGate(()=>coord,()=>({pending:async()=>({count:2,item:null})}) as unknown as PacketReviewStore));
  app.use((_req,res)=>{res.status(204).end();});
  await serve(app,async url=>{
    assert.equal((await fetch(`${url}/v1/packet-review/context`)).status,204);
    assert.equal((await fetch(`${url}/v1/packet-review/submissions/${randomUUID()}`,{
      method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"acknowledge"}),
    })).status,204);
    for(const path of ["/v1/training-packets","/v1/packet-review/submissions","/resources/manual"])
      {
        const response=await fetch(url+path);assert.equal(response.status,409);
        const error=await response.json() as {status:string;error_code:string;message:string};
        assert.equal(error.status,"error");assert.equal(error.error_code,"PACKET_ACKNOWLEDGMENT_REQUIRED");
        assert.ok(error.message.length<=300);
      }
  });
});
test("storage failure retains the verified role so the UI fails closed; invalid actions never reach storage",async()=>{
  const app=express();app.use(express.json());
  const unavailable={context:async()=>{throw new Error("TEST storage failure");}} as unknown as PacketReviewStore;
  app.use(createPacketReviewRouter((_req,res,next)=>{res.locals.agencyIdentity=coord;next();},()=>unavailable));
  await serve(app,async url=>{
    const response=await fetch(`${url}/v1/packet-review/context`);
    assert.equal(response.status,200);
    const context=await response.json() as {role:string;available:boolean};
    assert.equal(context.role,"FTO_COORDINATOR");assert.equal(context.available,false);
    for(const payload of [{operation_id:"invalid",action:"approve",note:""},{operation_id:randomUUID(),action:"invalid",note:""}])
      assert.equal((await fetch(`${url}/v1/packet-review/submissions/${randomUUID()}`,{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),
      })).status,400);
  });
});
