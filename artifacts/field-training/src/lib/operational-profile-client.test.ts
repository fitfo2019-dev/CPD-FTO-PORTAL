import assert from "node:assert/strict";
import test from "node:test";
import {
  getOperationalProfile, updateOperationalProfile, getOperationalProfileHistory, getPacketReviewContext,
  customFetch,
} from "@workspace/api-client-react";
import { parseOperationalIdentity } from "@workspace/api-zod/operational-profile";

const profile={subject:"TEST-FTO",role:"FTO",badge:"TEST",version:1,
  identity:parseOperationalIdentity("9150E-1"),updatedAt:"2026-11-24T14:00:00.000Z"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
test("generated history client uses own-account paginated object contract and rejects malformed responses",async t=>{
  const entry={version:2,oldToken:"9150E-1",newToken:"9150E",recordedAt:"2026-11-25T06:10:00.000Z",actor:"self",event:"changed"};
  const history={subject:profile.subject,entries:[entry],nextBeforeVersion:null};
  let body:unknown=history;
  const urls:string[]=[];
  t.mock.method(globalThis,"fetch",async(input:string|URL|Request)=>{
    urls.push(String(input));return json(body);
  });
  assert.deepEqual(await getOperationalProfileHistory(),history);
  assert.deepEqual(await getOperationalProfileHistory({beforeVersion:3}),history);
  assert.deepEqual(urls,["/api/v1/account/operational-profile/history","/api/v1/account/operational-profile/history?beforeVersion=3"]);
  for(const invalid of [{},{...history,entries:[{...entry,recordedAt:"invalid"}]},
    {...history,entries:[{...entry,actor:"unverified"}]}, {...history,nextBeforeVersion:-1},
    {status:"success",metadata:{},data:[history]}]){
    body=invalid;await assert.rejects(getOperationalProfileHistory(),/documented contract/);
  }
  body=history;
  await assert.rejects(customFetch("/api/v1/account/operational-profile/history",{method:"POST"}),/success envelope/);
});
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

test("generated save client never retries an unconfirmed write and preserves stale-version conflicts",async t=>{
  const calls:{method:string;body:unknown}[]=[];
  const lostResponse=new TypeError("FICTIONAL response lost after commit");
  let loseResponse=true;
  const committed={...profile,version:2,identity:parseOperationalIdentity("9150E")};
  t.mock.method(globalThis,"fetch",async(_input:unknown,init?:RequestInit)=>{
    const method=init?.method??"GET";
    calls.push({method,body:init?.body?JSON.parse(String(init.body)):undefined});
    if(method==="GET")return json(committed);
    if(loseResponse){loseResponse=false;throw lostResponse;}
    return json({error:"PROFILE_VERSION_CONFLICT"},409);
  });
  const stale={assignmentToken:"9150E",expectedVersion:1};
  await assert.rejects(updateOperationalProfile(stale),error=>error===lostResponse);
  assert.deepEqual(calls,[{method:"PUT",body:stale}]);
  assert.deepEqual(await getOperationalProfile(),committed);
  await assert.rejects(updateOperationalProfile(stale),{status:409});
  assert.deepEqual(calls,[
    {method:"PUT",body:stale},{method:"GET",body:undefined},{method:"PUT",body:stale},
  ]);
});
