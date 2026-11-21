import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateOrcCorpusData, type OrcCorpusManifest, type OfficialOrcSection } from './orc-law-data.js';

const dataDirectory = new URL('../../public/law-data/', import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL('orc-corpus-manifest.json', dataDirectory), 'utf8'),
) as OrcCorpusManifest;
const chunks = manifest.files.map((file) => (
  JSON.parse(readFileSync(new URL(file, dataDirectory), 'utf8')) as OfficialOrcSection[]
));
const sections = validateOrcCorpusData(manifest, chunks);

test('the local ORC corpus is complete, unique, and linked to official sections', () => {
  assert.equal(sections.length, 1625);
  assert.equal(new Set(sections.map((section) => section.id)).size, sections.length);
  assert.ok(sections.every((section) => section.text.trim().length > 0));
  assert.ok(sections.every((section) => section.sourceUrl.startsWith('https://codes.ohio.gov/ohio-revised-code/section-')));
  assert.ok(sections.some((section) => section.citation === 'ORC 2903.13'));
  assert.ok(sections.some((section) => section.citation === 'ORC 2911.01' && section.text.includes('deadly weapon')));
});

test('traffic and parking sections include exact current source text and metadata', () => {
  const prohibitedParking = sections.find((section) => section.citation === 'ORC 4511.68');
  const localParking = sections.find((section) => section.citation === 'ORC 4521.01');
  assert.equal(prohibitedParking?.category, 'Parking');
  assert.match(prohibitedParking?.text ?? '', /No person shall stand or park/i);
  assert.equal(localParking?.category, 'Parking');
  assert.match(localParking?.title ?? '', /parking infraction/i);
  assert.ok(prohibitedParking?.effectiveDate);
  assert.ok(prohibitedParking?.latestLegislation);
});

test('the corpus is timestamped so users can verify later amendments', () => {
  assert.equal(manifest.retrievedOn, '2026-11-19');
  assert.equal(manifest.scope.criminalChapters.length, 15);
  assert.equal(manifest.scope.motorVehicleTrafficAndParkingChapters.length, 18);
  assert.ok(sections.every((section) => section.retrievedAt === manifest.retrievedOn));
});
