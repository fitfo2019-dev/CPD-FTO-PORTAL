import assert from "node:assert/strict";
import test from "node:test";
import {
  getOperationalProfile, updateOperationalProfile, getPacketReviewContext,
  customFetch,
} from "@workspace/api-client-react";
import { parseOperationalIdentity } from "@workspace/api-zod/operational-profile";

const profile={subject:"TEST-FTO",role:"FTO",badge:"TEST",version:1,
  identity:parseOperationalIdentity("9150E-1"),updatedAt:"2026-11-24T14:00:00.000Z"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
test("generated profile clients accept the real documented raw GET/PUT responses, not artificial envelope fixtures",async t=>{
  const calls:{url:string;method:string;body:unknown}[]=[];
  t.mock.method(globalThis,"fetch",async(input:string|URL|Request,init?:RequestInit)=>{
    calls.push({url:String(input),method:init?.method??"GET",body:init?.body?JSON.parse(String(init.body)):undefined});
    return json(profile);
  });
  assert.deepEqual(await getOperationalProfile(),profile);
  assert.deepEqual(await updateOperationalProfile({assignmentToken:"9150E-1",expectedVersion:0}),profile);
  assert.deepEqual(calls,[
    {url:"/api/v1/account/operational-profile",method:"GET",body:undefined},
    {url:"/api/v1/account/operational-profile",method:"PUT",body:{assignmentToken:"9150E-1",expectedVersion:0}},
  ]);
});
test("profile response validation rejects incomplete, wrapped or forged-derived objects without weakening other API routes",async t=>{
  let body:unknown={};
  t.mock.method(globalThis,"fetch",async()=>json(body));
  for(const invalid of [{},{...profile,subject:undefined},{...profile,version:-1},
    {...profile,identity:{...profile.identity,cadUnit:"WRONG"}},
    {...profile,identity:{assignmentToken:"9150E-1",cruiserNumber:"9150",cadUnit:"9150E",company:"E",side:"1"}},
    {status:"success",metadata:{},data:[profile]}]){
    body=invalid;await assert.rejects(getOperationalProfile(),/documented contract/);
  }
  body=profile;await assert.rejects(customFetch("/api/healthz"),/success envelope/);
  await assert.rejects(customFetch("/api/v1/account/operational-profile-not-a-real-route"),/success envelope/);
  await assert.rejects(customFetch("/api/v1/account/operational-profile",{method:"POST"}),/success envelope/);
  body={status:"success",metadata:{},data:[{status:"ok"}]};
  assert.deepEqual(await customFetch("/api/healthz"),body);
});
test("packet review context keeps its actual object contract through the shared generated transport",async t=>{
  const context={available:true,account_id:profile.subject,role:"FTO",coordinators:[],assignments:[],pending_count:0,pending:null};
  t.mock.method(globalThis,"fetch",async()=>json(context));
  assert.deepEqual(await getPacketReviewContext(),context);
});
test("refreshed unsided profile stays unsided through the actual generated GET and PUT clients",async t=>{
  const unsided={...profile,version:2,identity:parseOperationalIdentity("9150E")};
  t.mock.method(globalThis,"fetch",async()=>json(unsided));
  for(const result of [await getOperationalProfile(),await updateOperationalProfile({assignmentToken:"9150E",expectedVersion:1})]) {
    assert.deepEqual(result,unsided);
    assert.equal("side" in result.identity!,false);
    assert.equal("cruiserNumber" in result.identity!,false);
  }
});
