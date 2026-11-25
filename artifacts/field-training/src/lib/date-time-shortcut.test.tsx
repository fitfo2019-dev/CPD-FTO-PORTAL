import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { act, useState } from 'react';
import { JSDOM } from 'jsdom';
import { dateTimeShortcut, type ShortcutKind } from './date-time-shortcut.js';
import { DATE_TIME_SHORTCUT_FIELDS } from './date-time-shortcut-inventory.js';
import { currentDateTimeMDY, formatDateEntryMDY, formatDateTimeEntryMDY, formatTimeEntry24H, splitDateTimeEntryMDY } from './training-calendar.js';
import { parseRunDateTime } from './run-details.js';
import 'fake-indexeddb/auto';
import { OfflineStorage } from './offlineStorage.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/',pretendToBeVisual:true});
const globals:Record<string,unknown> = {window:dom.window,document:dom.window.document,
  navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,
  Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true};
const originals = new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
// Import after the DOM exists so React installs its normal input-event path.
const {createRoot} = await import('react-dom/client');
test.after(()=>{
  dom.window.close();
  for(const [key,descriptor] of originals){
    if(descriptor)Object.defineProperty(globalThis,key,descriptor);
    else Reflect.deleteProperty(globalThis,key);
  }
});

const formatter = (kind:ShortcutKind) => kind==='time'?formatTimeEntry24H:kind==='date'?formatDateEntryMDY:formatDateTimeEntryMDY;
async function type(input:HTMLInputElement,text:string,replace=true){
  if(replace)input.select();
  for(const char of text){
    await act(async()=>{
      input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:char,bubbles:true,cancelable:true}));
      const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
      const next=input.value.slice(0,start)+char+input.value.slice(end);
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,next);
      input.setSelectionRange(start+1,start+1);
      input.dispatchEvent(new dom.window.InputEvent('input',{data:char,inputType:'insertText',bubbles:true}));
      input.dispatchEvent(new dom.window.KeyboardEvent('keyup',{key:char,bubbles:true}));
    });
  }
}
async function press(input:HTMLInputElement,key:string,shiftKey=false){
  const event = new dom.window.KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true});
  await act(async()=>{input.dispatchEvent(event);});
  return event;
}
async function mounted(kind:ShortcutKind,run:(input:HTMLInputElement,host:HTMLElement)=>Promise<void>,options:{fixedDate?:string;disabled?:boolean;readOnly?:boolean;fieldset?:boolean;initial?:string}={}){
  function Field(){
    const [value,setValue] = useState(options.initial??'');
    return <form onSubmit={event=>{event.preventDefault();throw new Error('Shortcut submitted the form');}}>
      <button type="button">Before</button><fieldset disabled={options.fieldset}>
        <input value={value} disabled={options.disabled} readOnly={options.readOnly}
          onChange={event=>setValue(formatter(kind)(event.target.value))}
          onKeyDown={event=>dateTimeShortcut(event,kind,setValue,options.fixedDate)}/>
      </fieldset><button type="button">After</button><output>{value}</output>
    </form>;
  }
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{await act(async()=>root.render(<Field/>));await run(host.querySelector('input')!,host);}
  finally{await act(async()=>root.unmount());host.remove();}
}

test('inventory binds every record-entry control to the shared keyboard behavior',()=>{
  const files = new Map<string,string>();
  for(const field of DATE_TIME_SHORTCUT_FIELDS){
    const source=files.get(field.file)??readFileSync(new URL(`../${field.file}`,import.meta.url),'utf8');
    files.set(field.file,source);
    const input=source.split('<input').find(tag=>tag.split('/>')[0].includes(field.testId))?.split('/>')[0];
    assert.ok(input,field.testId);
    assert.match(input,/onKeyDown=\{event=>(?:dateTimeShortcut|applyCurrentDateTimeShortcut)\(event,/);
    assert.ok(input.includes(`'${field.kind}'`),field.testId);
    if(field.fixedDate)assert.ok(input.includes('formatDateDMY(firstDay)'));
  }
  assert.equal(DATE_TIME_SHORTCUT_FIELDS.length,16);
});

test('mounted formatted controls retain typed markers, resolve Tab and Enter, and stay manually editable',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:new Date(2026,10,25,0,5)});
  for(const kind of ['date','time','datetime'] as const){
    await mounted(kind,async(input,host)=>{
      input.focus();
      await type(input,'?');
      assert.equal(input.value,'?');
      assert.equal(host.querySelector('output')!.textContent,'?');
      const tab=await press(input,'Tab');
      assert.equal(tab.defaultPrevented,false);
      const now=currentDateTimeMDY();
      const expected=kind==='date'?now.date:kind==='time'?now.time:`${now.date} ${now.time}`;
      assert.equal(input.value,expected);
      assert.equal(host.querySelector('output')!.textContent,expected);
      t.mock.timers.tick(60_000);
      // A second key without a fresh marker must not overwrite the value.
      assert.equal((await press(input,'Enter')).defaultPrevented,false);
      assert.equal(input.value,expected);
      await type(input,'?');
      const enter=await press(input,'Enter');
      assert.equal(enter.defaultPrevented,true);
      assert.ok(input.value.endsWith(kind==='date'?'2026':currentDateTimeMDY().time));
      await type(input,kind==='time'?'0830':kind==='date'?'11162026':'11162026 08:30');
      const ordinary=input.value;
      await press(input,'Tab',true);
      assert.equal(input.value,ordinary);
      await act(async()=>{
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,'');
        input.dispatchEvent(new dom.window.InputEvent('input',{inputType:'deleteContentBackward',bubbles:true}));
      });
      await press(input,'Tab');
      assert.equal(input.value,'');
      assert.equal(host.querySelector('output')!.textContent,'');
    },{initial:kind==='time'?'17:30':kind==='date'?'11/16/2026':'11/16/2026 17:30'});
  }
});

