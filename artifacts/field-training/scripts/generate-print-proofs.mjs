// Render the real print components with fictional, memory-only data.
// Run after `pnpm --filter @workspace/field-training run build`.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, '../../generated-artifacts/run-form-proofs');
await fs.mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root,
  cacheDir: path.join(output,'vite-cache'),
  resolve: { alias: { '@': path.join(root, 'src') }, dedupe: ['react', 'react-dom'] },
  esbuild: { jsx: 'automatic' },
  server: { middlewareMode: true },
  appType: 'custom',
});
try {
  const load = name => server.ssrLoadModule(`/src/${name}`);
  const model = await load('lib/model.ts');
  const { seedReports } = await load('lib/seed.ts');
  const { buildOperationalPacket } = await load('lib/operational-state-machine.ts');
  const { PrintableDailyForms } = await load('components/printable-daily-forms.tsx');
  const { PrintableSubstationOrientation } = await load('components/printable-extended-forms.tsx');
  const { PrintableWeeklyPerformanceLog, PrintableOrientationContinuations } = await load('components/printable-extended-forms.tsx');
  const { PrintableDailyLog } = await load('components/printable-daily-log.tsx');
  const { PrintableWeeklySummary } = await load('components/printable-weekly-summary.tsx');
  const { PrintableMonthlySummary } = await load('components/printable-monthly-summary.tsx');
  const { PrintableWeeklyAcknowledgement } = await load('components/printable-weekly-ack.tsx');
  const { summarizeMonthlyReports } = await load('lib/monthly-summary.ts');
  const { defaultSubstationOrientationChecklist } = await load('lib/substation-orientation.ts');
  const {buildMonthlyWorkbook,serializeMonthlyWorkbook}=await load('lib/monthly-export.ts');
  const now = '2026-11-23T18:00:00Z';
  const report = {
    ...seedReports()[0], id: 'fictional-print-proof', date: '2026-11-23',
    className: 'FICTIONAL PRINT PREVIEW', recruitName: 'Sample Probationary Officer',
    recruitBadge: 'DEMO-PO', ftoName: 'Sample Training Officer', ftoBadge: 'DEMO-FTO',
    narrative: 'Fictional design sample only. No operational incident or person is represented.',
    remedial: '', status: 'draft', updatedAt: now, createdAt: now,
    shiftStartTime: '14:00', runs: [],
  };
  const forms = model.PRIMARY_RUN_FORMS;
  const workbookDates=['2026-11-02','2026-11-09','2026-11-16','2026-11-23'];
  const workbookReports=workbookDates.map((date,index)=>({...report,id:`fictional-excel-${index}`,date,phaseWeek:index+1,ratingsReviewedAt:now,activityReviewedAt:now,activity:{...model.emptyDailyActivitySummary(),trafficStops:index+1}}));
  const workbookRanges=[['2026-11-01','2026-11-07'],['2026-11-08','2026-11-14'],['2026-11-15','2026-11-21'],['2026-11-22','2026-11-28']].map(([startDate,endDate])=>({startDate,endDate}));
  await fs.writeFile(path.join(output,'Monthly-Excel-Landscape-Preview.xlsx'),Buffer.from(serializeMonthlyWorkbook(buildMonthlyWorkbook(workbookReports,'2026-11',workbookRanges))));
  report.runs = forms.map((form, index) => ({
    id: `proof-${form.key}`, runKind: form.key, occurredAt: now, isDispatched: true,
    trafficMode: form.key.includes('stop') ? 'motor_vehicle' : 'none',
    arrestMade: index === 0, transportedAfterArrest: index === 0,
    oviProcessed: index === 0, buildingSearchRequired: index === 0,
    narrativeAdditionRequired: index === 0, formStatus: 'complete',
    incidentNumber: `FICTIONAL-${index + 1}`, location: 'Fictional Training Site',
    locationCity: 'Columbus', locationState: 'OH', locationZip: '',
    incidentZone: '1', incidentCruiserDistrict: '10',
    checklist: model.newRunChecklist(form.key),
    checklistReviewedAt: now, dispatchedAt: '2026-11-23T17:45:00Z', clearedAt: now,
    narrative: 'Fictional design sample only. The training officer and probationary officer reviewed the listed tasks. This example contains no operational incident identifiers or real personal information.',
    radioCode: '10-8', clearanceCode: '1A',
  }));
  Object.assign(report.runs[0].checklist, { 'task-0': false, 'task-2': false, 'task-4': false, 'supp-arrest_process-0': false });
  const selectedTraffic=report.runs.find(run=>run.runKind==='traffic_stop');
  Object.assign(selectedTraffic,{trafficMode:'pedestrian',activityFlags:{solveCitationSummons:true,trafficCitations:true}});
  const packet = buildOperationalPacket(report, { dayReference: { week: 1, day: 1 } });
  const markup = renderToStaticMarkup(React.createElement(PrintableDailyForms, { report, packet }));
  const assets = path.join(root, 'dist/public/assets');
  const cssFile = (await fs.readdir(assets)).find(name => /^index-.*\.css$/.test(name));
  if (!cssFile) throw new Error('Build CSS is missing. Run the production build first.');
  let css = await fs.readFile(path.join(assets, cssFile), 'utf8');
  for (const font of (await fs.readdir(assets)).filter(name => /^lato-.*\.ttf$/.test(name))) {
    const data = (await fs.readFile(path.join(assets, font))).toString('base64');
    css = css.replaceAll(`/assets/${font}`, `data:font/ttf;base64,${data}`);
  }
  // Embed local branding assets so the proofs work offline and do not need auth.
  const inlineBranding = async html => {
    for (const name of ['silver-police-badge.png', 'columbus-police-patch-white-eagle.png']) {
      const data = (await fs.readFile(path.join(root, 'public/branding', name))).toString('base64');
      html = html.replaceAll(`/branding/${name}`, `data:image/png;base64,${data}`);
    }
    return html;
  };
  const manifest = [];
  async function writeProof(slug, title, html, kind = 'run') {
    const wrapper = kind === 'orientation' ? html : `<section class="print-run-packet">${html}</section>`;
    const document = `<!doctype html><html><head><meta charset="utf-8"><title>${title} — fictional print proof</title><style>${css}
      @media print { html,body {margin:0!important;padding:0!important;min-height:0!important}
      body>* {visibility:visible!important} .print-run-packet {display:block!important;position:static!important}
      .print-substation {position:static!important} }
      </style></head><body>${wrapper}</body></html>`;
    await fs.writeFile(path.join(output, `${slug}.html`), await inlineBranding(document));
    manifest.push({ slug, title, kind });
  }
  const articles = [...markup.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(match => match[0]);
  if (articles.length !== 12) throw new Error(`Expected 12 duty/run/supplement proofs, found ${articles.length}.`);
  for (const article of articles) {
    const testId = /data-testid="([^"]+)"/.exec(article)?.[1];
    if (!testId) throw new Error('An exported form has no stable preview identifier.');
    const title = /<h1>([\s\S]*?)<\/h1>/.exec(article)?.[1]?.replace(/<[^>]+>/g, '') ?? testId;
    await writeProof(testId, title, article);
  }
  const orientation = {
    id: 'fictional-orientation', className: report.className, recruitName: report.recruitName,
    recruitBadge: report.recruitBadge, ftoName: report.ftoName, ftoBadge: report.ftoBadge,
    phase: 1, phaseStartDate: report.date, dateTime: now, substation: '',
    checklist: defaultSubstationOrientationChecklist(), checklistReviewedAt: undefined,
    directivesReview: '', narrative: '', updatedAt: now,
  };
  await writeProof('orientation', 'Substation Orientation', renderToStaticMarkup(
    React.createElement(PrintableSubstationOrientation, { record: orientation, pageReference: 'W1D1P1' }),
  ), 'orientation');
  const continuationSample = Array.from({length:12},(_,index)=>
    `CONTINUATION SAMPLE ${index+1}: Fictional training notes used only to inspect paragraph wrapping, full saved text, and continuation branding.`).join('\n\n');
  await writeProof('orientation-continuation', 'Substation Orientation Continuation · U-10.192',
    renderToStaticMarkup(React.createElement(PrintableOrientationContinuations,{
      record:{...orientation,narrative:continuationSample},pageReferences:['W1D1P2'],
    })),'orientation');
  await writeProof('daily-performance-log', 'Daily Performance Log · U-10.174',
    renderToStaticMarkup(React.createElement(PrintableDailyLog, { report, packet })), 'log');
  const dailyContinuationReport={...report,narrative:continuationSample};
  const dailyContinuationMarkup=renderToStaticMarkup(React.createElement(PrintableDailyLog,{
    report:dailyContinuationReport,
    packet:buildOperationalPacket(dailyContinuationReport,{dayReference:{week:1,day:1}}),
  }));
  const dailyContinuation=[...dailyContinuationMarkup.matchAll(/<article\b[\s\S]*?<\/article>/g)]
    .map(match=>match[0]).find(article=>article.includes('print-daily-narrative-continuation'));
  if(!dailyContinuation)throw new Error('The daily-log continuation proof did not render.');
  await writeProof('daily-log-continuation','Daily Log Narrative Continuation',dailyContinuation,'continuation');
  await writeProof('weekly-performance-summary', 'Weekly Performance Summary · U-10.173',
    renderToStaticMarkup(React.createElement(PrintableWeeklySummary, {
      reports: [report], weekNumber: 1, weekStart: '2026-11-22', weekEnd: '2026-11-28',
    })), 'summary');
  await writeProof('monthly-performance-summary', 'Monthly Performance Summary',
    renderToStaticMarkup(React.createElement(PrintableMonthlySummary, {
      reports: [report], monthKey: '2026-11', ...summarizeMonthlyReports([report]),
    })), 'summary');
  const people = {
    recruitName: report.recruitName, recruitBadge: report.recruitBadge,
    ftoName: report.ftoName, ftoBadge: report.ftoBadge,
  };
  await writeProof('weekly-performance-log', 'Weekly Performance Log · U-10.174S',
    renderToStaticMarkup(React.createElement(PrintableWeeklyPerformanceLog, { log: {
      id: 'fictional-weekly-log', ...people, className: report.className, weekNumber: 1,
      weekStart: '2026-11-22', weekEnd: '2026-11-28', phase: 1, updatedAt: now,
      entries: [
        { id: 'example-strength', kind: 'strength', category: model.SEG_CATEGORIES[0].key,
          totalTime: '00:15', narrative: 'FICTIONAL STRENGTH NOTE: Training discussion was documented for this design proof.',
          sourceReportIds: [report.id], sourceReferences: ['W1D1P2'] },
        { id: 'example-corrective', kind: 'corrective', category: model.SEG_CATEGORIES[1].key,
          totalTime: '00:20', narrative: 'FICTIONAL CORRECTIVE NOTE: Follow-up instruction was documented for this design proof.',
          sourceReportIds: [report.id], sourceReferences: ['W1D1P2'] },
      ],
    } })), 'log');
  await writeProof('weekly-acknowledgement', 'Weekly Packet Acknowledgement',
    renderToStaticMarkup(React.createElement(PrintableWeeklyAcknowledgement, { acknowledgement: {
      id: 'fictional-acknowledgement', ...people, weekNumber: 1, weekStart: '2026-11-22', weekEnd: '2026-11-28', phase: 1,
      recruitAssignment: 'Fictional assignment', ftoAssignment: 'Fictional assignment',
      recruitComments: 'FICTIONAL RECRUIT COMMENT: Shown only to verify that this saved comment prints.',
      ftoComments: 'FICTIONAL FTO COMMENT: Shown only to verify that this saved comment prints.',
      officeComments: '',
      signatures: { recruit: { name: 'FICTIONAL SIGNATURE SAMPLE', badge: 'DEMO', at: now, method: 'demo' } },
      status: 'draft', createdAt: now, updatedAt: now,
    } })), 'acknowledgement');
  for(const long of [false,true]) {
    const log={
      id:'fictional-weekly-layout-verification',...people,className:report.className,weekNumber:1,
      weekStart:'2026-11-22',weekEnd:'2026-11-28',phase:1,updatedAt:now,
      entries:long?Array.from({length:18},(_,i)=>({
        id:`fictional-weekly-note-${i+1}`,kind:i===0?'strength':'corrective',category:model.SEG_CATEGORIES[i%model.SEG_CATEGORIES.length].key,
        totalTime:'00:15',narrative:`WEEKLY-NOTE-${String(i+1).padStart(2,'0')}: Fictional training observations verify that longer saved weekly notes remain complete and readable on their continuation sheets.`,
        sourceReportIds:[report.id],sourceReferences:['W1D1P2'],
      })):[],
    };
    await writeProof(`weekly-log-${long?'continuation':'blank'}-verification`,long?'Long weekly log with saved notes':'Blank weekly writing grid',
      renderToStaticMarkup(React.createElement(PrintableWeeklyPerformanceLog,{log})),'verification');
  }
  const missingRun = {
    ...report.runs[0], unitNumber: undefined, incidentNumber: undefined, location: '',
    locationCity: '', locationState: '', incidentZone: '', incidentCruiserDistrict: '',
    transportDestination: undefined, transportDestinationType: undefined,
    trafficMode:'none',activityFlags:{},arrestMade:false,transportedAfterArrest:false,
    arrestProcessRequired:false,oviProcessed:false,oviProcessRequired:false,buildingSearchRequired:false,
    narrative: '', narrativeAdditionRequired: false,
    checklist: { ...Object.fromEntries(Object.keys(report.runs[0].checklist).map(key => [key, false])), 'na-task': true },
  };
  const missingMarkup = renderToStaticMarkup(React.createElement(PrintableDailyForms, {
    report: { ...report, className: '', runs: [missingRun] },
    packet: buildOperationalPacket({ ...report, className: '', runs: [missingRun] }),
  }));
  const missingPrimary = [...missingMarkup.matchAll(/<article\b[\s\S]*?<\/article>/g)]
    .map(match => match[0]).find(article => article.includes('data-testid="print-run-proof-call_for_service"'));
  if (!missingPrimary) throw new Error('Missing-fields proof did not render its run form.');
  if(missingMarkup.includes('data-testid="print-supplement-')||missingMarkup.includes('data-testid="print-narrative-continuation-')) {
    throw new Error('An unselected, unnecessary additional form was exported.');
  }
  for(const label of ['Traffic violator','Solve Citation/Summons*','Additional activity / forms']) {
    if(missingPrimary.includes(`data-print-field="${label}"`))throw new Error(`Unselected optional field printed: ${label}`);
  }
  const trafficArticle=articles.find(article=>article.includes('data-testid="print-run-proof-traffic_stop"'));
  for(const label of ['Traffic violator','Solve Citation/Summons*','Additional activity / forms']) {
    if(!trafficArticle?.includes(`data-print-field="${label}"`))throw new Error(`Selected optional field did not print: ${label}`);
  }
  await writeProof('missing-fields-verification', 'Missing optional fields and not-applicable checklist', missingPrimary, 'verification');
  const longText = Array.from({ length: 75 }, (_, index) =>
    `CONTINUATION-MARKER-${String(index + 1).padStart(3, '0')}: Fictional training narrative used to verify that every paragraph survives export, including long notes and explicit blank lines.`,
  ).join('\n\n');
  const longReport = {
    ...report,
    runs: [{ ...report.runs[0], narrative: longText,
      location:'Fictional Training Facility, Suite 200, Administrative Annex and Classroom Wing',
      activityFlags:{premierOneReports:true,fiReports:true,accidentReports:true,solveCitationSummons:true},
    }],
  };
  const longPacket = buildOperationalPacket(longReport, { dayReference: { week: 1, day: 1 } });
  const longMarkup = renderToStaticMarkup(React.createElement(PrintableDailyForms, {
    report: longReport, packet: longPacket,
  }));
  const continuations = [...longMarkup.matchAll(/<article\b[\s\S]*?<\/article>/g)]
    .map(match => match[0])
    .filter(article => article.includes('data-testid="print-narrative-continuation-'));
  if (!continuations.length) throw new Error('Long narrative did not generate continuation pages.');
  await writeProof('long-continuation-verification', 'Long narrative verification', continuations.join(''), 'verification');
  const longBase=[...longMarkup.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(match=>match[0])
    .find(article=>article.includes('data-testid="print-run-proof-call_for_service"'));
  if(!longBase)throw new Error('Long-record base form is missing.');
  await writeProof('long-run-verification','Long run fields with narrative attached',longBase,'verification');
  const longAck={
    id:'fictional-long-acknowledgement',...people,weekNumber:1,weekStart:'2026-11-22',weekEnd:'2026-11-28',phase:1,
    recruitAssignment:'Fictional assignment',ftoAssignment:'Fictional assignment',
    recruitComments:continuationSample,ftoComments:continuationSample,officeComments:continuationSample,
    signatures:{
      recruit:{name:'FICTIONAL RECRUIT SIGNATURE',badge:'DEMO-PO',at:now},
      fto:{name:'FICTIONAL FTO SIGNATURE',badge:'DEMO-FTO',at:now},
      ftoOffice:{name:'FICTIONAL OFFICE SIGNATURE',badge:'DEMO-OFFICE',at:now},
    },status:'draft',createdAt:now,updatedAt:now,
  };
  await writeProof('acknowledgement-continuation-verification','Long acknowledgement comments and signatures',
    renderToStaticMarkup(React.createElement(PrintableWeeklyAcknowledgement,{acknowledgement:longAck})),'verification');
  await writeProof('acknowledgement-blank-verification','Blank acknowledgement with long personnel names',
    renderToStaticMarkup(React.createElement(PrintableWeeklyAcknowledgement,{acknowledgement:{
      ...longAck,recruitName:'Fictional Probationary Officer With A Deliberately Extended Name For Layout Verification',
      ftoName:'Fictional Field Training Officer With An Extended Name For Layout Verification',
      recruitBadge:'',ftoBadge:'',recruitAssignment:'',ftoAssignment:'',
      recruitComments:'',ftoComments:'',officeComments:'',signatures:{},
    }})),'verification');
  const actualSelf=structuredClone(report);
  actualSelf.runs=actualSelf.runs.filter(run=>run.runKind==='self_initiated');
  actualSelf.runs[0].checklist['task-0']=false;
  const actualSelfMarkup=renderToStaticMarkup(React.createElement(PrintableDailyForms,{report:actualSelf}));
  const actualSelfPage=actualSelfMarkup.match(/<article\b[^>]*data-testid="print-run-proof-self_initiated"[\s\S]*?<\/article>/)?.[0];
  if(!actualSelfPage)throw new Error('Actual-run header fixture was not found.');
  await writeProof('actual-run-header-verification','Self-initiated actual-run marker',actualSelfPage,'verification');
  const order = slug => {
    if (slug === 'orientation') return 0;
    if (slug === 'print-duty-form') return 1;
    const primary = forms.findIndex(form => slug === `print-run-proof-${form.key}`);
    if (primary >= 0) return primary + 2;
    if (slug.includes('narrative-continuation')) return 12;
    const supplement = model.SUPPLEMENTAL_RUN_FORMS.findIndex(form =>
      slug === `print-supplement-proof-call_for_service-${form.key}`);
    return supplement >= 0 ? 9 + supplement : 99;
  };
  manifest.sort((a, b) => order(a.slug) - order(b.slug));
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Created ${manifest.length} fictional proofs in ${output}`);
} finally {
  await server.close();
}
