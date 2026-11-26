import assert from 'node:assert/strict';
import test from 'node:test';
import { searchSavedTrainingRunsByIncidentNumber } from './training-run-search.js';

test('searches runs across saved reports and returns the owning report with each run', () => {
  const reports = [
    {
      id: 'day-one',
      runs: [
        { id: 'run-one', incidentNumber: '012345678', runKind: 'call_for_service' },
        { id: 'run-two', incidentNumber: '998877665', runKind: 'traffic_stop' },
      ],
    },
    {
      id: 'day-two',
      runs: [
        { id: 'run-three', incidentNumber: '0123456789012345', runKind: 'domestic_incident' },
      ],
    },
  ] as const;

  const matches = searchSavedTrainingRunsByIncidentNumber(reports, ' 012345678 ');

  assert.deepEqual(matches, [
    { report: reports[0], run: reports[0].runs[0] },
    { report: reports[1], run: reports[1].runs[0] },
  ]);
  assert.deepEqual(searchSavedTrainingRunsByIncidentNumber(reports, '123000000'), []);
  assert.deepEqual(searchSavedTrainingRunsByIncidentNumber(reports, '  '), []);
});
