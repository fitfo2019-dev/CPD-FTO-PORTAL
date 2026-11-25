import React, { type ReactElement, type ReactNode } from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { RunOptionsChoices, type RunOptionsDialogProps } from '../components/run-options-dialog.js';

type ButtonProps={ 'data-testid'?:string;disabled?:boolean;'aria-pressed'?:boolean;onClick?:()=>void };
function buttons(node:ReactNode):ReactElement<ButtonProps>[] {
  const result:ReactElement<ButtonProps>[]=[];
  React.Children.forEach(node,child=>{
    if(!React.isValidElement<{children?:ReactNode}>(child))return;
    if(child.type==='button')result.push(child as ReactElement<ButtonProps>);
    else if(typeof child.type==='function')result.push(...buttons((child.type as (props:unknown)=>ReactNode)(child.props)));
    else result.push(...buttons(child.props.children));
  });
  return result;
}
function fixture() {
  const calls:unknown[]=[];
  const props:RunOptionsDialogProps={
    open:true,onOpenChange:()=>{},showTraffic:true,trafficMode:'none',
    onTrafficChange:mode=>calls.push(['traffic',mode]),
    forms:[
      {key:'arrest_process',label:'Arrest Process',selected:false},
      {key:'ovi_process',label:'OVI Process',selected:true,lockedReason:'Required because OVI processing is recorded'},
    ],
    onFormChange:(key,selected)=>calls.push(['form',key,selected]),
    activities:[
      {key:'solveCitationSummons',label:'Solve Citation/Summons*',selected:false},
      {key:'trafficCitations',label:'Traffic Citations',selected:false},
      {key:'fiReports',label:'FI Reports',selected:true},
    ],
    onActivityChange:(key,selected)=>calls.push(['activity',key,selected]),
    onClearActivities:()=>calls.push(['clear']),
    activityHint:'Choose only completed activities.',
  };
  return {props,calls};
}
test('optional buttons begin unselected and toggle only the requested choice',()=>{
  const {props,calls}=fixture();
  const get=(id:string)=>buttons(RunOptionsChoices(props)).find(button=>button.props['data-testid']===id)!;
  assert.equal(get('button-traffic-option-none').props['aria-pressed'],true);
  assert.equal(get('button-traffic-option-motor_vehicle').props['aria-pressed'],false);
  get('button-traffic-option-motor_vehicle').props.onClick!();
  props.trafficMode='motor_vehicle';
  get('button-traffic-option-motor_vehicle').props.onClick!();
  get('button-run-option-solveCitationSummons').props.onClick!();
  get('button-run-form-arrest_process').props.onClick!();
  get('button-run-activity-fiReports').props.onClick!();
  assert.deepEqual(calls,[
    ['traffic','motor_vehicle'],['traffic','none'],['activity','solveCitationSummons',true],
    ['form','arrest_process',true],['activity','fiReports',false],
  ]);
  assert.equal(props.activities[0].selected,false,'rendering/callbacks must not mutate supplied answers');
  assert.equal(get('button-run-form-ovi_process').props.disabled,true);
});
test('read-only choices are disabled, accessible buttons, not checkbox inputs',()=>{
  const {props,calls}=fixture();
  props.disabled=true;
  assert.ok(buttons(RunOptionsChoices(props)).every(button=>button.props.disabled));
  const markup=renderToStaticMarkup(<RunOptionsChoices {...props}/>);
  assert.ok(markup.includes('aria-pressed="true"'));
  assert.ok(!markup.includes('<input'));
  assert.deepEqual(calls,[]);
  props.showTraffic=false;
  assert.ok(!renderToStaticMarkup(<RunOptionsChoices {...props}/>).includes('button-traffic-option'));
});
