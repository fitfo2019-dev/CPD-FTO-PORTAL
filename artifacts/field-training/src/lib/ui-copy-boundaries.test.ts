import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TrafficStopRiskPrompt} from '../components/traffic-stop-risk-choice.js';
import {ftoAssignmentsForPrecinct,cruiserDistrictForFtoAssignment} from './cpd-geography.js';
import {assertExportCopy} from '../../test-support/export-copy-boundaries.js';

test('generated exports reject developer commentary and report the export and offending phrase',()=>{
  for(const [copy,offending] of [
    ['Implementation notes','Implementation notes'],
    ['Task-summary commentary','Task-summary commentary'],
    ['This update preserves the controls.','This update preserves'],
  ]){
    assert.throws(
      ()=>assertExportCopy('Weekly performance workbook',copy,[]),
      new RegExp(`Weekly performance workbook contains developer commentary "${offending}"`),
    );
  }
  assert.doesNotThrow(()=>assertExportCopy('Daily print export',
    'Probationary Officer Daily Performance Summary · Local draft · Not server-confirmed',
    ['Probationary Officer Daily Performance Summary','Local draft · Not server-confirmed']));
});
test('the closed traffic-stop prompt renders no inline question or routing commentary',()=>{
  for(const kind of ['traffic_stop','high_risk_stop'] as const){
    const html=renderToStaticMarkup(createElement(TrafficStopRiskPrompt,{
      open:false,onOpenChange:()=>{},kind,onChange:()=>{},testId:'test-risk-choice',
    }));
    assert.equal(html,'');
    assert.doesNotMatch(html,/<p[\s>]|The FTO chooses|supplementform|doesn.t load/i);
  }
  assert.equal(renderToStaticMarkup(createElement(TrafficStopRiskPrompt,{
    open:false,onOpenChange:()=>{},kind:'call_for_service',onChange:()=>{},testId:'test-risk-choice',
  })),'');
});
test('copy cleanup preserves four-digit midwatch indices and wagon assignment values',()=>{
  // Existing persisted values are deliberately not normalized to display examples.
  assert.ok(ftoAssignmentsForPrecinct('1','1','DMW').includes('9011D1'));
  assert.ok(ftoAssignmentsForPrecinct('3','8','EMW').includes('9081E2'));
  assert.equal(cruiserDistrictForFtoAssignment('1','1','9011D1','DMW'),'9011');
  assert.equal(cruiserDistrictForFtoAssignment('3','8','9081E2','EMW'),'9081');
  assert.ok(ftoAssignmentsForPrecinct('1','1','A-Co').includes('18A1'));
  assert.ok(ftoAssignmentsForPrecinct('3','8','C-Co').includes('88C2'));
});
test('shell capitalization uses CSS only on fixed navigation links',()=>{
  const css=readFileSync(new URL('../index.css',import.meta.url),'utf8');
  assert.match(css,/\[data-testid="nav-desktop"\] > a,\s*\[data-testid="nav-desktop"\] > span\[role="link"\],\s*\[data-testid="nav-mobile"\] > a,\s*\[data-testid="nav-mobile"\] > span\[role="link"\],\s*\[data-testid="nav-mobile"\] > button,\s*\[data-testid="sheet-mobile-nav-more"\] a \{ text-transform: uppercase; \}/);
  assert.doesNotMatch(css,/(?:input|textarea|contenteditable)[^{}]*\{[^}]*text-transform:\s*(?:uppercase|capitalize)/);
});
test('dispatch ambiguity and real packet submission safeguards stay in place',()=>{
  const entry=readFileSync(new URL('../components/new-run-dialog.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(entry,/The form suggestion is based only|10-6 does not determine high risk/);
  assert.match(entry,/This code is ambiguous/);
  const submit=readFileSync(new URL('../components/packet-review/submit-control.tsx',import.meta.url),'utf8');
  assert.match(submit,/FINALIZE AND SUBMIT TO COORDINATOR/);
  assert.match(submit,/CONFIRM SUBMISSION/);
  const editor=readFileSync(new URL('../pages/report-editor.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(editor,/runTypeCodeHelp|1V uses the explicitly selected Traffic Citations metric/);
  assert.match(editor,/Change and reset primary sheet/);
});
