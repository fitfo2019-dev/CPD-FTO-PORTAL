import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDateEntryMDY, formatDateTimeEntryMDY, formatTimeEntry24H, splitDateTimeEntryMDY } from './training-calendar.js';
import { parseRunDateTime } from './run-details.js';

function typeAtEnd(initial: string, keys: string) {
  return [...keys].reduce((value, key) => formatDateTimeEntryMDY(value + key), initial);
}

test('shift and run time entry accepts four digits or explicit colons without an AM/PM segment', () => {
  for (const [typed, expected] of [['0830', '08:30'], ['1730', '17:30'], ['8:30', '08:30'], ['00:00', '00:00'], ['23:59', '23:59']]) {
    assert.equal([...typed].reduce((value, key) => formatTimeEntry24H(value + key), ''), expected);
  }
  assert.equal(formatTimeEntry24H(''), '');
  assert.equal(formatTimeEntry24H('?'), '?');
  assert.equal(formatTimeEntry24H(' ? '), '?');
  assert.equal(formatTimeEntry24H('08:'), '08:');
  assert.equal(formatTimeEntry24H('08:3'), '08:3');
  assert.equal(parseRunDateTime(`11/16/2026 ${formatTimeEntry24H('2460')}`), undefined);
});

test('a prefilled date keeps the space and colon while entering orientation or coverage time', () => {
  assert.equal(formatDateTimeEntryMDY('11/16/2026 '), '11/16/2026 ');
  assert.equal(formatDateTimeEntryMDY('11/16/2026 08:'), '11/16/2026 08:');
  assert.equal(typeAtEnd('11/16/2026', ' 08:00'), '11/16/2026 08:00');
  assert.equal(typeAtEnd('11/16/2026 ', '13:45'), '11/16/2026 13:45');
  assert.equal(typeAtEnd('', '111620260800'), '11/16/2026 08:00');
});

test('a single-digit hour followed by a colon is accepted without losing its minutes', () => {
  assert.equal(typeAtEnd('11/16/2026 ', '8:00'), '11/16/2026 08:00');
  assert.equal(formatDateTimeEntryMDY('11/16/2026 8:30'), '11/16/2026 08:30');
  assert.equal(parseRunDateTime('11/16/2026 8:30'), parseRunDateTime('11/16/2026 08:30'));
});

test('incomplete and out-of-range times remain invalid and the current-time shortcut is preserved', () => {
  for (const value of ['11/16/2026 ', '11/16/2026 08:', '11/16/2026 08:0', '11/16/2026 24:00', '11/16/2026 08:60']) {
    assert.equal(parseRunDateTime(value), undefined, value);
  }
  assert.equal(formatDateTimeEntryMDY('?'), '?');
});

test('correcting a separate run date never folds an existing time into its date digits',()=>{
  let date='';
  for(const key of '04212025'){
    const entry=splitDateTimeEntryMDY(`${formatDateEntryMDY(date+key)} 08:30`);
    date=entry.date;
    assert.equal(entry.time,'08:30');
  }
  assert.equal(date,'04/21/2025');
  assert.deepEqual(splitDateTimeEntryMDY(' 08:30'),{date:'',time:'08:30'});
  assert.deepEqual(splitDateTimeEntryMDY('04/ 08:30'),{date:'04',time:'08:30'});
  assert.deepEqual(splitDateTimeEntryMDY('04/21/2025 ?'),{date:'04/21/2025',time:'?'});
  assert.equal(parseRunDateTime(' 08:30'),undefined);
});
