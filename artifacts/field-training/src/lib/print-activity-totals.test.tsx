import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintActivityTotals } from '../components/print-activity-totals.js';
import { DAILY_ACTIVITY_FIELDS, type DailyActivitySummary } from './model.js';

test('both print layouts retain every activity exactly once with its actual total',()=>{
  const totals=Object.fromEntries(DAILY_ACTIVITY_FIELDS.map((field,index)=>[field.key,index+101])) as DailyActivitySummary;
  for(const blocks of [1,2,4] as const) {
    const markup=renderToStaticMarkup(<PrintActivityTotals totals={totals} blocks={blocks}/>);
    assert.equal((markup.match(/data-print-activity=/g)??[]).length,DAILY_ACTIVITY_FIELDS.length);
    for(const field of DAILY_ACTIVITY_FIELDS) {
      assert.equal(markup.split(`data-print-activity="${field.key}"`).length-1,1);
      assert.ok(markup.includes(`class="print-activity-count">${totals[field.key]}</td>`));
    }
    assert.equal((markup.match(/<table /g)??[]).length,blocks);
  }
});
