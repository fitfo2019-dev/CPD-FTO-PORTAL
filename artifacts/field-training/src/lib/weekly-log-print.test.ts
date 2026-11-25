import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintableWeeklyPerformanceLog } from '../components/printable-extended-forms.js';
import { CATEGORIES, type WeeklyPerformanceLog } from './model.js';

test('weekly log print preview uses paper columns, source references, and independent print-page numbers',()=>{
  const narrative='The PO completed a detailed corrective review and then repeated the procedure. '.repeat(48);
  const log:WeeklyPerformanceLog={
    id:'log-preview',weekStart:'2026-11-15',weekEnd:'2026-11-21',weekNumber:5,phase:2,
    className:'135th',recruitName:'PO Example',recruitBadge:'4747',ftoName:'FTO Example',ftoBadge:'101',
    updatedAt:'2026-11-19T00:00:00.000Z',
    entries:[{
      id:'corrective-preview',kind:'corrective',category:CATEGORIES[0],totalTime:'15 min',narrative,
      sourceReportIds:['daily-report-1'],sourceReferences:['W5D4P4'],sourceReferenceReviewed:true,
    }],
  };
  const markup=renderToStaticMarkup(createElement(PrintableWeeklyPerformanceLog,{log,preview:true}));
  assert.match(markup,/Probationary Officer Weekly Performance Log/);
  assert.match(markup,/CATEGORY/);
  assert.match(markup,/TOTAL TIME/);
  assert.match(markup,/W5D4P4/);
  assert.match(markup,/Page 1 of 2/);
  assert.match(markup,/Page 2 of 2/);
  assert.match(markup,/is-preview/);
  assert.match(markup,/U-10\.174S/);
});
