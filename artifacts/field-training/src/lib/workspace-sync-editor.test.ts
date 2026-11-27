import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import {act,createElement} from "react";
import {JSDOM} from "jsdom";
import { registerHooks } from "node:module";
import {createDailyReportDraft} from "./daily-report-draft.js";
import {createUiPreviewWorkspace} from "./empty-workspace.js";
import {OfflineStorage} from "./offlineStorage.js";
import {createFtoTestPacketWorkspace} from "./test-packet.js";
import {CATEGORIES,type Workspace} from "./model.js";

registerHooks({
  load(url,ctx,next){if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default {}'};if(url.includes('/components/printable-columbus-header.tsx'))return {format:'module',shortCircuit:true,source:'export function PrintableColumbusHeader(){return null} export function PrintableColumbusFooterMarks(){return null}'};return next(url,ctx)},
});

test("a deferred automatic sync preserves the mounted editor and saves newly typed narrative and run edits",async t=>{
  const dom=new JSDOM("<!doctype html><div id='root'></div>",{
    pretendToBeVisual:true,url:"https://localhost/reports/test#shift-narrative",
  });
  Object.defineProperty(dom.window.navigator,"onLine",{configurable:true,value:false});
  const previous=new Map<string,PropertyDescriptor|undefined>();
  for(const [key,value] of Object.entries({
    window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
    HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT:true,
  })){
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  // Load the browser renderer after installing the DOM so native input events
  // take the same onChange path as they do in the mounted application.
  const {createRoot}=await import("react-dom/client");
  const {Router,Route}=await import("wouter");
  const {WorkspaceProvider,useWorkspace}=await import("../state/workspace.js");
  const {PacketReviewStateContext}=await import("../state/packet-review.js");
  const {default:ReportEditor}=await import("../pages/report-editor.js");
  const report=createDailyReportDraft(createUiPreviewWorkspace().caseFolder!,"2026-11-23");
  const run=createFtoTestPacketWorkspace().reports.flatMap(report=>report.runs)[0];
  report.runs=[{...run,occurredAt:"2026-11-23T14:00:00Z",dispatchedAt:undefined,endedAt:undefined,
    narrative:"Original fictional run",narrativeAdditionRequired:false}];
  const namespace=`sync-editor-${crypto.randomUUID()}`;
  let current:ReturnType<typeof useWorkspace>|undefined;
  let showEditor=false;
  let acknowledge:((value:Response)=>void)|undefined;
  let syncBody="";
  let requests=0;
  t.mock.method(globalThis,"fetch",async(input:string|URL|Request,init?:RequestInit)=>{
    assert.ok(String(input).endsWith("/sync"));
    requests++;
    syncBody=String(init?.body);
    return new Promise<Response>(resolve=>{acknowledge=resolve;});
  });
  function Probe(){
    current=useWorkspace();
    return showEditor?createElement(PacketReviewStateContext.Provider,{
      value:{loading:false,error:null,previewOnly:false,refresh:async()=>{},
        act:async()=>{throw new Error("Review is not part of this editor test");},
        assign:async()=>{},finalizeReport:async()=>{throw new Error("Draft sync must never finalize");},
        openCorrection:async()=>{}},
      children:createElement(Router,{hook:()=>[`/reports/${report.id}`,()=>{}] as [string,()=>void],
        children:createElement(Route,{key:current.epoch,path:"/reports/:id",component:ReportEditor})})}):null;
  }
  const root=createRoot(dom.window.document.getElementById("root")!);
  const render=()=>root.render(createElement(WorkspaceProvider,{storageNamespace:namespace,
    authSession:{accountId:"FICTIONAL-FTO",sessionId:"FICTIONAL-SESSION"},validateSession:async()=>{},
    children:createElement(Probe)}));
  const element=<T extends Element>(id:string)=>{
    const found=dom.window.document.querySelector<T>(`[data-testid="${id}"]`);
    assert.ok(found,`missing ${id}`);return found;
  };
  try{
    await act(async()=>{render();});
    await act(async()=>{await current!.setupAndSave("fictional-slow-sync-editor-test");});
    await act(async()=>{current!.upsertReport(report);});
    await act(async()=>{await current!.saveNow();showEditor=true;render();});
    const narrative=element<HTMLTextAreaElement>("input-narrative");
    const epoch=current!.epoch;
    Object.defineProperty(dom.window.navigator,"onLine",{configurable:true,value:true});
    await act(async()=>{dom.window.dispatchEvent(new dom.window.Event("online"));});
    for(let n=0;n<30&&!acknowledge;n++)
      await act(async()=>{await new Promise(resolve=>setTimeout(resolve,25));});
    assert.ok(acknowledge,"automatic sync should be waiting for its response");
    assert.equal(current!.packetSyncState,"uploading");
    const text="Fictional narrative typed while the saved draft is uploading";
    await act(async()=>{
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,"value")!.set!.call(narrative,text);
      narrative.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
    });
    assert.equal(current!.editorDirty,true,"real input must update the mounted editor");
    await act(async()=>{element<HTMLButtonElement>("button-stage-runs").click();});
    await act(async()=>{element<HTMLButtonElement>(`button-edit-run-${run.id}`).click();});
    await act(async()=>{element<HTMLButtonElement>("button-run-step-finish").click();});
    const runNarrative=element<HTMLTextAreaElement>("input-run-narrative");
    const runText="Fictional run edit typed during the same slow synchronization";
    await act(async()=>{
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,"value")!.set!.call(runNarrative,runText);
      runNarrative.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
    });
    const packets=JSON.parse(syncBody).packets as Array<{operation_id:string;report:{id:string}}>;
    await act(async()=>{acknowledge!(new Response(JSON.stringify({
      status:"success",metadata:{total_records:packets.length,role:"FTO"},
      data:packets.map(packet=>({id:packet.report.id,operation_id:packet.operation_id,
        server_version:1,sync_status:"local_draft_pending",content_hash:"a".repeat(64)})),
    }),{headers:{"content-type":"application/json"}}));});
    for(let n=0;n<30&&String(current!.packetSyncState)!=="synchronized";n++)
      await act(async()=>{await new Promise(resolve=>setTimeout(resolve,25));});
    assert.equal(current!.epoch,epoch,"receipts must not remount the route");
    assert.equal(element("input-run-narrative"),runNarrative,"the same run form must remain mounted");
    assert.equal(runNarrative.value,runText);
    assert.equal(current!.editorDirty,true);
    Object.defineProperty(dom.window.navigator,"onLine",{configurable:true,value:false});
    await act(async()=>{dom.window.dispatchEvent(new dom.window.Event("offline"));});
    await act(async()=>{element<HTMLButtonElement>("button-save-run").click();});
    assert.equal(dom.window.document.querySelector('[data-testid="text-run-error"]'),null);
    await act(async()=>{element<HTMLButtonElement>("button-stage-finish").click();});
    assert.equal(element<HTMLTextAreaElement>("input-narrative").value,text);
    await act(async()=>{element<HTMLButtonElement>("button-save-draft").click();});
    assert.equal(current!.ws.reports[0].narrative,text);
    assert.equal(current!.ws.reports[0].runs[0].narrative,runText);
    await act(async()=>{await current!.saveNow();});
    const reopened=new OfflineStorage(namespace);
    await reopened.unlock(new TextEncoder().encode("fictional-slow-sync-editor-test"));
    const saved=(await reopened.get<{reports:Array<{narrative:string;runs:Array<{narrative:string}>}>}>("workspace"))!;
    assert.equal(saved.reports[0].narrative,text);
    assert.equal(saved.reports[0].runs[0].narrative,runText);
    reopened.lock();
    assert.equal(requests,1,"editing during draft sync must never trigger finalization");
  }finally{
    await act(async()=>root.unmount());dom.window.close();
    for(const [key,descriptor] of previous){
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);
      else Reflect.deleteProperty(globalThis,key);
    }
    t.mock.restoreAll();
  }
});

