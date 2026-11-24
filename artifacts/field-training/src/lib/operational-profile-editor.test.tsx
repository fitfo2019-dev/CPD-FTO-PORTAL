import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import type { OperationalProfileContext } from "@workspace/api-client-react";
import { parseOperationalIdentity } from "@workspace/api-zod/operational-profile";
import { OperatorFacingError } from "./operator-errors.js";

test("approved account editor validates own-profile saves, preserves conflicts, reloads and supports PO identity",async()=>{
  const dom=new JSDOM("<div id='root'></div>",{url:"https://localhost/settings",pretendToBeVisual:true});
  const previous=new Map<string,PropertyDescriptor|undefined>();
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
    HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,Node:dom.window.Node,
    Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true})){
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  const {createRoot}=await import("react-dom/client");
  const {OperationalProfileStateContext}=await import("../state/operational-profile.js");
  const {OperationalProfilePanel}=await import("../components/operational-profile-panel.js");
  let profile:OperationalProfileContext={subject:"TEST-FTO",role:"FTO",badge:"TEST-BADGE",version:1,identity:parseOperationalIdentity("9150E-1")};
  let saved=structuredClone(profile);
  let error:string|undefined;
  let failures=false,writes=0;
  const root=createRoot(dom.window.document.getElementById("root")!);
  const save=async(token:string,version:number)=>{
    writes++;
    if(failures)throw new OperatorFacingError("This assignment changed elsewhere. Reload the saved assignment before retrying.");
    assert.equal(version,saved.version);
    saved={...saved,identity:parseOperationalIdentity(token),version:version+1};
    profile=structuredClone(saved);
    return saved;
  };
  const refresh=async()=>{profile=structuredClone(saved);error=undefined;return profile;};
  const render=()=>root.render(<OperationalProfileStateContext.Provider value={{
    profile:error?undefined:profile,editorProfile:profile,pending:false,error,contextKey:`${profile.subject}:${profile.version}`,save,refresh,
  }}><OperationalProfilePanel/></OperationalProfileStateContext.Provider>);
  function element<T extends HTMLElement=HTMLElement>(id:string){
    const node=dom.window.document.querySelector<T>(`[data-testid="${id}"]`);assert.ok(node,id);return node;
  }
  async function input(value:string){
    await act(async()=>{
      const node=element<HTMLInputElement>("input-operational-assignment");
      node.focus();
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,"value")!.set!.call(node,value);
      node.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
    });
  }
  const submit=()=>act(async()=>element("form-operational-profile").dispatchEvent(new dom.window.Event("submit",{bubbles:true,cancelable:true})));
  try{
    await act(async()=>render());
    assert.equal(element("text-profile-cruiser").textContent,"9150");
    assert.equal(element("text-profile-cad").textContent,"9150E");
    assert.equal(dom.window.document.querySelectorAll("select").length,0,"Signed roles are not editable");
    await input("9150E-3");await submit();
    assert.equal(writes,0);
    assert.match(element("text-profile-error").textContent!,/side -1 or -2/);
    await input("1234A-2");await submit();await act(async()=>render());
    assert.equal(writes,1);
    assert.equal(saved.identity?.assignmentToken,"1234A-2");
    assert.match(element("text-profile-saved").textContent!,/future packets only/);
    assert.equal(element("text-profile-cruiser").textContent,"1234");
    assert.equal(element("text-profile-cad").textContent,"1234A");

    failures=true;await input("5678B-1");await submit();
    assert.equal(saved.identity?.assignmentToken,"1234A-2");
    assert.equal(element<HTMLInputElement>("input-operational-assignment").value,"5678B-1");
    assert.match(element("text-profile-error").textContent!,/changed elsewhere/);
    assert.equal(element<HTMLButtonElement>("button-save-operational-profile").disabled,true,"Unconfirmed saves require an explicit reload before retry");
    error="Agency storage unavailable";await act(async()=>render());
    assert.equal(element<HTMLInputElement>("input-operational-assignment").value,"5678B-1","Unavailable refresh does not discard typed edits");
    assert.equal(element<HTMLButtonElement>("button-save-operational-profile").disabled,true);
    await act(async()=>element("button-reload-operational-profile").click());await act(async()=>render());
    assert.equal(element<HTMLInputElement>("input-operational-assignment").value,"1234A-2");
    assert.equal(dom.window.document.querySelector('[data-testid="text-profile-error"]'),null);

    await input("2222C-1");
    profile={...profile,version:9,identity:parseOperationalIdentity("9999D-2")};
    await act(async()=>render());
    assert.equal(element<HTMLInputElement>("input-operational-assignment").value,"2222C-1");
    assert.equal(element<HTMLButtonElement>("button-save-operational-profile").disabled,true);

    profile={subject:"TEST-PO",role:"PO",badge:"PO-BADGE",version:0,identity:null};saved=structuredClone(profile);failures=false;
    await act(async()=>render());
    assert.equal(element<HTMLInputElement>("input-operational-assignment").value,"","Account switch discards the prior account editor state");
    assert.match(element("text-profile-role").textContent!,/Probationary Officer/);
    await input("9150E-2");await submit();await act(async()=>render());
    assert.equal(saved.subject,"TEST-PO");
    assert.equal(saved.version,1);
    assert.equal(saved.identity?.cadUnit,"9150E");
  }finally{
    await act(async()=>root.unmount());dom.window.close();
    for(const [key,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);
  }
});
