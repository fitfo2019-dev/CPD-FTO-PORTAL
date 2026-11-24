import assert from "node:assert/strict";
import test from "node:test";
import React, {act} from "react";
import {JSDOM} from "jsdom";
import {parseOperationalIdentity} from "@workspace/api-zod/operational-profile";
import type {DispatchPrefillDraft} from "./dispatch-prefill.js";

test("event hook aborts former profile/account requests and preserves manual corrections",async t=>{
  const dom=new JSDOM("<div id='root'></div>",{url:"https://localhost/",pretendToBeVisual:true});
  const previous=new Map<string,PropertyDescriptor|undefined>();
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,
    navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT:true})){
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  }
  const {createRoot}=await import("react-dom/client");
  const {OperationalProfileStateContext}=await import("../state/operational-profile.js");
  const {usePatrolViewSync}=await import("../hooks/use-patrolview-sync.js");
  const {applyDispatchPrefill}=await import("./dispatch-prefill.js");
  type Pending={resolve:(response:Response)=>void;signal:AbortSignal;body:{eventId:string;cadUnit:string}};
  const pending:Pending[]=[];
  t.mock.method(globalThis,"fetch",async(_input:unknown,init?:RequestInit)=>new Promise<Response>(resolve=>{
    pending.push({resolve,signal:init!.signal as AbortSignal,body:JSON.parse(String(init?.body))});
  }));
  let value={profile:{subject:"TEST-A",role:"FTO" as "FTO"|"PO",badge:"TEST",version:1,identity:parseOperationalIdentity("9150E-1")},pending:false,contextKey:"TEST-A:1"};
  let current:DispatchPrefillDraft={incidentNumber:"",runDateTimeText:"",runTimeText:"",runLocation:"",runLocationCity:"",runLocationState:"",runLocationZip:"",runZone:"",runCruiserDistrict:"",dispatchedCode:"",clearanceCode:""};
  let callbacks=0;
  function Probe(){
    usePatrolViewSync({eventId:"TEST",enabled:true,draft:current,onPrefill:(initial,prefill)=>{
      callbacks++;current=applyDispatchPrefill(current,initial,prefill);
    }});
    return null;
  }
  const root=createRoot(dom.window.document.getElementById("root")!);
  const render=()=>root.render(<OperationalProfileStateContext.Provider value={value}><Probe/></OperationalProfileStateContext.Provider>);
  const reply=(location:string)=>new Response(JSON.stringify({status:"success",metadata:{total_records:1},data:[{location}]}),{status:200,headers:{"Content-Type":"application/json"}});
  try{
    await act(async()=>render());
    assert.equal(pending[0].body.cadUnit,"9150E");
    current={...current,runLocation:"MANUAL CORRECTION"};
    value={...value,profile:{...value.profile,version:2,identity:parseOperationalIdentity("1234A-2")},contextKey:"TEST-A:2"};
    await act(async()=>render());
    assert.equal(pending[0].signal.aborted,true);
    assert.equal(pending[1].body.cadUnit,"1234A");
    await act(async()=>{pending[0].resolve(reply("STALE FORMER PROFILE"));});
    assert.equal(callbacks,0);
    value={...value,profile:{...value.profile,subject:"TEST-B"},contextKey:"TEST-B:2"};
    await act(async()=>render());
    assert.equal(pending[1].signal.aborted,true);
    await act(async()=>{pending[1].resolve(reply("STALE FORMER ACCOUNT"));});
    assert.equal(callbacks,0);
    await act(async()=>{pending[2].resolve(reply("NEW AUTOMATIC LOCATION"));});
    assert.equal(callbacks,1);
    assert.equal(current.runLocation,"MANUAL CORRECTION");
    value={...value,profile:{...value.profile,role:"PO"},contextKey:"TEST-B:3"};
    await act(async()=>render());
    assert.equal(pending.length,3,"PO profile does not request the FTO vehicle's dispatch context");
  }finally{
    await act(async()=>root.unmount());
    dom.window.close();
    for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);
  }
});
