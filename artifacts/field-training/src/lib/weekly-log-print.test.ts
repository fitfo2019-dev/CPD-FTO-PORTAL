import assert from 'node:assert/strict';
import { registerHooks, type LoadHookSync } from 'node:module';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CATEGORIES, type WeeklyPerformanceLog } from './model.js';

const mockedSvgModule = `export default ${JSON.stringify('<svg xmlns="http://www.w3.org/2000/svg"></svg>')};`;
const testLoadHook: LoadHookSync = function load(url, context, next) {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith("/columbus-logo.svg") && parsed.searchParams.has("raw")) {
    return { format: "module", shortCircuit: true, source: mockedSvgModule };
  }
  const loaded = next(url, context);
  if (
    !parsed.pathname.endsWith("/printable-columbus-header.tsx") &&
    !parsed.pathname.endsWith("/printable-columbus-header.js")
  ) return loaded;
  if (loaded.source === undefined) return loaded;
  const source = typeof loaded.source === "string" ? loaded.source : new TextDecoder().decode(loaded.source);
  return { ...loaded, source: source.replaceAll("import.meta.env.BASE_URL", JSON.stringify("/")) };
};
registerHooks({ load: testLoadHook });

test('weekly log print preview uses paper columns, source references, and independent print-page numbers',async()=>{
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
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, writable: true, value: React });
  try {
    const { PrintableWeeklyPerformanceLog } = await import('../components/printable-extended-forms.js');
    const markup=renderToStaticMarkup(createElement(PrintableWeeklyPerformanceLog,{log,preview:true}));
    assert.match(markup,/Probationary Officer Weekly Performance Log/);
    assert.match(markup,/CATEGORY/);
    assert.match(markup,/TOTAL TIME/);
    assert.match(markup,/W5D4P4/);
    assert.match(markup,/Page 1 of 2/);
    assert.match(markup,/Page 2 of 2/);
    assert.match(markup,/is-preview/);
    assert.match(markup,/U-10\.174S/);
  } finally {
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
});
