import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankSearchChoices } from './search-match';

const choices = [
  { value:'9', label:'Substation 9', searchText:'3022 Winchester Pike Columbus Ohio 43232 614 645 4834' },
  { value:'10', label:'Substation 10', searchText:'4215 Clime Road Columbus Ohio 43228 614 645 4561' },
  { value:'fto-4747', label:'Jane Officer · 4747' },
];

test('search finds entries by names, numeric identifiers, and numeric phone fragments', () => {
  assert.equal(rankSearchChoices(choices, 'winchester')[0]?.value, '9');
  assert.equal(rankSearchChoices(choices, '4747')[0]?.value, 'fto-4747');
  assert.equal(rankSearchChoices(choices, '6454561')[0]?.value, '10');
});

test('search ranks exact and prefix matches ahead of looser matches and supports close letter sequences', () => {
  const ranked = rankSearchChoices(choices, 'sub10');
  assert.equal(ranked[0]?.value, '10');
  assert.equal(rankSearchChoices(choices, 'wincstr')[0]?.value, '9');
});
