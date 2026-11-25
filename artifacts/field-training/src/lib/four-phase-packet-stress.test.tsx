import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { PrintableDailyLog } from '../components/printable-daily-log.js';
import { buildOperationalPacket, resolveOperationalPacket } from './operational-state-machine.js';
import { buildClassWorkbook } from './exportWorkbook.js';
import { parseRosterRows, ROSTER_CSV_TEMPLATE } from './assignment-import.js';
import { OfflineStorage } from './offlineStorage.js';
import { getPhaseScheduleInfo, getSundaySaturdayWeek } from './training-calendar.js';
import { PHASE_LENGTH_WEEKS, validateReport, type Phase } from './model.js';
import {
  createFtoFourPhasePacketStressWorkspace,
  FTO_FOUR_PHASE_STRESS_CLASS,
  FTO_FOUR_PHASE_STRESS_COUNT,
} from './test-packet.js';

const phases: Phase[] = [1, 2, 3, 4];
const passphrase = new TextEncoder().encode('fictional-four-phase-local-test-passphrase');
let cohort = createFtoFourPhasePacketStressWorkspace();
let selectedPackets = cohort.reports.filter(report =>
  report.phase === 4 && report.phaseWeek === PHASE_LENGTH_WEEKS[4] && report.id.endsWith('2025-04-17'),
);

