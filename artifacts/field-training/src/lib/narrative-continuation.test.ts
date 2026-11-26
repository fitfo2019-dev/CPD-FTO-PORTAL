import assert from 'node:assert/strict';
import test from 'node:test';
import { DAILY_NARRATIVE_LAYOUT, dailyLogContinuations, needsRunNarrativeContinuation,
  paginateNarrativeToPages, RUN_NARRATIVE_LAYOUT, splitNarrativeContinuation } from './narrative-continuation.js';

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
  assert.ok(pages.every(page=>page.total===pages.length));
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
  assert.deepEqual(narrativePages.map(page=>page.part),narrativePages.map((_,index)=>index+1));
  assert.deepEqual(remedialPages.map(page=>page.part),remedialPages.map((_,index)=>index+1));
});

test('print-fit pagination respects available lines and preserves whitespace and grapheme boundaries',()=>{
  const input=('Line with tabs\tand spaces, longtoken'.repeat(30)+'\r\n\n').repeat(8)+'👮🏽‍♀️e\u0301';
  for(const layout of [RUN_NARRATIVE_LAYOUT,DAILY_NARRATIVE_LAYOUT]){
    const pages=paginateNarrativeToPages(input,layout);
    assert.ok(pages.length>1);
    assert.equal(pages.join(''),input);
    const limit=Math.floor(layout.heightPoints/layout.lineHeightPoints);
    assert.ok(pages.every(page=>page.split(/\r\n|\r|\n/).length<=limit+1));
  }
});

test('normal words remain intact across printed page boundaries whenever whitespace permits',()=>{
  const input='municipal training observations '.repeat(500);
  const pages=paginateNarrativeToPages(input,{
    widthPoints:120,heightPoints:30,font:'8pt Arial, sans-serif',lineHeightPoints:10,
  });
  assert.ok(pages.length>1);
  assert.equal(pages.join(''),input);
  assert.ok(pages.slice(0,-1).every(page=>/\s$/u.test(page)));
});

test('unbroken tokens, blank final lines and empty input do not create a blank trailing page',()=>{
  const longToken='X'.repeat(60_000);
  const pages=splitNarrativeContinuation(`${longToken}\n\n`);
  assert.ok(pages.length>1);
  assert.equal(pages.join(''),`${longToken}\n\n`);
  assert.ok(pages.at(-1));
  assert.deepEqual(splitNarrativeContinuation(''),['']);
});
