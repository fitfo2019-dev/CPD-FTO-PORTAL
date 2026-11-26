import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RunChecklistFields } from '../components/run-checklist-fields.js';
import { RUN_CHECKLIST_ITEMS, RUN_SUPPLEMENT_CHECKLIST_ITEMS, newRunChecklist, type PrimaryRunForm } from './model.js';
import {
  REVISED_PRIMARY_CHECKLISTS as primary,
  REVISED_SUPPLEMENT_CHECKLISTS as supplemental,
  revisedRowState,
  setRevisedRow,
  partitionRevisedChecklist,
} from './revised-run-checklists.js';

// Fingerprints independently computed from the uploaded Word document's JSON,
// including every exact label, stable row ID, section heading, and display order.
const documentFingerprints = {
  call_for_service: 'ab27988fffac9a06550af456730c702ded65f5b0f9fdc1ff83f339417b62886b',
  self_initiated: 'a80047214e0f037a4edc3332f8a0f01b7b36035f84ae7ff0021bc8fe71702cc0',
  domestic_incident: '6d03e3c40eedba7460173ddf5b3c3e1f21337c8282cac52e620065b834189942',
  traffic_crash: 'b09e9853f803294da929732325b4cb4a38fea28e0ebed50415a5147740fcf540',
  traffic_stop: 'fde48f6a56b7f0ac0b2fd5b8b878a390e1dcb21f8234a223ce380d96863b0bfe',
  high_risk_stop: 'e84a21fd1b820b2bfb470f2bc141dcc4ab913709e79a51f40b98b6cced4ffa7b',
  arrest_process: '390b3cee848499eb50f8d7f611415fc989917e7aab15b209f7af9a8acde0c800',
  ovi_process: '5095be560152573c8872b251f316650de684670fab9fd35af3d11726c86fe402',
  building_search: '92bd37e139f828220654b0d71b9bb1797f04971569846381b2215e25f6622da3',
};
const forms = { ...primary, arrest_process: supplemental.arrest_process, ovi_process: supplemental.ovi_process };

test('all 187 grouped rows exactly match the revised document and finalized Traffic Stop', () => {
  let rows = 0;
  for (const [key, sections] of Object.entries(forms)) {
    const contents = sections.map(section => [section.title, ...section.items.map(item => [item.id, item.label])]);
    const digest = createHash('sha256').update(JSON.stringify(contents)).digest('hex');
    assert.equal(digest, documentFingerprints[key as keyof typeof documentFingerprints], key);
    rows += sections.reduce((count, section) => count + section.items.length, 0);
  }
  assert.equal(rows, 187);
  assert.ok(!primary.traffic_stop.find(section => section.title === 'Decision')?.items.some(item => item.label.includes('Upload to Matrix')));
  assert.ok(primary.traffic_stop.find(section => section.title === 'Re-Approach')?.items.some(item => item.label.includes('Upload to Matrix')));
});

test('Training Only is an unboxed header choice with its unchanged saved offset',()=>{
  const display=partitionRevisedChecklist(primary.self_initiated);
  assert.equal(display.headerOptions.length,1);
  assert.deepEqual(display.headerOptions[0].indices,[0]);
  assert.equal(display.sections.length,6);
  assert.equal(display.sections.some(section=>section.title==='Header Option'),false);
  for(const checked of [true,false])for(const disabled of [true,false]) {
    const saved={'task-0':checked,'task-1':false};
    const html=renderToStaticMarkup(React.createElement(RunChecklistFields,{
      sections:primary.self_initiated,state:saved,prefix:'task-',disabled,testId:'self',onChange(){},
    }));
    assert.equal((html.match(/<fieldset/g)||[]).length,6);
    assert.ok(!html.includes('Header Option'));
    assert.ok(html.indexOf('Training Only')<html.indexOf('<fieldset'));
    const input=html.match(/<input[^>]*data-testid="self-row-sir_ho_1"[^>]*>/)![0];
    assert.equal(/\bchecked=""/.test(input),checked);
    assert.equal(/\bdisabled=""/.test(input),disabled);
    assert.deepEqual(saved,{'task-0':checked,'task-1':false});
  }
});