test('four-phase cohort deterministically covers 100 fictional recruits and all configured workdays', () => {
  const startedAt = performance.now();
  assert.equal(cohort.reports.length, 6_800);
  assert.equal(cohort.assignments.length, 400);
  assert.equal(cohort.phaseFolders.length, 400);
  assert.equal(cohort.weeklyPerformanceLogs.length, 1_500);
  assert.equal(cohort.substationOrientations.length, 400);
  assert.equal(selectedPackets.length, FTO_FOUR_PHASE_STRESS_COUNT);
  assert.deepEqual(
    phases.map(phase => cohort.reports.filter(report => report.phase === phase).length),
    [2_000, 2_000, 1_600, 1_200],
  );
  assert.deepEqual(
    [...new Set(cohort.reports.map(report => report.ftoWeek))].sort((a, b) => Number(a) - Number(b)),
    Array.from({ length: 15 }, (_, index) => index + 1),
  );
  assert.equal(new Set(cohort.reports.map(report => report.id)).size, cohort.reports.length);
  assert.equal(new Set(cohort.reports.map(report => report.recruitBadge)).size, FTO_FOUR_PHASE_STRESS_COUNT);
  assert.equal(new Set(cohort.assignments.map(assignment => assignment.id)).size, cohort.assignments.length);
  assert.equal(new Set(cohort.reports.map(report => `${report.recruitBadge}:${report.phase}:${report.phaseWeek}`)).size,
    FTO_FOUR_PHASE_STRESS_COUNT * 15);
  assert.equal(new Set(cohort.weeklyPerformanceLogs.map(log => log.id)).size, cohort.weeklyPerformanceLogs.length);
  assert.equal(new Set(cohort.substationOrientations.map(record => record.id)).size, cohort.substationOrientations.length);
  assert.ok(cohort.reports.every(report =>
    report.className === FTO_FOUR_PHASE_STRESS_CLASS &&
    report.recruitBadge.startsWith('TEST-4P-') &&
    report.recruitName.startsWith('Jordan Sample ') &&
    report.status === 'draft' &&
    report.syncStatus === 'local_draft_pending' &&
    Object.keys(report.signatures).length === 0,
  ));
  assert.ok(cohort.reports.every(report => validateReport(report).length === 0));
  assert.ok([...new Set(cohort.reports.map(report => report.recruitBadge))].every(badge =>
    cohort.reports.filter(report => report.recruitBadge === badge).length === 68,
  ));
  assert.ok(cohort.assignments.every(assignment => assignment.className === FTO_FOUR_PHASE_STRESS_CLASS));
  assert.ok(cohort.substationOrientations.every(record =>
    record.className === FTO_FOUR_PHASE_STRESS_CLASS &&
    cohort.phaseFolders.some(folder =>
      folder.recruitBadge === record.recruitBadge &&
      folder.recruitName === record.recruitName &&
      folder.phase === record.phase,
    ),
  ));
  assert.ok(cohort.weeklyPerformanceLogs.every(log =>
    log.className === FTO_FOUR_PHASE_STRESS_CLASS &&
    log.id.includes(log.recruitBadge) &&
    log.entries.every(entry => entry.sourceReportIds.every(id => cohort.reports.some(report =>
      report.id === id && report.recruitBadge === log.recruitBadge && report.phase === log.phase))),
  ));
  assert.ok(cohort.reports.every(report => {
    const folder = cohort.phaseFolders.find(item =>
      item.recruitBadge === report.recruitBadge && item.phase === report.phase,
    );
    const assignment = cohort.assignments.find(item =>
      item.recruitBadge === report.recruitBadge && item.phase === report.phase,
    );
    return !!folder && !!assignment &&
      folder.recruitName === report.recruitName &&
      assignment.recruitName === report.recruitName &&
      assignment.id === folder.assignmentId &&
      getPhaseScheduleInfo(
      report.phase, report.date, folder.phaseStartDate, folder.daysOff, folder.phaseWeekRanges,
      ).phaseWeek === report.phaseWeek;
  }));
  const expectedDates = cohort.reports
    .filter(report => report.recruitBadge === 'TEST-4P-001')
    .map(report => `${report.phase}:${report.date}`);
  assert.equal(new Set(expectedDates).size, 68);
  assert.deepEqual(
    phases.map(phase => cohort.phaseFolders.filter(folder => folder.phase === phase).length),
    [100, 100, 100, 100],
  );
  assert.ok(cohort.reports.some(report => report.limboDay));
  assert.ok(cohort.reports.some(report => report.narrative.includes('FICTIONAL END MARKER 001 · PHASE 1')));
  assert.ok(cohort.reports.some(report => report.narrative.includes('FICTIONAL END MARKER 001 · PHASE 4')));
  const rebuilt = createFtoFourPhasePacketStressWorkspace();
  assert.deepEqual(rebuilt.reports.map(report => report.id), cohort.reports.map(report => report.id));
  assert.deepEqual(rebuilt.weeklyPerformanceLogs.map(log => log.id), cohort.weeklyPerformanceLogs.map(log => log.id));
  assert.equal(rebuilt.reports.find(report => report.id === selectedPackets[0]!.id)?.narrative,
    selectedPackets[0]!.narrative);

  const elapsedMilliseconds = performance.now() - startedAt;
  const fixtureBytes = Buffer.byteLength(JSON.stringify({
    reports: cohort.reports,
    weeklyPerformanceLogs: cohort.weeklyPerformanceLogs,
    assignments: cohort.assignments,
  }));
  console.log('FOUR_PHASE_COHORT_METRICS ' + JSON.stringify({
    recruits: FTO_FOUR_PHASE_STRESS_COUNT,
    assignments: cohort.assignments.length,
    phaseFolders: cohort.phaseFolders.length,
    dailyReports: cohort.reports.length,
    weeklyPerformanceLogs: cohort.weeklyPerformanceLogs.length,
    orientations: cohort.substationOrientations.length,
    runs: cohort.reports.reduce((sum, report) => sum + report.runs.length, 0),
    dailyByPhase: [2_000, 2_000, 1_600, 1_200],
    fixtureSerializedBytes: fixtureBytes,
    generationAndIntegrityMilliseconds: Math.round(elapsedMilliseconds * 100) / 100,
  }));
});

