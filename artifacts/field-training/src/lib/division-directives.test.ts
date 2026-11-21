import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIVISION_DIRECTIVES,
  DIVISION_DIRECTIVE_SOURCE_REVISION,
  formatSelectedDivisionDirectives,
} from './division-directives';

test('directive picker uses current official public directive titles and numbers', () => {
  assert.equal(DIVISION_DIRECTIVE_SOURCE_REVISION, '09/30/2026');
  assert.equal(DIVISION_DIRECTIVES.length, 103);
  assert.equal(new Set(DIVISION_DIRECTIVES.map((directive) => directive.number)).size, DIVISION_DIRECTIVES.length);
  assert.ok(DIVISION_DIRECTIVES.every((directive) => /^\d{1,2}\.\d{2}$/.test(directive.number) && directive.title.length > 0));
  assert.ok(DIVISION_DIRECTIVES.some((directive) => directive.number === '1.01' && directive.title === 'Rules of Conduct'));
  assert.ok(DIVISION_DIRECTIVES.some((directive) => directive.number === '3.01' && directive.title === 'Arrests and Warrants'));
});

test('selected directive references print as number plus official title', () => {
  assert.deepEqual(formatSelectedDivisionDirectives(['3.01', '5.07']), [
    '3.01 Arrests and Warrants',
    '5.07 Enforcement of Traffic and Parking Violations',
  ]);
  assert.deepEqual(formatSelectedDivisionDirectives(['manual-entry']), ['manual-entry']);
});
