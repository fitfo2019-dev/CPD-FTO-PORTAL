import assert from 'node:assert/strict';
import test from 'node:test';
import {act,useState} from 'react';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/',pretendToBeVisual:true});
const globals:Record<string,unknown>={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
  HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,Node:dom.window.Node,
  NodeFilter:dom.window.NodeFilter,MutationObserver:dom.window.MutationObserver,CustomEvent:dom.window.CustomEvent,
  getComputedStyle:dom.window.getComputedStyle.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
const originals=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
const {createRoot}=await import('react-dom/client');
const {TrafficStopRiskPrompt}=await import('../components/traffic-stop-risk-choice.js');
const {NewRunDialog}=await import('../components/new-run-dialog.js');
type Seed=import('../components/new-run-dialog.js').NewRunSeed;

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
async function input(id:string,value:string){
  await act(async()=>{
    const node=element<HTMLInputElement>(id);
    node.focus();
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(node,value);
    node.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  });
}

test('saved stop types focus their derived answer; the separate prompt closes after one choice',async()=>{
  for(const kind of ['traffic_stop','high_risk_stop'] as const){
    const chosen:string[]=[];
    function Harness(){
      const [open,setOpen]=useState(true);
      return <TrafficStopRiskPrompt open={open} onOpenChange={setOpen} kind={kind} code="6" testId="risk"
        onChange={next=>{chosen.push(next);setOpen(false);}}/>;
    }
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    try{
      await act(async()=>root.render(<Harness/>));
      const answer=kind==='high_risk_stop'?'yes':'no';
      assert.equal(document.activeElement,element(`risk-${answer}`));
      assert.equal(element(`risk-${answer}`).getAttribute('aria-pressed'),'true');
      assert.match(element('risk').textContent!,/Was This a High-Risk Stop\?/);
      await act(async()=>element(`risk-${answer}`).click());
      assert.deepEqual(chosen,[kind]);
      assert.equal(document.querySelector('[role="alertdialog"]'),null);
    }finally{await act(async()=>root.unmount());host.remove();}
  }
});

test('manual 10-6 commit prompts before creation; Enter and blur each open only the chosen primary',async()=>{
  for(const answer of ['yes','no'] as const){
    const seeds:Seed[]=[];
    function Harness(){
      const [open,setOpen]=useState(true);
      return <NewRunDialog open={open} defaultUnit="TEST-UNIT" onCancel={()=>setOpen(false)}
        onConfirm={seed=>{seeds.push(seed);setOpen(false);}}/>;
    }
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    try{
      await act(async()=>root.render(<Harness/>));
      await input('input-new-run-incident','TEST-INCIDENT');
      await act(async()=>element('button-new-run-manual').click());
      await input('input-review-location','TEST ADDRESS');
      await input('input-review-code','6');
      assert.equal(seeds.length,0);
      assert.equal(document.querySelector('[data-testid="dialog-new-run-high-risk"]'),null);
      await act(async()=>{
        const field=element('input-review-code');
        if(answer==='yes')field.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
        else field.blur();
      });
      assert.equal(seeds.length,0);
      assert.equal(document.activeElement,element('dialog-new-run-high-risk-no'));
      await act(async()=>element(`dialog-new-run-high-risk-${answer}`).click());
      assert.equal(seeds.length,1);
      assert.equal(seeds[0].runKind,answer==='yes'?'high_risk_stop':'traffic_stop');
      assert.equal(seeds[0].dispatchedCode,'6');
      assert.equal(seeds[0].incidentNumber,'TEST-INCIDENT');
      assert.equal(seeds[0].location,'TEST ADDRESS');
      assert.equal(seeds[0].unitNumber,'TEST-UNIT');
    }finally{await act(async()=>root.unmount());host.remove();}
  }
});

test('dispatch-prefilled 10-6 still requires an explicit answer and preserves the imported incident',async t=>{
  let requests=0;
  t.mock.method(globalThis,'fetch',async()=>{
    requests++;
    return new Response(JSON.stringify({status:'success',metadata:{total_records:1},data:[{
      incidentNumber:'TEST-DISPATCH',unitNumber:'TEST-UNIT',dispatchedCode:'6',
      locationAddress:'TEST DISPATCH ADDRESS',eventIngressAt:'2026-11-23T14:00:00Z',
      dispatchedAt:'2026-11-23T14:01:00Z',clearedAt:'2026-11-23T14:30:00Z',
    }]}),{headers:{'content-type':'application/json'}});
  });
  for(const answer of ['no','yes'] as const){
    const seeds:Seed[]=[];
    function Harness(){
      const [open,setOpen]=useState(true);
      return <NewRunDialog open={open} defaultUnit="TEST-UNIT" onCancel={()=>setOpen(false)}
        onConfirm={seed=>{seeds.push(seed);setOpen(false);}}/>;
    }
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    try{
      await act(async()=>root.render(<Harness/>));
      await input('input-new-run-incident','TEST-DISPATCH');
      await act(async()=>{element('button-new-run-lookup').click();});
      assert.ok(element('dialog-new-run-high-risk'));
      assert.equal(seeds.length,0);
      await act(async()=>element(`dialog-new-run-high-risk-${answer}`).click());
      assert.equal(seeds.length,1);
      assert.equal(seeds[0].runKind,answer==='yes'?'high_risk_stop':'traffic_stop');
      assert.equal(seeds[0].fromDispatch,true);
      assert.equal(seeds[0].location,'TEST DISPATCH ADDRESS');
      assert.equal(seeds[0].incidentNumber,'TEST-DISPATCH');
      assert.equal(seeds[0].dispatchedCode,'6');
      assert.ok(seeds[0].clearedAtText);
    }finally{await act(async()=>root.unmount());host.remove();}
  }
  assert.equal(requests,2);
});

test('an invalid detail stays visible after answering; correcting it retains the selected stop form',async()=>{
  const seeds:Seed[]=[];
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<NewRunDialog open defaultUnit="TEST-UNIT" onCancel={()=>{}}
      onConfirm={seed=>seeds.push(seed)}/>));
    await act(async()=>element('button-new-run-manual').click());
    await input('input-review-zip','INVALID');
    await input('input-review-code','6');
    await act(async()=>element('input-review-code').blur());
    await act(async()=>element('dialog-new-run-high-risk-yes').click());
    assert.equal(seeds.length,0);
    assert.match(element('dialog-new-run').textContent!,/Enter a 5-digit ZIP code/);
    await input('input-review-zip','43215');
    await act(async()=>element('input-review-code').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
    assert.equal(seeds.length,1);
    assert.equal(seeds[0].runKind,'high_risk_stop');
    assert.equal(seeds[0].locationZip,'43215');
  }finally{await act(async()=>root.unmount());host.remove();}
});