test('the supported roster importer parses all four fictional phase assignments', () => {
  const rows: string[][] = [
    ROSTER_CSV_TEMPLATE.split('\n')[0]!.split(','),
    ...cohort.assignments.map(assignment => [
      assignment.className,
      assignment.recruitName,
      assignment.recruitBadge,
      '',
      'Casey Training Example',
      assignment.ftoBadge,
      '',
      String(assignment.phase),
      assignment.phaseStartDate.split('-').slice(1).concat(assignment.phaseStartDate.split('-')[0]).join('/'),
      assignment.shift ?? '',
      (assignment.daysOff ?? []).map(day =>
        ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] ?? '',
      ).join(';'),
      assignment.zone ?? '',
      assignment.precinct ?? '',
      assignment.cruiserDistrict ?? '',
      assignment.ftoAssignment ?? '',
    ]),
  ];
  const parsed = parseRosterRows(rows);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.sourceRows, 400);
  assert.equal(parsed.assignments.length, 400);
  assert.equal(new Set(parsed.assignments.map(item => `${item.recruitBadge}:${item.phase}`)).size, 400);
  assert.deepEqual(
    phases.map(phase => parsed.assignments.filter(item => item.phase === phase).length),
    [100, 100, 100, 100],
  );
});

test('the 6,800-row portal report view renders all phases and filters Phase IV', () => {
  return (async () => {
    const descriptors = new Map<string, PropertyDescriptor | undefined>();
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      pretendToBeVisual: true,
      url: 'https://localhost/',
    });
    for (const [key, value] of Object.entries({
      window: dom.window,
      document: dom.window.document,
      navigator: dom.window.navigator,
      location: dom.window.location,
      addEventListener: dom.window.addEventListener.bind(dom.window),
      removeEventListener: dom.window.removeEventListener.bind(dom.window),
      dispatchEvent: dom.window.dispatchEvent.bind(dom.window),
      HTMLElement: dom.window.HTMLElement,
      Node: dom.window.Node,
      IS_REACT_ACT_ENVIRONMENT: true,
    })) {
      descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    const appRoot = fileURLToPath(new URL('../../', import.meta.url));
    const vite = await createServer({
      root: appRoot,
      configFile: fileURLToPath(new URL('../../vite.config.ts', import.meta.url)),
      server: { middlewareMode: true },
      appType: 'custom',
    });
    const root = createRoot(dom.window.document.getElementById('root')!);
    try {
      const [{ default: Reports }, { WorkspaceProvider }] = await Promise.all([
        vite.ssrLoadModule('/src/pages/reports.tsx'),
        vite.ssrLoadModule('/src/state/workspace.tsx'),
      ]);
      const renderStarted = performance.now();
      await act(async () => {
        root.render(createElement(WorkspaceProvider, {
          previewOnly: true,
          previewWorkspace: () => cohort,
          children: createElement(Reports),
        }));
      });
      const initialRenderMilliseconds = performance.now() - renderStarted;
      const heading = dom.window.document.querySelector('h1')?.textContent;
      assert.equal(heading, '6800 of 6800 records');
      assert.equal(dom.window.document.querySelectorAll('[data-testid^="row-report-fto-stress4-report-"]').length, 6_800);

      const filter = dom.window.document.querySelector<HTMLInputElement>('[data-testid="select-phase"]');
      assert.ok(filter);
      await act(async () => {
        filter.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      const phaseOption = [...dom.window.document.querySelectorAll('[role="option"]')]
        .find(option => option.textContent === 'Phase 4');
      assert.ok(phaseOption, 'phase selector should expose the Phase 4 option when opened');
      const filterStarted = performance.now();
      await act(async () => {
        phaseOption.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      const filterMilliseconds = performance.now() - filterStarted;
      assert.equal(dom.window.document.querySelector('h1')?.textContent, '1200 of 6800 records');
      assert.equal(dom.window.document.querySelectorAll('[data-testid^="row-report-fto-stress4-report-"]').length, 1_200);
      assert.ok(dom.window.document.querySelector(`[data-testid="row-report-${selectedPackets[0]!.id}"]`));
      assert.ok(!dom.window.document.querySelector('[data-testid="row-report-fto-stress4-report-001-p1-2025-01-06"]'));
      console.log('FOUR_PHASE_PORTAL_VIEW_METRICS ' + JSON.stringify({
        renderedDailyRowsBeforeFilter: 6_800,
        renderedDailyRowsAfterPhaseFourFilter: 1_200,
        initialRenderMilliseconds: Math.round(initialRenderMilliseconds * 100) / 100,
        phaseFilterMilliseconds: Math.round(filterMilliseconds * 100) / 100,
        phaseFilterInteraction: 'selected Phase 4 in mounted React view',
      }));
    } finally {
      await act(async () => root.unmount());
      await vite.close();
      dom.window.close();
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  })();
});

test('printable packet views keep Phase IV records isolated across all 100 recruits', () => {
  const startedAt = performance.now();
  let markupBytes = 0;
  for (const report of selectedPackets) {
    const packet = resolveOperationalPacket(report, cohort.phaseFolders, cohort.substationOrientations);
    const markup = renderToStaticMarkup(createElement(PrintableDailyLog, {
      report,
      dayReference: packet.dayReference,
    }));
    assert.ok(packet.pages.length > 0);
    assert.ok(markup.includes(report.recruitBadge));
    assert.ok(markup.includes(report.date));
    assert.ok(markup.includes(report.narrative.split('\n').at(-1)!));
    markupBytes += Buffer.byteLength(markup);
  }
  console.log('FOUR_PHASE_SELECTED_PRINT_METRICS ' + JSON.stringify({
    selectedPhaseFourPacketViews: selectedPackets.length,
    printableMarkupBytes: markupBytes,
    printViewMilliseconds: Math.round((performance.now() - startedAt) * 100) / 100,
  }));
});

test('the full-cohort workbook and phase-boundary PDF packet retain records and narrative endings', () => {
  const startedAt = performance.now();
  const workbook = buildClassWorkbook(
    cohort.reports,
    cohort.weeklyAcknowledgements,
    cohort.weeklyPerformanceLogs,
    cohort.substationOrientations,
    cohort.phaseFolders,
  );
  const serializationStarted = performance.now();
  const xlsxBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const serializationMilliseconds = performance.now() - serializationStarted;
  assert.ok(Buffer.isBuffer(xlsxBytes));
  assert.ok(xlsxBytes.byteLength > 0);
  const dailyIndex = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['Daily Summary Index'], { header: 1 });
  const phaseTotals = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['Phase Totals'], { header: 1 });
  const weeklyTotals = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['Weekly Totals'], { header: 1 });
  const narrativeRows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets['Daily Narratives'], { header: 1 });
  const reportIds = new Set(dailyIndex.slice(1).map(row => row[11]));
  assert.equal(dailyIndex.length, cohort.reports.length + 1);
  assert.equal(phaseTotals.length, FTO_FOUR_PHASE_STRESS_COUNT * 4 + 1);
  assert.equal(weeklyTotals.length, cohort.weeklyPerformanceLogs.length + 1);
  assert.ok(narrativeRows.some(row => String(row[6] ?? '').includes('FICTIONAL END MARKER 001 · PHASE 4')));
  assert.ok(cohort.reports.every(report => reportIds.has(report.id)));
  assert.deepEqual(
    phases.map(phase => phaseTotals.slice(1)
      .filter(row => Number(row[3]) === phase)
      .reduce((sum, row) => sum + Number(row[5]), 0)),
    [2_000, 2_000, 1_600, 1_200],
  );
  const weeklyHeader = weeklyTotals[0]!.map(String);
  const phaseColumn = weeklyHeader.indexOf('Phase');
  const sourceIdsColumn = weeklyHeader.indexOf('Source daily log IDs');
  const reportsById = new Map(cohort.reports.map(report => [report.id, report]));
  assert.ok(weeklyTotals.slice(1).every(row => {
    const sourceIds = String(row[sourceIdsColumn]).split('; ');
    const sourceReports = sourceIds.map(id => reportsById.get(id));
    const first = sourceReports[0];
    if (!first || sourceReports.some(report => !report)) return false;
    const firstWeek = getSundaySaturdayWeek(first.date);
    return sourceReports.length === (first.phase <= 2 ? 5 : 4) &&
      sourceReports.every(report =>
        report!.recruitBadge === row[1] &&
        report!.phase === Number(row[phaseColumn]) &&
        report!.phase === first.phase &&
        report!.phaseWeek === first.phaseWeek &&
        report!.ftoWeek === first.ftoWeek &&
        getSundaySaturdayWeek(report!.date)?.start === firstWeek?.start,
      );
  }));

  const phaseBoundaryReports = phases.flatMap(phase => {
    const phaseReports = cohort.reports.filter(report => report.recruitBadge === 'TEST-4P-001' && report.phase === phase);
    return [phaseReports[0]!, phaseReports.at(-1)!];
  });
  for (const report of phaseBoundaryReports) {
    const packet = resolveOperationalPacket(report, cohort.phaseFolders, cohort.substationOrientations);
    const printed = renderToStaticMarkup(createElement(PrintableDailyLog, {
      report,
      dayReference: packet.dayReference,
    }));
    assert.ok(printed.includes(report.recruitBadge));
    assert.ok(printed.includes(report.date));
    assert.ok(buildOperationalPacket(report, { dayReference: packet.dayReference }).pages.length >= 1);
  }
  const longEnd = cohort.reports.find(report => report.narrative.includes('FICTIONAL END MARKER 001 · PHASE 4'))!;
  const longMarkup = renderToStaticMarkup(createElement(PrintableDailyLog, {
    report: longEnd,
    dayReference: resolveOperationalPacket(longEnd, cohort.phaseFolders, cohort.substationOrientations).dayReference,
  }));
  assert.ok(longMarkup.includes('FICTIONAL END MARKER 001 · PHASE 4'));
  console.log('FOUR_PHASE_EXPORT_METRICS ' + JSON.stringify({
    workbookSheets: workbook.SheetNames.length,
    dailySummaryRows: dailyIndex.length - 1,
    phaseSummaryRows: phaseTotals.length - 1,
    weeklySummaryRows: weeklyTotals.length - 1,
    narrativeRows: narrativeRows.length - 1,
    boundaryPdfPacketsRendered: phaseBoundaryReports.length,
    xlsxFileBytes: xlsxBytes.byteLength,
    xlsxSerializationMilliseconds: Math.round(serializationMilliseconds * 100) / 100,
    workbookAndBoundaryExportMilliseconds: Math.round((performance.now() - startedAt) * 100) / 100,
  }));
});

