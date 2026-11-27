import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  canCopyWording, citationPath, clauseLabels, clausesFromStatuteHtml, elementsComplete, elementsForCitation, mergeComplaintSources,
  normalizeComplaintCodes, penaltySentences, resolveStatute, searchCharges, type ComplaintEntry, type StatuteClauses,
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

test('sections missing from the chapter files resolve from the charging supplement', () => {
  const supplement = data('charging-supplement.json').codes;
  const cruelty = resolveStatute({ kind: 'ORC', section: '959.15' }, undefined, supplement);
  assert.ok(cruelty && cruelty.clauses.length > 0);
  assert.ok(penaltySentences(cruelty!).some(text => text.startsWith('ORC 959.99:')));
  const group = elementsForCitation(cruelty!, ['A']);
  assert.ok(group.lead.length > 0);
  assert.ok(!group.lead.some(line => line.text.startsWith('ORC 959.99:')));
  const theftRecord = data('statutes/2913.json')['2913.02'];
  assert.deepEqual(resolveStatute({ kind: 'ORC', section: '2913.02' }, theftRecord, supplement), theft);
  assert.equal(resolveStatute({ kind: 'CCC', section: '9999.99' }, undefined, supplement), null);
});

test('manual heading typos resolve to the sections their wording cites', () => {
  assert.ok(!codes.some(code => code.key === 'ORC:2913.0' || code.key === 'ORC:2909.211'));
  const theftCode = codes.find(code => code.key === 'ORC:2913.02')!;
  const threat = theftCode.entries.find(entry => entry.heading === 'THEFT 2913.02(A)(4) ORC' && /special purpose/i.test(entry.variant));
  assert.ok(threat);
  assert.deepEqual(threat!.citations, ['ORC 2913.02(A)(4)']);
  assert.deepEqual(citationPath(threat!.citations[0], '2913.02'), ['A', '4']);
  const trespass = codes.find(code => code.key === 'ORC:2911.211')!;
  const infrastructure = trespass.entries.find(entry => entry.citations.includes('ORC 2911.211(A)(2)'));
  assert.ok(infrastructure && /critical infrastr/i.test(infrastructure.text));
  assert.ok(searchCharges(codes, '2913.02').some(code => code.key === 'ORC:2913.02'));
});

test('repealed City Code 2329.13 and 2329.14 are not offered', () => {
  assert.ok(!codes.some(code => code.key === 'CCC:2329.13' || code.key === 'CCC:2329.14'));
});

test('city corrections: placard tampering under 4707.09, 525.23 removed, open burning locked', () => {
  const supplement = data('charging-supplement.json').codes;
  assert.ok(!codes.some(code => code.key === 'CCC:525.23'));
  const placard = codes.find(code => code.key === 'CCC:4707.09')!;
  assert.ok(placard.entries.every(entry => entry.text.includes('Section 4707.09') && !entry.text.includes('4707.07')));
  const statute = resolveStatute({ kind: 'CCC', section: '4707.09' }, undefined, supplement)!;
  const group = elementsForCitation(statute, []);
  assert.equal(group.lead.length, 1);
  assert.match(group.lead[0].text, /no person shall deface or remove/);
  assert.ok(elementsComplete(group, new Set([group.lead[0].index])));
  assert.deepEqual(penaltySentences(statute), ['CCC 4701.99: A. Whoever violates any provision of this code is guilty of a misdemeanor of the first degree.']);
  assert.ok(!codes.some(code => code.key === 'CCC:2501.985'));
  const burning = codes.find(code => code.key === 'CCC:2501.09.1')!;
  assert.ok(burning.entries.every(entry => !canCopyWording(entry) && entry.text.includes('Section 2501.09.1') && entry.text.includes('2501.01.1')));
  const fireCode = resolveStatute({ kind: 'CCC', section: '2501.09.1' }, undefined, supplement)!;
  assert.deepEqual(penaltySentences(fireCode), ['CCC 2501.99: Any violation of the Columbus Fire Prevention Code is a first degree misdemeanor.']);
});

test('wording corrections: 2919.121 cited correctly, split wording rejoined', () => {
  const abortion = codes.find(code => code.key === 'ORC:2919.121')!;
  assert.ok(abortion.entries.every(entry => entry.text.includes('Section 2919.121 ') && !entry.text.includes('2919.12.1')));
  const bail = codes.find(code => code.key === 'ORC:2927.27')!;
  assert.ok(bail.entries.every(entry => /in violation of Section 2927\.27\([AB]\)/i.test(entry.text)));
  const murder = codes.find(code => code.key === 'ORC:2903.01')!;
  assert.ok(murder.entries.every(entry => !entry.notes.startsWith('–')));
});

test('OVI: misdemeanor is citation only, felony OVI wording is word for word and processed by D.I.C.E.', () => {
  const felony = data('felony-traffic.json') as { codes: Record<string, ComplaintEntry[]> };
  const merged = normalizeComplaintCodes(mergeComplaintSources(complaints.codes, felony.codes));
  const oviCode = merged.find(code => code.key === 'ORC:4511.19')!;
  assert.ok(searchCharges(merged, 'ovi').some(code => code.key === 'ORC:4511.19'));
  assert.equal(oviCode.entries.length, 4);
  assert.ok(oviCode.entries[0].citationOnly && !canCopyWording(oviCode.entries[0]));
  oviCode.entries.slice(1).forEach(entry => {
    assert.equal(entry.processedBy, 'DICE');
    assert.ok(!canCopyWording(entry));
    assert.match(entry.text, /^Operate a vehicle, to wit: \(Year, Make, Tag: \(State and number\) at \(location\) while under the influence/);
  });
  const group = elementsForCitation(ovi, citationPath(oviCode.entries[1].citations[0], '4511.19'));
  assert.equal(group.lead.length, 1);
  assert.ok(group.requiresOne && group.alternatives.some(line => /under the influence of alcohol, a drug of abuse/.test(line.text)));
  const viii = group.alternatives.findIndex(line => line.text.startsWith('(viii)'));
  assert.ok(viii > 0);
  assert.deepEqual(group.alternatives.slice(viii + 1, viii + 4).map(line => [line.text.slice(0, line.text.indexOf(')') + 1), line.depth]),
    [['(I)', 4], ['(II)', 4], ['(ix)', 3]]);
  assert.ok(merged.some(code => code.key === 'ORC:2913.02'));
});
