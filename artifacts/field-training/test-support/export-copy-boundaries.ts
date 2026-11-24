import assert from 'node:assert/strict';
import { findForbiddenCopy } from './ui-copy-audit.js';

export function assertExportCopy(exportName: string, content: string, requiredCopy: string[]) {
  for (const finding of findForbiddenCopy(content)) {
    assert.fail(`${exportName} contains developer commentary "${finding.text}" (${finding.rule}).`);
  }
  for (const text of requiredCopy) {
    assert.ok(content.includes(text), `${exportName} is missing required wording "${text}".`);
  }
}
