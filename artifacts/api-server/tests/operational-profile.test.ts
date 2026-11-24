import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import express, { type RequestHandler } from "express";
import type pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { createOperationalProfileStore } from "../src/lib/operational-profile-store.js";
import { createOperationalProfileRouter } from "../src/routes/operational-profile.js";
import { parseOperationalIdentity, OperationalAssignmentToken } from "@workspace/api-zod/operational-profile";
import type { AgencyIdentity } from "../src/security/agencyIdentity.js";
import { CompletePacketInput } from "../src/lib/packet-contract.js";

const fto: AgencyIdentity={id:"FICTIONAL-FTO",badge:"TEST-1",role:"FTO"};
const po: AgencyIdentity={id:"FICTIONAL-PO",badge:"TEST-2",role:"PO"};
test("exact cruiser examples retain side and token; reject malformed and legacy roster tokens",()=>{
  for(const side of ["1","2"]) assert.deepEqual(parseOperationalIdentity(`9150E-${side}`),{
    assignmentToken:`9150E-${side}`,cruiserNumber:"9150",cadUnit:"9150E",company:"E",side,
  });
  for(const value of ["9150E","9150E1","9150e-1"," 9150E-1","9150E-1 ","9150E-3","80C-1","9150EE-1","915E-1",null,9150])
    assert.equal(OperationalAssignmentToken.safeParse(value).success,false,String(value));
});

test("agency SQL atomically saves own profile, rejects stale concurrent saves and protects identity derivations",async()=>{
  const db=new PGlite();
  try{
    await db.exec("CREATE SCHEMA agency_training");
    await db.exec(await readFile(new URL("../migrations/operational-profiles.sql",import.meta.url),"utf8"));
    const store=createOperationalProfileStore({query:(sql:string,args:unknown[])=>db.query(sql,args)} as unknown as pg.Pool);
    assert.equal((await store.read(fto)).identity,null);
    const creations=await Promise.allSettled(["9150E-1","9150E-2"].map(assignmentToken=>store.save(fto,{assignmentToken,expectedVersion:0})));
    assert.equal(creations.filter(result=>result.status==="fulfilled").length,1);
    assert.equal(creations.filter(result=>result.status==="rejected").length,1);
    const prior=await store.read(fto);
    const updates=await Promise.allSettled(["9151E-1","9152E-2"].map(assignmentToken=>store.save(fto,{assignmentToken,expectedVersion:1})));
    assert.equal(updates.filter(result=>result.status==="fulfilled").length,1);
    assert.equal((await store.read(fto)).version,2);
    const saved=await store.read(fto);
    assert.deepEqual(saved.identity,parseOperationalIdentity(saved.identity!.assignmentToken));
    await assert.rejects(store.save(fto,{assignmentToken:"9150E-3",expectedVersion:2}));
    await assert.rejects(store.save(fto,{assignmentToken:"9150E-2",expectedVersion:2,subject:po.id}));
    assert.deepEqual(await store.read(fto),saved);
    assert.equal((await store.read(po)).version,0);
    await store.save(po,{assignmentToken:"1234A-1",expectedVersion:0});
    assert.deepEqual(await store.read(fto),saved);
    assert.equal(prior.badge,fto.badge);
    await assert.rejects(store.save({...fto,role:"FTO_COORDINATOR"},{assignmentToken:"9150E-1",expectedVersion:2}),{status:403});
    await assert.rejects(db.query("UPDATE agency_training.operational_profiles SET cad_unit='WRONG'"));
    assert.deepEqual(await store.read(fto),saved);
  }finally{await db.close();}
});

test("authenticated profile routes never accept another subject, roles, badges or derived values",async()=>{
  let identity:AgencyIdentity|undefined;
  let writes=0;
  const auth:RequestHandler=(_req,res,next)=>{
    if(!identity){res.sendStatus(401);return;}
    res.locals.agencyIdentity=identity;next();
  };
  const profile={subject:fto.id,role:"FTO" as const,badge:fto.badge,version:1,identity:parseOperationalIdentity("9150E-1")};
  const router=createOperationalProfileRouter(auth,()=>({
    read:async who=>({...profile,subject:who.id}),
    save:async(who,_input)=>{assert.equal(who.id,fto.id);writes++;return profile;},
  }));
  const app=express();app.use(express.json());app.use(router);
  const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
  const address=server.address();assert.ok(address&&typeof address==="object");
  const url=`http://127.0.0.1:${address.port}/v1/account/operational-profile`;
  const put=(body:unknown)=>fetch(url,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  try{
    assert.equal((await fetch(url)).status,401);
    identity=fto;
    assert.equal((await fetch(url)).headers.get("cache-control"),"no-store");
    for(const extra of [{subject:po.id},{role:"FTO_COORDINATOR"},{badge:"other"},{cruiserNumber:"1111"},{cadUnit:"OTHER"},{trainingAssignments:[]}]){
      assert.equal((await put({assignmentToken:"9150E-1",expectedVersion:0,...extra})).status,400);
    }
    assert.equal(writes,0);
    assert.equal((await put({assignmentToken:"9150E-1",expectedVersion:0})).status,200);
    identity={...fto,role:"FTO_COORDINATOR"};
    assert.equal((await fetch(url)).status,403);
    assert.equal((await put({assignmentToken:"9150E-1",expectedVersion:0})).status,403);
    assert.equal(writes,1);
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test("complete packet contract keeps identity snapshots optional but rejects forged derivations",()=>{
  const base={id:"TEST",date:"2026-11-24",phase:1,className:"TEST",recruitName:"Test PO",recruitBadge:"2",
    ftoName:"Test FTO",ftoBadge:"1",runs:[],status:"draft",activity:{},reportingForDuty:{},ratings:{},
    narrative:"",remedial:"",recruitComments:""};
  const input=(report:unknown)=>({packets:[{operation_id:crypto.randomUUID(),base_version:0,report}]});
  assert.equal(CompletePacketInput.safeParse(input(base)).success,true);
  const operationalIdentity=parseOperationalIdentity("9150E-1");
  assert.deepEqual(CompletePacketInput.parse(input({...base,operationalIdentity})).packets[0].report.operationalIdentity,operationalIdentity);
  assert.equal(CompletePacketInput.safeParse(input({...base,operationalIdentity:{...operationalIdentity,cadUnit:"OTHER"}})).success,false);
});
