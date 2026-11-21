import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyLogContinuations, needsRunNarrativeContinuation, splitNarrativeContinuation } from './narrative-continuation.js';

test('long run narratives are moved to numbered continuation sheets without truncation',()=>{
  assert.equal(needsRunNarrativeContinuation('Short run note.'),false);
  assert.equal(needsRunNarrativeContinuation('Short run note.',true),true);
  const narrative='TEST ONLY — run narrative. '.repeat(40);
  assert.equal(needsRunNarrativeContinuation(narrative),true);
  assert.equal(splitNarrativeContinuation(narrative).join(''),narrative);
});

test('daily notes stay on the spreadsheet when short',()=>{
  assert.deepEqual(dailyLogContinuations({narrative:'Short shift note.',remedial:'Practiced form review.'}),[]);
  assert.deepEqual(dailyLogContinuations({narrative:'a'.repeat(120),remedial:''}),[]);
  assert.equal(dailyLogContinuations({narrative:'a'.repeat(121),remedial:''}).length,1);
});

test('long daily narratives preserve every character on bounded continuation pages',()=>{
  const narrative='TEST ONLY — practice scenario and corrective coaching.\n'.repeat(150);
  const pages=dailyLogContinuations({narrative,remedial:''});
  assert.ok(pages.length>1);
  assert.equal(pages.map(page=>page.text).join(''),narrative);
  assert.ok(pages.every(page=>Array.from(page.text).length<=1225&&page.total===pages.length));
  assert.deepEqual(pages.map(page=>page.part),pages.map((_,index)=>index+1));
});

test('explicit blank lines cannot overflow an unnumbered daily notes sheet',()=>{
  const remedial='\n'.repeat(100)+'Final follow-up marker.';
  const pages=dailyLogContinuations({narrative:'Short',remedial});
  assert.ok(pages.length>=3);
  assert.equal(pages.map(page=>page.text).join(''),remedial);
  assert.ok(pages.every(page=>page.label==='Corrective training / retraining'));
});

test('very long text and Unicode survive pagination without a size ceiling',()=>{
  const narrative=('Observed: 👮🏽‍♀️ review, coached practice, PO response, and follow-up. ').repeat(2000);
  const remedial=('Retraining step, practice result, and next observation.\n').repeat(1400);
  const pages=dailyLogContinuations({narrative,remedial});
  const narrativePages=pages.filter(page=>page.label==='FTO comments / shift narrative');
  const remedialPages=pages.filter(page=>page.label==='Corrective training / retraining');
  assert.equal(narrativePages.map(page=>page.text).join(''),narrative);
  assert.equal(remedialPages.map(page=>page.text).join(''),remedial);
  assert.ok(pages.every(page=>Array.from(page.text).length<=1225));
  assert.deepEqual(narrativePages.map(page=>page.part),narrativePages.map((_,index)=>index+1));
  assert.deepEqual(remedialPages.map(page=>page.part),remedialPages.map((_,index)=>index+1));
});