for(const outcome of ["success","lost-response"] as const) {
  test(`finalization locks the mounted editor immediately and survives vault reopening (${outcome})`,async t=>{
    const dom=new JSDOM("<!doctype html><div id='root'></div>",{
      pretendToBeVisual:true,url:"https://localhost/reports/test#shift-narrative",
    });
    Object.defineProperty(dom.window.navigator,"onLine",{configurable:true,value:false});
    const previous=new Map<string,PropertyDescriptor|undefined>();
    for(const [key,value] of Object.entries({
      window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
      HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true,
    })){
      previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
      Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    }
    const {createRoot}=await import("react-dom/client");
    const {Router,Route}=await import("wouter");
    const {WorkspaceProvider,useWorkspace}=await import("../state/workspace.js");
    const {PacketReviewStateContext}=await import("../state/packet-review.js");
    const {default:ReportEditor}=await import("../pages/report-editor.js");
    const report=createDailyReportDraft(createUiPreviewWorkspace().caseFolder!,"2026-11-23");
    report.shiftStartTime="07:00";
    report.reportingForDuty.reviewedAt="2026-11-23T17:00:00Z";
    report.ratingsReviewedAt="2026-11-23T17:00:00Z";
    for(const category of CATEGORIES)report.ratings[category].rating="A";
    const namespace=`finalize-editor-${crypto.randomUUID()}`,passphrase="fictional-finalization-recovery-test";
    let current:ReturnType<typeof useWorkspace>|undefined,showEditor=false;
    let resolveResponse:((value:Response)=>void)|undefined,rejectResponse:((error:Error)=>void)|undefined;
    const bodies:string[]=[];
    let finalizationRequest:{operation_id:string;content_hash:string}|undefined;
    function success(data:unknown) {
      return new Response(JSON.stringify({status:"success",metadata:{total_records:1,role:"FTO"},data}),
        {headers:{"content-type":"application/json"}});
    }
    function finalized(){
      return new Response(JSON.stringify({id:report.id,operation_id:finalizationRequest!.operation_id,
        server_version:1,sync_status:"submitted_complete",content_hash:finalizationRequest!.content_hash}),
        {headers:{"content-type":"application/json"}});
    }
    t.mock.method(globalThis,"fetch",async(input:string|URL|Request,init?:RequestInit)=>{
      if(String(input).endsWith("/sync")){
         const packet=JSON.parse(String(init?.body)).packets[0];
        return success([{id:report.id,operation_id:packet.operation_id,server_version:1,
          sync_status:"local_draft_pending",content_hash:"a".repeat(64)}]);
      }
       assert.ok(String(input).endsWith("/finalize"));bodies.push(String(init?.body));
       finalizationRequest=JSON.parse(String(init?.body)) as {operation_id:string;content_hash:string};
      if(bodies.length>1)return finalized();
      return new Promise<Response>((resolve,reject)=>{resolveResponse=resolve;rejectResponse=reject;});
    });
    function Probe(){
      current=useWorkspace();
      return showEditor?createElement(PacketReviewStateContext.Provider,{
        value:{loading:false,error:null,previewOnly:false,refresh:async()=>{},assign:async()=>{},
          act:async()=>{throw new Error("Not used");},finalizeReport:async()=>{},openCorrection:async()=>{}},
        children:createElement(Router,{hook:()=>[`/reports/${report.id}`,()=>{}] as [string,()=>void],
          children:createElement(Route,{key:current.epoch,path:"/reports/:id",component:ReportEditor})})}):null;
    }
    const container=dom.window.document.getElementById("root")!;
    let root=createRoot(container);
    const render=()=>root.render(createElement(WorkspaceProvider,{storageNamespace:namespace,
      authSession:{accountId:"FICTIONAL-FTO",sessionId:"FICTIONAL-SESSION"},validateSession:async()=>{},
      children:createElement(Probe)}));
    const narrative=()=>dom.window.document.querySelector<HTMLTextAreaElement>('[data-testid="input-narrative"]')!;
    try{
      await act(async()=>{render();});
      await act(async()=>{await current!.setupAndSave(passphrase);});
      await act(async()=>{current!.upsertReport(report);});
      await act(async()=>{await current!.saveNow();showEditor=true;render();});
      Object.defineProperty(dom.window.navigator,"onLine",{configurable:true,value:true});
      await act(async()=>{dom.window.dispatchEvent(new dom.window.Event("online"));});
      for(let n=0;n<40&&current!.ws.reports[0].draftSyncPending!==false;n++)
        await act(async()=>{await new Promise(resolve=>setTimeout(resolve,25));});
      assert.equal(current!.ws.reports[0].draftSyncPending,false);
      assert.equal(current!.editorDirty,false);
      assert.equal("legacyActivity" in JSON.parse(JSON.stringify(current!.ws.reports[0])),false);
      const input=narrative(),epoch=current!.epoch;
      assert.equal(input.disabled,false);
      let attempt:Promise<unknown>;
      await act(async()=>{attempt=current!.finalizePacket(report.id).catch(error=>error);});
      assert.equal(narrative(),input);
      assert.equal(input.disabled,true,"the guard must reach the mounted editor before transmission");
      assert.equal(current!.ws.reports[0].finalizationAttemptPending,true);
      for(let n=0;n<40&&!resolveResponse;n++)
        await act(async()=>{await new Promise(resolve=>setTimeout(resolve,25));});
      assert.ok(resolveResponse);
      await act(async()=>{
        if(outcome==="success")resolveResponse!(finalized());
        else rejectResponse!(new Error("Server committed but response was lost"));
        const result=await attempt!;
        if(outcome==="lost-response")assert.ok(result instanceof Error);
        else assert.equal(result,undefined);
      });
      assert.equal(current!.epoch,epoch,"finalization must not remount an editor");
      assert.equal(narrative(),input);
      assert.equal(input.disabled,true);
      const protectedSnapshot=JSON.parse(JSON.stringify(current!.ws.reports[0]));
      await act(async()=>{current!.lockNow();});
      await act(async()=>root.unmount());
      root=createRoot(container);showEditor=false;
      await act(async()=>{render();});
      await act(async()=>{await current!.unlockAndRestore(passphrase);});
      assert.deepEqual(JSON.parse(JSON.stringify(current!.ws.reports[0])),protectedSnapshot);
      await act(async()=>{await current!.saveNow();});
      assert.equal(current!.dirty,false);
      if(outcome==="lost-response"){
        await act(async()=>{await current!.finalizePacket(report.id);});
        assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1],"retry must reuse the saved operation and hash");
      }
      assert.equal(current!.ws.reports[0].syncStatus,"submitted_complete");
      const reopened=new OfflineStorage(namespace);
      await reopened.unlock(new TextEncoder().encode(passphrase));
      assert.equal((await reopened.get<Workspace>("workspace"))!.reports[0].syncStatus,"submitted_complete");
      reopened.lock();
    }finally{
      await act(async()=>root.unmount());dom.window.close();
      for(const [key,descriptor] of previous){
        if(descriptor)Object.defineProperty(globalThis,key,descriptor);
        else Reflect.deleteProperty(globalThis,key);
      }
      t.mock.restoreAll();
    }
  });
}