test('revised groups cover every original saved offset once without changing primary/supplement defaults', () => {
  for (const [key, sections] of Object.entries(forms)) {
    const labels = key in RUN_CHECKLIST_ITEMS
      ? RUN_CHECKLIST_ITEMS[key as PrimaryRunForm]
      : RUN_SUPPLEMENT_CHECKLIST_ITEMS[key as 'arrest_process' | 'ovi_process'];
    const indices = sections.flatMap(section => section.items.flatMap(item => item.indices));
    assert.deepEqual([...indices].sort((a, b) => a - b), labels.map((_, index) => index), key);
    assert.ok(sections.every(section => section.items.every(item => item.indices.length && item.id && item.label)));
  }
  assert.deepEqual(supplemental.building_search, primary.building_search);
  assert.deepEqual(supplemental.narrative_addition, []);
  const defaults = newRunChecklist('traffic_stop', ['arrest_process', 'ovi_process', 'building_search']);
  assert.ok(Object.entries(defaults).filter(([key]) => !key.startsWith('na-')).every(([, value]) => value));
  assert.ok(Object.entries(defaults).filter(([key]) => key.startsWith('na-')).every(([, value]) => !value));
});

test('mixed saved values remain unchanged until an explicit grouped toggle, including non-contiguous offsets', () => {
  for (const [key, sections] of Object.entries(forms)) {
    const prefix = key === 'arrest_process' || key === 'ovi_process' ? `supp-${key}-` : 'task-';
    for (const item of sections.flatMap(section => section.items)) {
      const saved = { ...Object.fromEntries(item.indices.map((index, position) => [`${prefix}${index}`, position !== 0])), unrelated: false, futureKey: true };
      const original = structuredClone(saved);
      assert.deepEqual(revisedRowState(saved, prefix, item.indices), { checked: false, mixed: item.indices.length > 1 });
      assert.deepEqual(saved, original);
      for (const checked of [true, false]) {
        const changed = setRevisedRow(saved, prefix, item.indices, checked);
        for (const index of item.indices) assert.equal(changed[`${prefix}${index}`], checked);
        assert.equal(changed.unrelated, false);
        assert.equal(changed.futureKey, true);
        assert.deepEqual(saved, original);
      }
    }
  }
  assert.deepEqual(revisedRowState({}, 'task-', [0, 1, 3, 9]), { checked: true, mixed: false });
});

test('fixed accessible section and row structure is identical when checked, unchecked, mixed, or read-only', () => {
  const sections = primary.call_for_service;
  const render = (state: Record<string, boolean>, disabled: boolean) => renderToStaticMarkup(
    React.createElement(RunChecklistFields, { sections, state, disabled, prefix: 'task-', testId: 'preview', onChange() {} }),
  );
  const checked = render({}, false);
  const unchecked = render(Object.fromEntries(Array.from({ length: 52 }, (_, index) => [`task-${index}`, false])), false);
  const mixed = render({ 'task-0': false }, false);
  const readOnly = render({ 'task-0': false }, true);
  for (const html of [checked, unchecked, mixed, readOnly]) {
    assert.equal((html.match(/<fieldset/g) ?? []).length, 6);
    assert.equal((html.match(/type="checkbox"/g) ?? []).length, 22);
    assert.ok(!html.includes('<details'));
    for (const section of sections) assert.ok(html.includes(section.title));
  }
  assert.ok(mixed.includes('aria-checked="mixed"'));
  assert.ok(mixed.includes('data-state="failed"'));
  assert.equal((readOnly.match(/<input[^>]*disabled/g) ?? []).length, 22);
  assert.equal((readOnly.match(/<button[^>]*disabled/g) ?? []).length, 6);
});