test('encrypted local cohort save/reopen and selected draft-sync retry preserve isolated records', async () => {
  const namespace = `SYNTHETIC-four-phase-local-${crypto.randomUUID()}`;
  const saveStarted = performance.now();
  const vault = new OfflineStorage(namespace);
  await vault.unlock(passphrase);
  await vault.saveWorkspace(cohort);
  const saveMilliseconds = performance.now() - saveStarted;
  assert.equal(await vault.pendingPacketCount(), cohort.reports.length);

  const reopened = new OfflineStorage(namespace);
  await reopened.unlock(passphrase);
  const reopenedAt = performance.now();
  const saved = await reopened.get<typeof cohort>('workspace');
  const reopenMilliseconds = performance.now() - reopenedAt;
  assert.equal(saved?.reports.length, 6_800);
  assert.equal(saved?.weeklyPerformanceLogs.length, 1_500);
  assert.equal(saved?.reports.find(report => report.id === selectedPackets[0]!.id)?.narrative, selectedPackets[0]!.narrative);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`fieldready-vault-${namespace}`, 2);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const encrypted = await new Promise<{ ciphertext: ArrayBuffer }>((resolve, reject) => {
    const request = db.transaction('records').objectStore('records').get('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.ok(encrypted.ciphertext instanceof ArrayBuffer);
  assert.ok(!new TextDecoder().decode(encrypted.ciphertext).includes('FICTIONAL END MARKER'));
  db.close();
  vault.lock();
  reopened.lock();

  const lifecycleNamespace = `SYNTHETIC-four-phase-lifecycle-${crypto.randomUUID()}`;
  const lifecycle = new OfflineStorage(lifecycleNamespace);
  await lifecycle.unlock(passphrase);
  const selectedWorkspace = { ...cohort, reports: selectedPackets };
  await lifecycle.saveWorkspace(selectedWorkspace);
  lifecycle.lock();
  const lifecycleReopened = new OfflineStorage(lifecycleNamespace);
  await lifecycleReopened.unlock(passphrase);
  await lifecycleReopened.get('workspace');
  const operations: string[] = [];
  let lostResponse = true;
  const transport = async (changes: import('./offlineStorage.js').PendingChange[]) => {
    const ids = changes.map(change => change.operationId);
    if (lostResponse) {
      lostResponse = false;
      operations.push(...ids);
      throw new Error('Synthetic response interruption after commit.');
    }
    assert.deepEqual(ids, operations);
    return changes.map(change => ({
      id: change.recordId,
      operation_id: change.operationId,
      server_version: 1,
      sync_status: 'local_draft_pending' as const,
      content_hash: 'c'.repeat(64),
    }));
  };
  await assert.rejects(lifecycleReopened.syncPacketBatch(transport), /Synthetic response interruption/);
  lifecycleReopened.lock();
  const afterInterruption = new OfflineStorage(lifecycleNamespace);
  await afterInterruption.unlock(passphrase);
  await afterInterruption.get('workspace');
  const synced = await afterInterruption.syncPacketBatch<typeof selectedWorkspace>(transport);
  assert.equal(synced?.reports.length, FTO_FOUR_PHASE_STRESS_COUNT);
  assert.ok(synced?.reports.every(report =>
    report.syncStatus === 'local_draft_pending' &&
    report.serverVersion === 1 &&
    report.draftSyncPending === false &&
    report.signatures && Object.keys(report.signatures).length === 0,
  ));
  assert.equal(await afterInterruption.pendingPacketCount(), 0);
  const finalizationTarget = selectedPackets[0]!;
  const submitted = await afterInterruption.finalizePacket<typeof selectedWorkspace>(
    finalizationTarget.id,
    async (id, _operationId, contentHash) => ({
      id,
      server_version: 1,
      sync_status: 'submitted_complete',
      content_hash: contentHash,
    }),
  );
  assert.equal(submitted?.reports.filter(report => report.syncStatus === 'submitted_complete').length, 1);
  assert.equal(submitted?.reports.filter(report => report.syncStatus === 'local_draft_pending').length, 99);
  assert.equal(submitted?.reports.find(report => report.id === finalizationTarget.id)?.signatures &&
    Object.keys(submitted.reports.find(report => report.id === finalizationTarget.id)!.signatures).length, 0);
  afterInterruption.lock();

  console.log('FOUR_PHASE_LOCAL_STORAGE_METRICS ' + JSON.stringify({
    encryptedCohortSaveMilliseconds: Math.round(saveMilliseconds * 100) / 100,
    encryptedCohortReopenMilliseconds: Math.round(reopenMilliseconds * 100) / 100,
    fullCohortPendingPackets: cohort.reports.length,
    selectedLifecyclePackets: FTO_FOUR_PHASE_STRESS_COUNT,
    interruptedRequests: 1,
    exactRetryOperations: operations.length,
    explicitLocalFinalizations: 1,
  }));
});

