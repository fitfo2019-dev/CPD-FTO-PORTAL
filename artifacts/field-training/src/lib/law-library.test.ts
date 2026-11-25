import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CASE_LAW_ENTRIES,
  COLUMBUS_CITY_CODE_ENTRIES,
  LAW_LIBRARY_ENTRIES,
  LAW_LIBRARY_SOURCES,
  OHIO_REVISED_CODE_ENTRIES,
} from './law-library.js';

test('ORC and Columbus ordinance entries are stored as separate source collections', () => {
  const stateChapter = OHIO_REVISED_CODE_ENTRIES.find(entry => entry.id === 'orc-chapter-2903');
  const parkingChapter = OHIO_REVISED_CODE_ENTRIES.find(entry => entry.id === 'orc-chapter-4521');
  const cityChapter = COLUMBUS_CITY_CODE_ENTRIES.find(entry => entry.id === 'ccc-chapter-2303');
  const cityAssault = COLUMBUS_CITY_CODE_ENTRIES.find(entry => entry.id === 'ccc-2303-13');
  assert.equal(stateChapter?.citation, 'ORC Chapter 2903');
  assert.equal(stateChapter?.title, 'Homicide and Assault');
  assert.equal(stateChapter?.category, 'Criminal');
  assert.equal(stateChapter?.jurisdiction, 'State');
  assert.match(stateChapter?.url ?? '', /\/chapter-2903$/);
  assert.equal(parkingChapter?.category, 'Parking');
  assert.equal(parkingChapter?.url, 'https://codes.ohio.gov/ohio-revised-code/chapter-4521');
  assert.equal(cityChapter?.citation, 'CCC Chapter 2303');
  assert.equal(cityChapter?.title, 'Homicide, Assault, and Threats');
  assert.equal(cityChapter?.category, 'Criminal');
  assert.equal(cityChapter?.jurisdiction, 'Local (Columbus)');
  assert.equal(cityChapter?.url, 'https://library.municode.com/oh/columbus/codes/code_of_ordinances');
  assert.match(cityChapter?.summary ?? '', /not the ordinance text/);
  assert.equal(cityAssault?.citation, 'CCC 2303.13');
  assert.ok(cityAssault?.url.startsWith('https://library.municode.com/oh/columbus/'));
  assert.match(cityAssault?.url ?? '', /2303\.13AS$/);
  assert.doesNotMatch(cityAssault?.summary ?? '', /ORC 2903\.13|corresponding/i);
  assert.equal(OHIO_REVISED_CODE_ENTRIES.length, 33);
  assert.equal(LAW_LIBRARY_ENTRIES.length, OHIO_REVISED_CODE_ENTRIES.length + COLUMBUS_CITY_CODE_ENTRIES.length + CASE_LAW_ENTRIES.length);
});

test('the imported chapter catalog matches the supplied CSV without inventing legal text', () => {
  const orcChapters = OHIO_REVISED_CODE_ENTRIES.filter(entry => entry.id.includes('-chapter-'));
  const cccChapters = COLUMBUS_CITY_CODE_ENTRIES.filter(entry => entry.id.includes('-chapter-'));
  assert.equal(orcChapters.length, 33);
  assert.equal(cccChapters.length, 18);
  assert.ok(orcChapters.every(entry => entry.url.startsWith('https://codes.ohio.gov/ohio-revised-code/chapter-')));
  assert.ok(cccChapters.every(entry => entry.url.startsWith('https://library.municode.com/oh/columbus/')));
  assert.ok(cccChapters.every(entry => /chapter index|not the ordinance text/.test(entry.summary)));
});

test('case references link to Oyez and official sources remain discoverable', () => {
  assert.ok(CASE_LAW_ENTRIES.every(entry => entry.url.startsWith('https://www.oyez.org/cases/')));
  assert.ok(LAW_LIBRARY_SOURCES.some(source => source.label === 'Ohio Public Defender Legal Glossary'));
  assert.ok(LAW_LIBRARY_SOURCES.some(source => source.label === 'Columbus City Code'));
  assert.ok(LAW_LIBRARY_SOURCES.some(source => source.label === 'Ohio Public Defender Criminal Law Casebook'));
  assert.ok(LAW_LIBRARY_SOURCES.some(source => source.label === 'Oyez Supreme Court cases'));
});
