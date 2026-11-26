import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  citationPath, clauseLabels, clausesFromStatuteHtml, elementsComplete, elementsForCitation,
  normalizeComplaintCodes, penaltySentences, searchCharges, type ComplaintEntry, type StatuteClauses,
} from './charging-lookup';

const data = (path: string) => JSON.parse(readFileSync(new URL(`../../public/law-handbook/data/${path}`, import.meta.url), 'utf8'));
const complaints = data('complaints.json') as { codes: Record<string, ComplaintEntry[]> };
const codes = normalizeComplaintCodes(complaints.codes);
const theft = clausesFromStatuteHtml(data('statutes/2913.json')['2913.02'].html);
const ovi = clausesFromStatuteHtml(data('statutes/4511.json')['4511.19'].html);

test('search finds a charge by section number and by offense name', () => {
  assert.equal(searchCharges(codes, '2913.02')[0].key, 'ORC:2913.02');
  assert.equal(searchCharges(codes, 'ORC 2913.02')[0].key, 'ORC:2913.02');
  assert.ok(searchCharges(codes, 'theft').some(code => code.key === 'ORC:2913.02'));
  assert.ok(searchCharges(codes, 'aggravated murder').some(code => code.key === 'ORC:2903.01'));
  assert.deepEqual(searchCharges(codes, '   '), []);
});

test('offense name keeps the source case and drops the citation', () => {
  const code = codes.find(item => item.key === 'ORC:2903.01');
  assert.equal(code?.offense, 'AGGRAVATED MURDER');
});

test('citation paths and clause labels', () => {
  assert.deepEqual(citationPath('ORC 2913.02(A)(1)', '2913.02'), ['A', '1']);
  assert.deepEqual(citationPath('ORC 4511.19(A)(1)(a)', '4511.19'), ['A', '1', 'a']);
  assert.deepEqual(clauseLabels('(B)(1) Whoever violates'), ['B', '1']);
});

test('theft (A)(1) elements are the (A) lead-in and division (1) only', () => {
  const group = elementsForCitation(theft, ['A', '1']);
  assert.equal(group.requiresOne, false);
  assert.equal(group.lead.length, 2);
  assert.match(group.lead[0].text, /^\(A\) No person, with purpose to deprive/);
  assert.match(group.lead[1].text, /^\(1\) Without the consent/);
  assert.equal(elementsComplete(group, new Set([group.lead[0].index])), false);
  assert.equal(elementsComplete(group, new Set(group.lead.map(line => line.index))), true);
});

test('a citation that stops at an alternatives lead-in requires one alternative', () => {
  const group = elementsForCitation(theft, ['A']);
  assert.equal(group.requiresOne, true);
  assert.equal(group.alternatives.length, 5);
  const lead = new Set(group.lead.map(line => line.index));
  assert.equal(elementsComplete(group, lead), false);
  assert.equal(elementsComplete(group, new Set([...lead, group.alternatives[2].index])), true);
});

test('penalty clauses are never elements and the level is quoted from them', () => {
  const group = elementsForCitation(theft, ['A', '1']);
  const penalties = new Set(theft.penaltyIndexes);
  assert.ok([...group.lead, ...group.alternatives].every(line => !penalties.has(line.index)));
  const quoted = penaltySentences(theft);
  assert.ok(quoted.some(text => /is guilty of theft/i.test(text)));
  assert.ok(quoted.some(text => /misdemeanor of the first degree/i.test(text)));
});

test('OVI (A)(1)(a) keeps the (A) and (1) lead-ins with division (a)', () => {
  const group = elementsForCitation(ovi, ['A', '1', 'a']);
  assert.match(group.lead[0].text, /^\(A\)/);
  assert.ok(group.lead.some(line => /^\(a\) The person is under the influence/.test(line.text)));
  assert.ok(!group.lead.some(line => /^\(b\)/.test(line.text)));
});

test('city code clauses use the provided penalty indexes', () => {
  const city = data('city/2317.json')['2317.14'] as { clauses: string[]; penalties: number[] } | undefined;
  if (!city) return;
  const statute: StatuteClauses = { clauses: city.clauses, penaltyIndexes: city.penalties };
  const group = elementsForCitation(statute, ['A']);
  assert.ok(group.lead.length + group.alternatives.length > 0);
});
