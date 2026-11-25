import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCurrentDateTimeShortcut } from './date-time-shortcut.js';
import { currentDateTimeMDY } from './training-calendar.js';

test('question mark with Tab fills local date, time, or both without trapping focus',()=>{
  for(const kind of ['date','time','datetime'] as const) {
    const now=currentDateTimeMDY();
    let prevented=false, result='';
    applyCurrentDateTimeShortcut({key:'Tab',currentTarget:{value:' ? '},preventDefault(){prevented=true;}},kind,value=>{result=value;});
    assert.equal(result,kind==='date'?now.date:kind==='time'?now.time:`${now.date} ${now.time}`);
    assert.equal(prevented,false);
  }
});

test('Enter also fills without submitting and other values or protected inputs stay unchanged',()=>{
  let count=0,prevented=false;
  applyCurrentDateTimeShortcut({key:'Enter',currentTarget:{value:'?'},preventDefault(){prevented=true;}},'datetime',()=>{count++;});
  assert.equal(count,1);
  assert.equal(prevented,true);
  for(const currentTarget of [{value:'11/16/2026'},{value:''},{value:'?',readOnly:true},{value:'?',disabled:true}]) {
    applyCurrentDateTimeShortcut({key:'Tab',currentTarget,preventDefault(){assert.fail('must not trap focus');}},'date',()=>assert.fail('must not overwrite'));
  }
  applyCurrentDateTimeShortcut({key:'a',currentTarget:{value:'?'},preventDefault(){assert.fail();}},'date',()=>assert.fail());
});
