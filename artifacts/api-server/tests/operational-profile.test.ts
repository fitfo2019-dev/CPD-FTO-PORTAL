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
test("CAD examples strip internal sides without inferring a physical fleet number",()=>{
  for(const side of ["1","2"]) assert.deepEqual(parseOperationalIdentity(`9150E-${side}`),{
    assignmentToken:`9150E-${side}`,districtToken:"9150",cadUnit:"9150E",company:"E",side,
  });
  assert.deepEqual(parseOperationalIdentity("9150E"),{assignmentToken:"9150E",districtToken:"9150",cadUnit:"9150E",company:"E"});
  for(const value of ["9150E1","9150e-1"," 9150E-1","9150E-1 ","9150E-3","80C-1","9150EE-1","915E-1",null,9150])
    assert.equal(OperationalAssignmentToken.safeParse(value).success,false,String(value));
});

test("agency SQL atomically saves own profile, rejects stale concurrent saves and protects identity derivations",async()=>{
  const db=new PGlite();
  try{
    await db.exec("CREATE SCHEMA agency_training");
    await db.exec(await readFile(new URL("../migrations/operational-profiles.sql",import.meta.url),"utf8"));
    await db.exec(await readFile(new URL("../migrations/operational-profile-optional-sides.sql",import.meta.url),"utf8"));
    await db.exec(await readFile(new URL("../migrations/operational-profile-history.sql",import.meta.url),"utf8"));
    await db.exec(await readFile(new URL("../migrations/operational-profile-clear.sql",import.meta.url),"utf8"));
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
    const unsided=await store.save(fto,{assignmentToken:"9150E",expectedVersion:2});
    assert.equal(unsided.identity?.side,undefined);
    assert.equal(unsided.identity?.cadUnit,"9150E");
    const raw=await db.query("SELECT side,cruiser_number,district_token,cad_unit FROM agency_training.operational_profiles WHERE assignment_token='9150E'");
    assert.deepEqual(raw.rows,[{side:null,cruiser_number:null,district_token:"9150",cad_unit:"9150E"}]);
    await assert.rejects(db.query("UPDATE agency_training.operational_profiles SET side='1' WHERE assignment_token='9150E'"));
    const sided=await store.save(fto,{assignmentToken:"9150E-2",expectedVersion:3});
    assert.equal(sided.identity?.side,"2");
    assert.equal((await store.read(fto)).identity?.cadUnit,"9150E");
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
    history:async who=>({subject:who.id,entries:[],nextBeforeVersion:null}),
    read:async who=>({...profile,subject:who.id}),
    save:async(who,_input)=>{assert.equal(who.id,fto.id);writes++;return profile;},
    clear:async(who,_input)=>{assert.equal(who.id,fto.id);writes++;return {...profile,identity:null,version:2};},
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
  const historical={assignmentToken:"9150E-1",cruiserNumber:"9150",cadUnit:"9150E",company:"E",side:"1"};
  assert.deepEqual(CompletePacketInput.parse(input({...base,operationalIdentity:historical})).packets[0].report.operationalIdentity,historical);
  const formerFull={assignmentToken:"9150E-2",districtToken:"9150",cadUnit:"9150E-2",company:"E",side:"2"};
  assert.deepEqual(CompletePacketInput.parse(input({...base,operationalIdentity:formerFull})).packets[0].report.operationalIdentity,formerFull);
  const unsided=parseOperationalIdentity("9150E");
  assert.deepEqual(CompletePacketInput.parse(input({...base,operationalIdentity:unsided})).packets[0].report.operationalIdentity,unsided);
});

test("migration preserves former profile evidence and packet JSON while invalidating old session versions",async()=>{
  const db=new PGlite();
  try{
    await db.exec("CREATE SCHEMA agency_training");
    await db.exec(await readFile(new URL("../migrations/operational-profiles.sql",import.meta.url),"utf8"));
    await db.query("INSERT INTO agency_training.operational_profiles(subject_hash,assignment_token,cruiser_number,cad_unit,company,side) VALUES ($1,'9150E-1','9150','9150E','E','1')",["a".repeat(64)]);
    await db.exec("CREATE TABLE agency_training.historical_test(report jsonb); INSERT INTO agency_training.historical_test VALUES ('{\"reportingForDuty\":{\"cruiserId\":\"MANUAL\"},\"operationalIdentity\":{\"cadUnit\":\"9150E\"}}')");
    const before=await db.query("SELECT report FROM agency_training.historical_test");
    await db.exec(await readFile(new URL("../migrations/operational-profile-optional-sides.sql",import.meta.url),"utf8"));
    const raw=await db.query("SELECT version,cad_unit,cruiser_number,district_token FROM agency_training.operational_profiles");
    assert.deepEqual(raw.rows,[{version:2,cad_unit:"9150E-1",cruiser_number:"9150",district_token:"9150"}]);
    await db.exec(await readFile(new URL("../migrations/operational-profile-history.sql",import.meta.url),"utf8"));
    await db.exec(await readFile(new URL("../migrations/operational-profile-clear.sql",import.meta.url),"utf8"));
    const clearedUpgrade=await db.query("SELECT version,cad_unit,cruiser_number,district_token FROM agency_training.operational_profiles");
    assert.deepEqual(clearedUpgrade.rows,[{version:3,cad_unit:"9150E",cruiser_number:"9150",district_token:"9150"}]);
    assert.deepEqual(await db.query("SELECT report FROM agency_training.historical_test"),before);
  }finally{await db.close();}
});
