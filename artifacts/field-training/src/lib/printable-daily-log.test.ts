import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintableDailyForms } from '../components/printable-daily-forms';
import { PrintableDailyLog } from '../components/printable-daily-log';
import { seedReports } from './seed';
import { dailyLogContinuations } from './narrative-continuation';

test('long daily notes get one sequential training-folder reference per future sheet',()=>{
  const report={...seedReports()[0],date:'2026-10-26',phase:1,phaseWeek:2,
    narrative:`FTO narrative: ${'a'.repeat(10000)} end 👮🏽‍♀️`,
    remedial:`Corrective training: ${'b'.repeat(7000)} end.`};
  const dayReference={week:2,day:1};
  const continuations=dailyLogContinuations(report);
  const logMarkup=renderToStaticMarkup(createElement(PrintableDailyLog,{report,dayReference}));
  const printedReferences=[...logMarkup.matchAll(/data-training-folder-page="(W\d+D\d+P\d+)"/g)].map(match=>match[1]);
  assert.deepEqual(printedReferences,[
    'W2D1P1',
    ...continuations.map((_,index)=>`W2D1P${index+2}`),
  ]);
  assert.match(logMarkup,/See narrative continuation W2D1P2/);
  assert.match(logMarkup,/👮🏽‍♀️/);

  const followOnMarkup=renderToStaticMarkup(createElement(PrintableDailyForms,{report,dayReference}));
  assert.match(followOnMarkup,new RegExp(`W2D1P${continuations.length+2}`));
});
