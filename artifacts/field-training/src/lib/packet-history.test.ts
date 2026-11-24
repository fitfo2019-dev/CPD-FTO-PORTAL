import assert from "node:assert/strict";
import test from "node:test";
import { createDailyReportDraft } from "./daily-report-draft.js";
import { createUiPreviewWorkspace } from "./empty-workspace.js";
import { createSharedPacketHistory, continueSharedPacketHistory, PacketHistoryCursorError,
  readSharedPackets, readSharedPacketsPage } from "./packet-history.js";

function packet(date:string) {
  const report=createDailyReportDraft(createUiPreviewWorkspace().caseFolder!,date);
  return {id:report.id,assignment_id:"81dc3739-03c3-4cc1-bc9c-851bba10e833",
    record_date:date,phase:report.phase,server_version:1,sync_status:"submitted_complete",
    report,content_hash:"a".repeat(64),released_to_po:false,released_at:null,withdrawn_at:null,
    withdrawal_reason:null,amendment_of:null,amendment_reason:null,acknowledgment:null};
}
function response(data:unknown[],hasMore=false,cursor:string|null=null) {
  return new Response(JSON.stringify({status:"success",metadata:{total_records:data.length,role:"FTO",
    has_more:hasMore,next_cursor:cursor},data}),{headers:{"content-type":"application/json"}});
}
test("shared packet reads retain bounded continuation and stop at the real end",async t=>{
  const first=packet("2026-11-23"),second=packet("2026-11-22");
  const urls:string[]=[];
  t.mock.method(globalThis,"fetch",async(input:string|URL|Request)=>{
    const url=String(input);urls.push(url);
    return url.includes("?cursor=")?response([second]):response([first],true,"page-two");
  });
  const page=await readSharedPacketsPage();
  assert.equal(page.hasMore,true);assert.equal(page.nextCursor,"page-two");
  assert.deepEqual((await readSharedPackets()).map(item=>item.id),[first.id,second.id]);
  assert.deepEqual(urls,["/api/v1/training-packets","/api/v1/training-packets",
    "/api/v1/training-packets?cursor=page-two"]);
});
test("filtered history resumes a failed page without losing records or changing filters",async t=>{
  const first=packet("2026-11-23"),second=packet("2026-11-22");
  const urls:string[]=[];let attempts=0;
  t.mock.method(globalThis,"fetch",async(input:string|URL|Request,init?:RequestInit)=>{
    const url=String(input);urls.push(url);assert.equal(init?.body,undefined);
    assert.equal(init?.method??"GET","GET");
    if(!url.includes("cursor="))return response([first],true,"page-two");
    if(attempts++===0)throw new TypeError("temporary network failure");
    return response([second]);
  });
  const history=createSharedPacketHistory({recruit:"Alex Rivera",dateFrom:"2026-11-01",dateTo:"2026-11-30"});
  await continueSharedPacketHistory(history,undefined,undefined,1);
  await assert.rejects(continueSharedPacketHistory(history,undefined,undefined,1),TypeError);
  assert.deepEqual(history.data.map(item=>item.id),[first.id]);assert.equal(history.nextCursor,"page-two");
  await continueSharedPacketHistory(history,undefined,undefined,1);
  assert.deepEqual(history.data.map(item=>item.id),[first.id,second.id]);assert.equal(history.complete,true);
  assert.equal(urls[1],urls[2]);
  assert.equal(urls[2],"/api/v1/training-packets?cursor=page-two&recruit=Alex+Rivera&date_from=2026-11-01&date_to=2026-11-30");
});
for(const invalid of ["page-two","   ","c".repeat(257)]) {
  test(`unsafe history continuation preserves confirmed records (${invalid.length})`,async t=>{
    const first=packet("2026-11-23"),second=packet("2026-11-22");
    t.mock.method(globalThis,"fetch",async(input:string|URL|Request)=>
      String(input).includes("cursor=")?response([second],true,invalid):response([first],true,"page-two"));
    const history=createSharedPacketHistory();
    await assert.rejects(continueSharedPacketHistory(history),PacketHistoryCursorError);
    assert.deepEqual(history.data.map(item=>item.id),[first.id]);
    assert.equal(history.nextCursor,"page-two");assert.equal(history.blocked,true);
  });
}
test("oversized first-page cursor cannot append an unconfirmed page",async t=>{
  t.mock.method(globalThis,"fetch",async()=>response([packet("2026-11-23")],true,"c".repeat(257)));
  const history=createSharedPacketHistory();
  await assert.rejects(continueSharedPacketHistory(history),PacketHistoryCursorError);
  assert.equal(history.data.length,0);assert.equal(history.blocked,true);
});