test('fresh local clock crosses midnight; orientation keeps the required historical first day',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:new Date(2026,10,25,23,59)});
  await mounted('datetime',async input=>{
    await type(input,'?');await press(input,'Tab');
    assert.equal(input.value,'11/25/2026 23:59');
    t.mock.timers.tick(60_000);
    await type(input,'?');await press(input,'Tab',true);
    assert.equal(input.value,'11/26/2026 00:00');
  });
  await mounted('datetime',async input=>{
    await type(input,'?');await press(input,'Enter');
    assert.equal(input.value,'11/16/2026 00:00');
    assert.ok(parseRunDateTime(input.value));
  },{fixedDate:'11/16/2026'});
});

test('read-only, disabled, disabled fieldset, and unrelated keys do not resolve',async()=>{
  for(const options of [{readOnly:true},{disabled:true},{fieldset:true}]){
    await mounted('time',async input=>{
      for(const key of ['Tab','Enter']){
        assert.equal((await press(input,key)).defaultPrevented,false);
        assert.equal(input.value,'?');
      }
    },{...options,initial:'?'});
  }
  await mounted('time',async input=>{
    await type(input,'?');
    await press(input,'Escape');assert.equal(input.value,'?');
  });
});

test('mounted separate run date can be cleared and retyped while its time stays intact',async()=>{
  function RunFields(){
    const [combined,setCombined]=useState('11/16/2026 08:30');
    const parts=splitDateTimeEntryMDY(combined);
    return <><input data-testid="date" value={parts.date}
      onChange={event=>setCombined(`${formatDateEntryMDY(event.target.value)} ${parts.time}`)}/>
      <output>{parts.time}</output></>;
  }
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<RunFields/>));
    const input=host.querySelector('input')!;
    input.focus();input.select();
    await act(async()=>{
      input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Backspace',bubbles:true}));
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,'');
      input.dispatchEvent(new dom.window.InputEvent('input',{inputType:'deleteContentBackward',bubbles:true}));
    });
    assert.equal(input.value,'');
    assert.equal(host.querySelector('output')!.textContent,'08:30');
    await type(input,'04212025');
    assert.equal(input.value,'04/21/2025');
    assert.equal(host.querySelector('output')!.textContent,'08:30');
  }finally{await act(async()=>root.unmount());host.remove();}
});

test('typed shortcut values survive encrypted local save/reopen without submission or case changes',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:new Date(2026,10,25,8,5)});
  let time='',dateTime='';
  await mounted('time',async input=>{await type(input,'?');await press(input,'Tab');time=input.value;});
  await mounted('datetime',async input=>{await type(input,'?');await press(input,'Enter');dateTime=input.value;});
  const namespace=`shortcut-fictional-${crypto.randomUUID()}`;
  const passphrase=new TextEncoder().encode('Fictional-shortcut-test-only');
  const vault=new OfflineStorage(namespace);await vault.unlock(passphrase);
  const workspace={reports:[{id:'fictional-shortcut',date:'2026-11-16',shiftStartTime:time,
    status:'draft',syncStatus:'local_draft_pending',signatures:{},narrative:'MiXeD Case; exact punctuation.',
    runs:[{id:'fictional-run',occurredAt:parseRunDateTime(`11/16/2026 ${time}`),
      dispatchedAt:parseRunDateTime(dateTime),endedAt:parseRunDateTime(dateTime)}]}],
    substationOrientations:[{dateTime:parseRunDateTime(`11/16/2026 ${time}`)}],
    coverageRequests:[{startDateTime:parseRunDateTime(dateTime),endDateTime:parseRunDateTime(dateTime)}]};
  try{
    await vault.saveWorkspace(workspace);vault.lock();
    const reopened=new OfflineStorage(namespace);await reopened.unlock(passphrase);
    assert.deepEqual(await reopened.get('workspace'),workspace);
    reopened.lock();
  }finally{vault.lock();await new Promise<void>((resolve,reject)=>{
    const request=indexedDB.deleteDatabase(namespace);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);
  });}
});
