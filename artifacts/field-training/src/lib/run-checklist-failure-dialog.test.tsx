import assert from 'node:assert/strict';
import test from 'node:test';
import { act, useState } from 'react';
import { JSDOM } from 'jsdom';

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/',pretendToBeVisual:true});
const globals:Record<string,unknown>={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
  HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,Node:dom.window.Node,
  NodeFilter:dom.window.NodeFilter,MutationObserver:dom.window.MutationObserver,CustomEvent:dom.window.CustomEvent,
  getComputedStyle:dom.window.getComputedStyle.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
const originals=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
const {createRoot}=await import('react-dom/client');
const {RunChecklistFailureDialog}=await import('../components/run-checklist-failure-dialog.js');

test.after(()=>{
  dom.window.close();
  for(const [key,descriptor] of originals){
    if(descriptor)Object.defineProperty(globalThis,key,descriptor);
    else Reflect.deleteProperty(globalThis,key);
  }
});
function element<T extends HTMLElement=HTMLElement>(id:string){
  const node=document.querySelector<T>(`[data-testid="${id}"]`);assert.ok(node,id);return node;
}

test('specific failure dialog requires a selection and cancel leaves the checked item unchanged',async()=>{
  let checked=true;
  let saved:string[]=[];
  let cancelled=0;
  function Harness(){
    const [open,setOpen]=useState(true);
    const [selected,setSelected]=useState<string[]>([]);
    return <RunChecklistFailureDialog open={open} parentLabel="Obtained the proper documentation, identification, information"
      choices={['Obtained the proper documentation','Obtained identification','Gathered relevant information']}
      selected={selected} mode="clear" onSelectedChange={setSelected}
      onCancel={()=>{cancelled++;setOpen(false);}}
      onConfirm={()=>{checked=false;saved=selected;setOpen(false);}}/>;
  }
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<Harness/>));
    const dialog=document.querySelector('[role="dialog"]');
    assert.ok(dialog);
    assert.ok(dialog.getAttribute('aria-labelledby'));
    assert.ok(dialog.getAttribute('aria-describedby'));
    assert.match(dialog.textContent??'',/Identify Specific Actions Not Completed/);
    assert.equal(element('button-confirm-run-failure').hasAttribute('disabled'),true);
    await act(async()=>element('checkbox-run-failure-action-1').click());
    assert.equal(element('button-confirm-run-failure').hasAttribute('disabled'),false);
    assert.match(element('status-run-failure-selection').textContent??'',/1 action selected/);
    await act(async()=>element('button-cancel-run-failure').click());
    assert.equal(checked,true);
    assert.deepEqual(saved,[]);
    assert.ok(cancelled>=1);
    assert.equal(document.querySelector('[role="dialog"]'),null);
  }finally{await act(async()=>root.unmount());host.remove();}
});

test('confirm persists only the selected action strings',async()=>{
  let saved:string[]=[];
  function Harness(){
    const [open,setOpen]=useState(true);
    const [selected,setSelected]=useState<string[]>([]);
    return <RunChecklistFailureDialog open={open} parentLabel="Gapped/Double locked handcuffs"
      choices={['Gapped the handcuffs','Double-locked the handcuffs']}
      selected={selected} mode="clear" onSelectedChange={setSelected}
      onCancel={()=>setOpen(false)}
      onConfirm={()=>{saved=[...selected];setOpen(false);}}/>;
  }
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<Harness/>));
    await act(async()=>element('checkbox-run-failure-action-0').click());
    await act(async()=>element('checkbox-run-failure-action-1').click());
    await act(async()=>element('button-confirm-run-failure').click());
    assert.deepEqual(saved,['Gapped the handcuffs','Double-locked the handcuffs']);
    assert.equal(document.querySelector('[role="dialog"]'),null);
  }finally{await act(async()=>root.unmount());host.remove();}
});

test('reopened failure details are preselected and can be amended',async()=>{
  let saved:string[]=[];
  function Harness(){
    const [open,setOpen]=useState(true);
    const [selected,setSelected]=useState<string[]>(['Gapped the handcuffs']);
    return <RunChecklistFailureDialog open={open} parentLabel="Gapped/Double locked handcuffs"
      choices={['Gapped the handcuffs','Double-locked the handcuffs']}
      selected={selected} mode="edit" onSelectedChange={setSelected}
      onCancel={()=>setOpen(false)}
      onConfirm={()=>{saved=[...selected];setOpen(false);}}/>;
  }
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<Harness/>));
    assert.equal(element<HTMLInputElement>('checkbox-run-failure-action-0').checked,true);
    assert.equal(element('button-confirm-run-failure').textContent,'Save Failure Details');
    await act(async()=>element('checkbox-run-failure-action-1').click());
    await act(async()=>element('button-confirm-run-failure').click());
    assert.deepEqual(saved,['Gapped the handcuffs','Double-locked the handcuffs']);
  }finally{await act(async()=>root.unmount());host.remove();}
});
