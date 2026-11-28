import XLSX from 'xlsx-js-style';
import {
  CATEGORY_LABEL,
  CATEGORIES,
  DAILY_ACTIVITY_FIELDS,
  DAILY_DUTY_CHECKLIST,
  PHASE_PROGRAM_WEEK_START,
  phaseAssignmentLabel,
  RUN_CHECKLIST_SECTIONS,
  RUN_SUPPLEMENT_CHECKLIST_SECTIONS,
  PRIMARY_RUN_FORMS,
  RATING_LEGEND,
  RATINGS,
  SUPPLEMENTAL_RUN_FORMS,
  requiredSupplementalForms,
  type Report,
  type Rating,
  type WeeklyPacketAcknowledgement,
  type WeeklyPerformanceLog,
  type SubstationOrientationRecord,
  type PhaseCaseFolder,
} from './model.js';
import { splitExcelText, substationOrientationXlsxRows, weeklyPerformanceLogXlsxRows } from './extended-form-rows.js';
import { formatDateDMY, formatDateTimeMDY, getPhaseWeekNumber, getSundaySaturdayWeek } from './training-calendar.js';
import { weeklyWorkbookForm } from './weekly-workbook-form.js';
import { CLEARANCE_CODES, RADIO_CODES, formatRadioCode } from './radio-codes.js';
import { activityTotals } from './run-activity.js';
import { validateClassWorkbookInputs } from './export-validation.js';
import { resolveOperationalPacket } from './operational-state-machine.js';
import { spreadsheetText } from './spreadsheet-text.js';
import { categoryIsNotApplicable, effectiveCategoryRating, weeklyRatingCount } from './weekly-rating-counts.js';
import { collectDeficiencies, collectSelectedFailureActions } from './seg-deficiencies.js';
import { buildClearanceDocuments } from './run-activity.js';
import { fullRunNarrative } from './run-ua-box.js';

const safeText = (value: unknown): string | number => {
  if (typeof value === 'number') return value;
  return spreadsheetText(value);
};

const sheet = (rows: (string | number)[][]) => XLSX.utils.aoa_to_sheet(rows);
const ratingCounts = (reports: Report[]) =>
  Object.fromEntries(RATINGS.map(rating => [
    rating,
    reports.filter(report=>!!report.ratingsReviewedAt&&!report.limboDay).reduce((total, report) => total + CATEGORIES.filter(category => effectiveCategoryRating(report,category) === rating).length, 0),
  ])) as Record<Exclude<Rating, ''>, number>;
const assignmentValue = (report: Report) => phaseAssignmentLabel(report.ftoAssignment, report.shift, report.cruiserDistrict);

function autosize(workbook: XLSX.WorkBook) {
  const gridBorder = {
    top: { style: 'thin', color: { rgb: 'FF555555' } },
    bottom: { style: 'thin', color: { rgb: 'FF555555' } },
    left: { style: 'thin', color: { rgb: 'FF555555' } },
    right: { style: 'thin', color: { rgb: 'FF555555' } },
  };
  const headerStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFE8EDF2' } },
    font: { bold: true, color: { rgb: 'FF172B45' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: gridBorder,
  };
  for (const name of workbook.SheetNames) {
    const current = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(current['!ref'] ?? 'A1');
    // These forms already own their partitioned grid styles, widths, and headings.
    if (name.startsWith('Weekly Summary ')) continue;
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let column = range.s.c; column <= range.e.c; column++) {
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        const cell = current[address];
        if (!cell) continue;
        const value = cell.v;
        const isNumeric = typeof value === 'number' && Number.isFinite(value);
        cell.s = {
          border: gridBorder,
          alignment: {
            horizontal: isNumeric ? 'center' : 'left',
            vertical: 'center',
            wrapText: true,
          },
          ...(isNumeric ? { numFmt: '0' } : {}),
          ...(row === 0 ? headerStyle : {}),
        };
      }
    }
    if (name === 'Class Summary') {
      const title = current.A1;
      if (title) title.s = {
        ...headerStyle,
        fill: { patternType: 'solid', fgColor: { rgb: 'FFDCE5EF' } },
        font: { bold: true, sz: 14, color: { rgb: 'FF142D4F' } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      };
    }
    if (name === 'Weekly Totals' || name === 'Phase Totals') {
      const ratingColumns = RATINGS.map(rating => {
        const header = Array.from({ length: range.e.c + 1 }, (_, column) =>
          current[XLSX.utils.encode_cell({ r: 0, c: column })]?.v === rating ? column : -1,
        ).find(column => column >= 0);
        return header ?? -1;
      });
      for (let row = 1; row <= range.e.r; row++) {
        ratingColumns.forEach((column, index) => {
          if (column < 0) return;
          const cell = current[XLSX.utils.encode_cell({ r: row, c: column })];
          if (!cell) return;
          const rating = RATINGS[index];
          const ratingFill: Record<Rating, string> = {
            NO: 'FFE5E7EB',
            A: 'FFDCFCE7',
            RT: 'FFFEF3C7',
            UA: 'FFFEE2E2',
            NRT: 'FFFEE2E2',
            '': 'FFFFFFFF',
          };
          cell.s = {
            ...cell.s,
            fill: { patternType: 'solid', fgColor: { rgb: ratingFill[rating] } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: gridBorder,
          };
        });
      }
    }
    if (name === 'SEG Ratings') {
      for (let row = 1; row <= range.e.r; row++) {
        const ratingCell = current[XLSX.utils.encode_cell({ r: row, c: 7 })];
        if (!ratingCell || typeof ratingCell.v !== 'string') continue;
        const ratingStyleByCode: Partial<Record<Rating, { fill: { patternType: 'solid'; fgColor: { rgb: string } }; font: { bold: boolean; color: { rgb: string } } }>> = {
          NO: { fill: { patternType: 'solid', fgColor: { rgb: 'FFE5E7EB' } }, font: { bold: true, color: { rgb: 'FF374151' } } },
          A: { fill: { patternType: 'solid', fgColor: { rgb: 'FFDCFCE7' } }, font: { bold: true, color: { rgb: 'FF166534' } } },
          RT: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFEF3C7' } }, font: { bold: true, color: { rgb: 'FF92400E' } } },
          UA: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFEE2E2' } }, font: { bold: true, color: { rgb: 'FF991B1B' } } },
          NRT: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFEE2E2' } }, font: { bold: true, color: { rgb: 'FF991B1B' } } },
        };
        const ratingStyle = ratingStyleByCode[ratingCell.v as Rating];
        if (ratingStyle) ratingCell.s = { ...ratingCell.s, ...ratingStyle, alignment: { horizontal: 'center', vertical: 'center' }, border: gridBorder };
      }
    }
    if(name==='Run Checklist'||name==='Checklist Exceptions') {
      const failureColumn=Array.from({length:range.e.c+1},(_,column)=>
        current[XLSX.utils.encode_cell({r:0,c:column})]?.v==='Specific failure actions'?column:-1,
      ).find(column=>column>=0)??-1;
      if(failureColumn>=0)for(let row=1;row<=range.e.r;row++){
        const address=XLSX.utils.encode_cell({r:row,c:failureColumn});
        const cell=current[address];
        if(!cell||typeof cell.v!=='string'||!cell.v.trim())continue;
        cell.s={...cell.s,font:{...(cell.s?.font??{}),bold:true,color:{rgb:'FF9B1C1C'}}};
      }
    }
    current['!cols'] = Array.from({ length: range.e.c + 1 }, (_, column) => {
      let max = 10;
      for (let row = range.s.r; row <= range.e.r; row++) {
        const value = current[XLSX.utils.encode_cell({ r: row, c: column })]?.v;
        max = Math.max(max, String(value ?? '').length);
      }
      return { wch: Math.min(max + 2, 48) };
    });
    current['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
    current['!autofilter'] = { ref: current['!ref'] ?? 'A1' };
  }
}

export function buildClassWorkbook(reports: Report[], acknowledgements:WeeklyPacketAcknowledgement[] = [], weeklyLogs:WeeklyPerformanceLog[] = [], orientations:SubstationOrientationRecord[] = [], folders:readonly PhaseCaseFolder[] = []) {
  const validated = validateClassWorkbookInputs({ reports, acknowledgements, weeklyLogs, orientations });
  reports = validated.reports;
  acknowledgements = validated.acknowledgements;
  weeklyLogs = validated.weeklyLogs;
  orientations = validated.orientations;
  if (!reports.length) throw new Error('There are no saved daily logs to export.');

  const sorted = [...reports].sort((a, b) =>
    a.recruitName.localeCompare(b.recruitName) || a.date.localeCompare(b.date),
  );
  const className = [...new Set(sorted.map(report => report.className?.trim() || 'Unassigned class'))].join('; ');
  const groupKey = (report: Report) => `${report.className ?? ''}:${report.recruitBadge}:${report.recruitName}`;
  const recruits = [...new Map(sorted.map(report => [
    groupKey(report),
    { badge: report.recruitBadge, name: report.recruitName, className: report.className ?? '', key:groupKey(report) },
  ])).values()];
  const counts = ratingCounts(sorted);
  const uaCount = counts.UA;
  const nrtCount = counts.NRT;
  const generatedAt = new Date();
  const wb = XLSX.utils.book_new();

  const summary = [
    ['Field Training Officer Portal · Class Aggregate', 'DEVICE-LOCAL WORKSPACE · NOT SERVER-CONFIRMED'],
    ['Training class', safeText(className)],
    ['Generated', formatDateDMY(generatedAt.toISOString().slice(0, 10))],
    ['Daily logs included', sorted.length],
    ['Probationary Officers represented', recruits.length],
    ['UA selections', uaCount],
    ['NRT selections', nrtCount],
    ['UA or NRT selections', uaCount + nrtCount],
    ['Performance scores / averages', 'Not calculated — manual ratings are descriptive'],
    ['Patrol View', 'Not connected; this workbook contains only records already saved on this device'],
  ];
  const perPo = new Map<string, Report[]>();
  for (const report of sorted) {
    const key = groupKey(report);
    perPo.set(key, [...(perPo.get(key) ?? []), report]);
  }
  const poRows: (string | number)[][] = [
    ['Probationary Officer', 'Badge', 'Class', 'Daily Logs', ...RATINGS, 'UA or NRT', 'Activity Count', 'Needs Follow-up'],
  ];
  for (const po of recruits) {
    const poReports = perPo.get(po.key) ?? [];
    const counts = ratingCounts(poReports);
    const uaOrNrt = counts.UA + counts.NRT;
    const activities = poReports.reduce((sum, report) =>
      sum + Object.values(activityTotals(report)).reduce((rowSum, count) => rowSum + (Number(count) || 0), 0), 0);
    poRows.push([
      safeText(po.name), safeText(po.badge), safeText(po.className), poReports.length,
      ...RATINGS.map(rating => counts[rating]),
      uaOrNrt, activities, uaOrNrt ? 'Review UA / NRT documentation' : 'No UA / NRT selections recorded',
    ]);
  }

  const dailyRows: (string | number)[][] = [[
    'Probationary Officer', 'Badge', 'Date', 'Week start', 'Week end', 'Phase', 'Shift',
    'Zone', 'Precinct', 'FTO Assignment', 'Status', 'Source log ID', 'Class', 'Rating review timestamp', 'Phase week', 'FTO week',
  ]];
  const ratingRows: (string | number)[][] = [[
    'Probationary Officer', 'Badge', 'Date', 'Phase', 'Shift', 'FTO Assignment', 'Category', 'Rating', 'Rating definition', 'FTO documentation', 'Review state',
  ]];
  const followUpRows: (string | number)[][] = [[
    'Probationary Officer', 'Badge', 'Date', 'Phase', 'Shift', 'FTO Assignment', 'Category', 'Rating', 'Justification present',
    'Prior documentation reviewed', 'Training reviewed', 'FTO Coordinator notified', 'FTO Sergeant notified',
  ]];
  const activityRows: (string | number)[][] = [[
    'Probationary Officer', 'Badge', 'Date', 'Week start', 'Shift', 'FTO Assignment', 'Activity', 'Count',
  ]];
  const runRows: (string | number)[][] = [[
    'Probationary Officer', 'Badge', 'Date', 'Shift', 'FTO Assignment', 'Run time', 'Primary form', 'Additional forms', 'Form status',
    'Dispatched', 'Arrest made', 'Transported after arrest', 'Transport destination type', 'Transport destination', 'OVI processed', 'Traffic violator', 'Run narrative', 'Narrative part',
    'Incident number', 'Unit / cruiser', 'Street address', 'City', 'State', 'ZIP code', 'Incident zone', 'Incident cruiser district', 'Dispatched at', 'Run ended',
    'Run type 10-code', 'Run type description — public reference', 'Situation found 10-code', 'Situation description — public reference',
    'Clearance code', 'Clearance description — public reference', 'Solve Citation/Summons*', 'Related activity/forms', 'Source log ID', 'Run ID', 'Class',
  ]];
  const narrativeRows: (string | number)[][] = [[
    'Probationary Officer', 'Badge', 'Date', 'Phase', 'Shift', 'FTO Assignment', 'Daily narrative', 'Narrative part',
    'Remedial training', 'Remedial part', 'PO comments', 'PO comments part',
  ]];
  const runChecklistRows: (string | number)[][] = [[
    'Probationary Officer', 'Badge', 'Date', 'Shift', 'FTO Assignment', 'Run time', 'Primary form', 'Checklist segment', 'Checklist item', 'Specific failure actions', 'Completed', 'Not applicable to category', 'Form status', 'Checklist reviewed at', 'Source log ID', 'Run ID',
  ]];
  const weeklyRunChecklistRows: (string|number)[][]=[['Class','Probationary Officer','Badge','Phase','FTO Assignment','Week start','Form','Checklist segment','Checklist item','Reviewed forms','Checked count','Not applicable forms','Source daily logs','Source run IDs']];
  const weeklyRunChecklist = new Map<string,{className:string;po:string;badge:string;phase:number;assignment:string;week:string;form:string;segment:string;item:string;formCount:number;checked:number;notApplicable:number;logs:Set<string>;runs:Set<string>}>();
  const dutyRows: (string | number)[][] = [[
    'Probationary Officer', 'Badge', 'Date', 'Shift', 'FTO Assignment', 'Duty status', 'Checklist section', 'Checklist item', 'Completed', 'Not applicable', 'Duty review confirmed', 'Notes',
  ]];
  const weeklyGroups = new Map<string, Report[]>();
  const phaseGroups = new Map<string, Report[]>();

  for (const report of sorted) {
    const week = getSundaySaturdayWeek(report.date);
    const weekStart = week ? formatDateDMY(week.start) : '';
    const weekEnd = week ? formatDateDMY(week.end) : '';
    dailyRows.push([
      safeText(report.recruitName), safeText(report.recruitBadge), formatDateDMY(report.date),
      weekStart, weekEnd, `Phase ${report.phase}`, safeText(report.shift),
       safeText(report.zone), safeText(report.precinct), safeText(assignmentValue(report)), safeText(report.status),
      safeText(report.id), safeText(report.className), safeText(report.limboDay?'Limbo day — not rated':report.ratingsReviewedAt ?? 'Not reviewed'), report.phaseWeek ?? 'Not confirmed', report.ftoWeek ?? 'Not confirmed',
    ]);

    if (week) {
      const key = `${groupKey(report)}:${report.phase}:${week.start}:${report.phaseWeek ?? ''}:${report.ftoWeek ?? ''}:${report.ftoBadge}`;
      weeklyGroups.set(key, [...(weeklyGroups.get(key) ?? []), report]);
    }
    const phaseKey=`${groupKey(report)}:${report.phase}`;
    phaseGroups.set(phaseKey,[...(phaseGroups.get(phaseKey) ?? []),report]);

    for (const key of report.limboDay ? [] : CATEGORIES) {
      const entry=report.ratings[key];
      const rating = categoryIsNotApplicable(report,key) ? 'N/A' : entry?.rating as Rating | undefined;
      if (!rating) continue;
      const label = CATEGORY_LABEL[key as keyof typeof CATEGORY_LABEL] ?? key;
      const definition = rating==='N/A'?'Not applicable':RATING_LEGEND.find(item => item.code === rating)?.label ?? '';
      ratingRows.push([
        safeText(report.recruitName), safeText(report.recruitBadge), formatDateDMY(report.date),
         `Phase ${report.phase}`, safeText(report.shift), safeText(assignmentValue(report)), safeText(label), rating, definition,
        safeText(entry.justification ?? ''), report.ratingsReviewedAt ? 'Reviewed daily summary' : 'Unreviewed default or draft',
      ]);
      if (report.ratingsReviewedAt && (rating === 'UA' || rating === 'NRT')) {
        followUpRows.push([
          safeText(report.recruitName), safeText(report.recruitBadge), formatDateDMY(report.date),
          `Phase ${report.phase}`, safeText(report.shift), safeText(assignmentValue(report)),
          safeText(label), rating, entry.justification?.trim() ? 'Yes' : 'No',
          entry.nrtPriorDocumentationReviewed ? 'Yes' : 'No',
          entry.nrtTrainingReviewed ? 'Yes' : 'No',
          entry.nrtCoordinatorsNotified ? 'Yes' : 'No',
          entry.nrtFtoSergeantNotified ? 'Yes' : 'No',
        ]);
      }
    }

    const dailyActivity=activityTotals(report);
    for (const { key, label } of DAILY_ACTIVITY_FIELDS) {
      activityRows.push([
        safeText(report.recruitName), safeText(report.recruitBadge), formatDateDMY(report.date),
         weekStart, safeText(report.shift), safeText(assignmentValue(report)), safeText(label), Number(dailyActivity[key] ?? 0),
      ]);
    }
    const dailyNarrativeParts = splitExcelText(report.narrative);
    const remedialParts = splitExcelText(report.remedial);
    const recruitCommentParts = splitExcelText(report.recruitComments);
    const narrativePartCount = Math.max(dailyNarrativeParts.length, remedialParts.length, recruitCommentParts.length);
    for (let part = 0; part < narrativePartCount; part++) {
      narrativeRows.push([
        safeText(report.recruitName), safeText(report.recruitBadge), formatDateDMY(report.date),
        `Phase ${report.phase}`, safeText(report.shift), safeText(assignmentValue(report)),
        safeText(dailyNarrativeParts[part] ?? ''), `${part + 1} of ${dailyNarrativeParts.length}`,
        safeText(remedialParts[part] ?? ''), `${part + 1} of ${remedialParts.length}`,
        safeText(recruitCommentParts[part] ?? ''), `${part + 1} of ${recruitCommentParts.length}`,
      ]);
    }
    for (const group of DAILY_DUTY_CHECKLIST) {
      for (const item of group.items) {
        dutyRows.push([
          safeText(report.recruitName), safeText(report.recruitBadge), formatDateDMY(report.date),
           safeText(report.shift), safeText(assignmentValue(report)), safeText(report.reportingForDuty?.dutyStatus ?? 'on_duty'), safeText(group.section),
          safeText(item.label), report.reportingForDuty?.checklist?.[item.key] ? 'Yes' : 'No',
          report.reportingForDuty?.notApplicable?.[group.section]?'Yes':'No',
          report.reportingForDuty?.reviewedAt?'Yes':'No',
          safeText(report.reportingForDuty?.notes ?? ''),
        ]);
      }
    }

    for (const run of report.runs ?? []) {
      const primary = PRIMARY_RUN_FORMS.find(form => form.key === run.runKind);
      const supplements = requiredSupplementalForms(run).flatMap(key => {
        const form = SUPPLEMENTAL_RUN_FORMS.find(item => item.key === key);
        return form ? [form] : [];
      });
      const runNarrativeParts = splitExcelText(fullRunNarrative(run, { limboDay: report.limboDay }));
      runNarrativeParts.forEach((narrativePart, partIndex) => runRows.push([
         safeText(report.recruitName), safeText(report.recruitBadge), formatDateDMY(report.date),
         safeText(report.shift), safeText(assignmentValue(report)), safeText(formatDateTimeMDY(run.occurredAt)), safeText(primary?.label ?? 'Unassigned primary form'),
        supplements.map(({ label, formNumber }) => formNumber ? `${label} (${formNumber})` : label).join('; '),
        safeText(run.formStatus), run.isDispatched ? 'Yes' : 'No', run.arrestMade ? 'Yes' : 'No',
          run.transportedAfterArrest ? 'Yes' : 'No', safeText(run.transportDestinationType ?? ''), safeText(run.transportDestination ?? ''), run.oviProcessed ? 'Yes' : 'No', safeText(run.trafficMode),
         safeText(narrativePart), `${partIndex + 1} of ${runNarrativeParts.length}`,
        safeText(run.incidentNumber??''),safeText(run.unitNumber??''),safeText(run.location??''),safeText(run.locationCity??''),
        safeText(run.locationState??''),safeText(run.locationZip??''),safeText(run.incidentZone??''),safeText(run.incidentCruiserDistrict??''),
        safeText(run.dispatchedAt?formatDateTimeMDY(run.dispatchedAt):''),safeText(run.endedAt?formatDateTimeMDY(run.endedAt):''),
        run.dispatchedCode ? `10-${safeText(run.dispatchedCode)}` : '', safeText(RADIO_CODES[run.dispatchedCode ?? ''] ?? ''),
        safeText(formatRadioCode(run.situationFoundCode,'')), safeText(RADIO_CODES[run.situationFoundCode ?? ''] ?? ''),
        safeText(run.clearanceCode), safeText(CLEARANCE_CODES.find(item=>item.code===run.clearanceCode)?.label),
         run.activityFlags?.solveCitationSummons ? 'Yes' : '',
        DAILY_ACTIVITY_FIELDS.filter(item=>run.activityFlags?.[item.key]).map(item=>item.label).join('; '),
        safeText(report.id), safeText(run.id), safeText(report.className),
       ]));
      const reviewedComplete=run.formStatus==='complete' && !!run.checklistReviewedAt;
      let primaryIndex=0;
      const primaryChecklist=RUN_CHECKLIST_SECTIONS[run.runKind].flatMap(section=>section.items.map(item=>({
        label:item.label,segment:section.title,key:`task-${primaryIndex++}`,notApplicableKey:'na-task',form:primary?.label ?? 'Primary form',
      })));
      const supplementalChecklist=requiredSupplementalForms(run).flatMap(formKey=>{
        const form=SUPPLEMENTAL_RUN_FORMS.find(item=>item.key===formKey);
        let supplementIndex=0;
        return RUN_SUPPLEMENT_CHECKLIST_SECTIONS[formKey].flatMap(section=>section.items.map(item=>({
          label:item.label,segment:section.title,key:`supp-${formKey}-${supplementIndex++}`,notApplicableKey:`na-supp-${formKey}`,form:form?.label ?? formKey,
        })));
      });
      const checklistRows=[...primaryChecklist,...supplementalChecklist];
      for (const item of checklistRows) {
        runChecklistRows.push([
           safeText(report.recruitName),safeText(report.recruitBadge),formatDateDMY(report.date),
            safeText(report.shift),safeText(assignmentValue(report)),safeText(formatDateTimeMDY(run.occurredAt)),safeText(item.form),safeText(item.segment),safeText(item.label),safeText(run.checklistFailures?.[item.key]?.join('\n')??''),
          run.checklist[item.key]===true?'Yes':'No',run.checklist[item.notApplicableKey]===true?'Yes':'No',safeText(run.formStatus),safeText(run.checklistReviewedAt ?? 'Not reviewed'),safeText(report.id),safeText(run.id),
        ]);
        if (!reviewedComplete || !week) continue;
        const assignment=assignmentValue(report);
        const key=[report.className ?? '',report.recruitBadge,report.recruitName,report.phase,assignment,week.start,item.form,item.segment,item.label].join('|');
        const entry=weeklyRunChecklist.get(key) ?? {className:report.className ?? '',po:report.recruitName,badge:report.recruitBadge,phase:report.phase,assignment,week:formatDateDMY(week.start),form:item.form,segment:item.segment,item:item.label,formCount:0,checked:0,notApplicable:0,logs:new Set<string>(),runs:new Set<string>()};
        if (!entry.runs.has(run.id)) { entry.formCount++; if(run.checklist[item.notApplicableKey]===true)entry.notApplicable++; }
        if (run.checklist[item.key]===true) entry.checked++;
        entry.logs.add(report.id);entry.runs.add(run.id);weeklyRunChecklist.set(key,entry);
      }
      }
    }
  for (const entry of weeklyRunChecklist.values()) weeklyRunChecklistRows.push([
    safeText(entry.className),safeText(entry.po),safeText(entry.badge),entry.phase,safeText(entry.assignment),entry.week,safeText(entry.form),safeText(entry.segment),safeText(entry.item),
    entry.formCount,entry.checked,entry.notApplicable,[...entry.logs].join('; '),[...entry.runs].join('; '),
  ]);

  const weeklyRows: (string | number)[][] = [[
     'Probationary Officer', 'Badge', 'Week start', 'Week end', 'FTO Assignment', 'Daily logs', ...RATINGS, 'UA or NRT',
    ...DAILY_ACTIVITY_FIELDS.map(field => field.label), 'Class', 'Phase', 'Source daily log IDs',
  ]];
  for (const [key, weekReports] of weeklyGroups) {
    const first = weekReports[0];
    const week = getSundaySaturdayWeek(first.date);
    if (!week) continue;
      const counts = Object.fromEntries(RATINGS.map(rating=>[rating,CATEGORIES.reduce((sum,category)=>sum+weeklyRatingCount(weekReports,category,rating),0)])) as Record<typeof RATINGS[number],number>;
    const totals = DAILY_ACTIVITY_FIELDS.map(({ key: activityKey }) =>
        weekReports.reduce((sum, report) => sum + Number(activityTotals(report)[activityKey] ?? 0), 0));
    weeklyRows.push([
       safeText(first.recruitName), safeText(first.recruitBadge), formatDateDMY(week.start), formatDateDMY(week.end),
       safeText(assignmentValue(first)), weekReports.length, ...RATINGS.map(rating => counts[rating]), counts.UA + counts.NRT, ...totals,
      safeText(first.className), first.phase, weekReports.map(report=>report.id).join('; '),
    ]);
    void key;
  }
  const phaseRows: (string|number)[][]=[['Class','PO','Badge','Phase','FTO Assignment','Daily logs',...RATINGS,...DAILY_ACTIVITY_FIELDS.map(field=>field.label),'Source daily log IDs']];
  for (const reports of phaseGroups.values()) {
    const first=reports[0], counts=ratingCounts(reports);
    phaseRows.push([safeText(first.className),safeText(first.recruitName),safeText(first.recruitBadge),first.phase,safeText(assignmentValue(first)),reports.length,
       ...RATINGS.map(rating=>counts[rating]),...DAILY_ACTIVITY_FIELDS.map(field=>reports.reduce((sum,report)=>sum+(activityTotals(report)[field.key] ?? 0),0)),reports.map(report=>report.id).join('; ')]);
  }

  const legendRows: (string | number)[][] = [
    ['Rating', 'Definition'],
    ...RATING_LEGEND.map(item => [item.code, item.label]),
    ['Interpretation', 'Counts only. Ratings are descriptive and are not scores or averages.'],
    ['Form scope', 'Daily Performance Summary (U-10.174): once per training day. Run forms: complete the applicable primary checklist and any required supplements.'],
    ['Data boundary', 'This export contains local workspace records only. It is not a verified Patrol View import or server-synced class roster.'],
    ['Default ratings', 'Most categories default to Acceptable. EVO, Initiating Arrests, Handling Prisoners, Vehicle Stops, Building Search, Pat Down/Searches, High Stress Situations, and Arrest Situations default to Not Observed. Unreviewed defaults are not a verified FTO assessment.'],
    ['10-code descriptions', 'Code descriptions are included for convenient lookup.'],
    ['Traffic Citations', 'Manually enter the daily statistic. Run selections are supporting records and do not change totals.'],
    ['Solve Citation/Summons*', 'Manually enter the daily statistic. For a 10-6 Traffic Stop with 1V/3V, the run record may show this supporting activity when applicable; do not select PremierOne or Axon.'],
    ['Summons Re-issued', 'Duplicated in the photo; collected and counted once to prevent double-counting.'],
  ];
  const includedPeople=new Set(sorted.map(report=>`${report.recruitBadge}:${report.recruitName}`));
  const acknowledgementRows:(string|number)[][]=[[
    'Probationary Officer','PO badge','FTO','FTO badge','Week number','Week start','Week end','Phase',
    'PO assignment','FTO assignment','Status','PO comments','FTO comments','FTO Office comments',
    'PO signature state','FTO signature state','FTO Office signature state','Source acknowledgement ID',
  ]];
  const signatureSummary=(signature:WeeklyPacketAcknowledgement['signatures']['recruit'])=>signature?`${safeText(signature.name)} · ${safeText(signature.badge)} · ${formatDateDMY(signature.at.slice(0,10))} · local entry, identity not verified`:'Not signed';
  for(const acknowledgement of acknowledgements.filter(item=>includedPeople.has(`${item.recruitBadge}:${item.recruitName}`))){
    const sourceReport=sorted.find(report=>report.recruitBadge===acknowledgement.recruitBadge
      &&report.phase===acknowledgement.phase&&report.date>=acknowledgement.weekStart&&report.date<=acknowledgement.weekEnd);
    const oldAssignment=acknowledgement.ftoAssignment||acknowledgement.recruitAssignment;
    const parsedAssignment=/FTO Assignment\s+([A-Z0-9]+)/i.exec(oldAssignment)?.[1]
      ??/^([A-Z0-9]+)(?= ·|$)/.exec(oldAssignment)?.[1];
    const parsedShift=/\b(A-Co|B-Co|C-Co|DMW|EMW)\b/.exec(oldAssignment)?.[1];
    const ackAssignment=sourceReport?assignmentValue(sourceReport):parsedAssignment&&parsedShift?`${parsedAssignment} · ${parsedShift}`:'Not recorded';
    acknowledgementRows.push([
      safeText(acknowledgement.recruitName),safeText(acknowledgement.recruitBadge),safeText(acknowledgement.ftoName),safeText(acknowledgement.ftoBadge),
      acknowledgement.weekNumber,formatDateDMY(acknowledgement.weekStart),formatDateDMY(acknowledgement.weekEnd),`Phase ${acknowledgement.phase}`,
      safeText(ackAssignment),safeText(ackAssignment),safeText(acknowledgement.status),
      safeText(acknowledgement.recruitComments),safeText(acknowledgement.ftoComments),safeText(acknowledgement.officeComments),
      signatureSummary(acknowledgement.signatures.recruit),signatureSummary(acknowledgement.signatures.fto),signatureSummary(acknowledgement.signatures.ftoOffice),safeText(acknowledgement.id),
    ]);
  }
  const formIndexRows:(string|number)[][]=[
    ['Manual form / record','Reference','Excel worksheet(s)','PDF export'],
    ['Reporting for Duty Form','Form number not verified in the attached manual','Reporting for Duty','Daily print packet'],
    ['Daily Performance Summary','U-10.174','Daily Summary Index; SEG Ratings; Daily Activity; Daily Narratives; UA NRT Follow-up','Daily Performance Summary + duty and run forms'],
    ['Weekly Performance Summary','U-10.173','Weekly Totals; Weekly Form tabs','Weekly Performance Summary print view'],
    ['Selected missed actions','Saved specific run-checklist action selections','Selected Missed Actions','Workbook export only; one row per selected action occurrence'],
    ['Weekly Performance Log Supplement','U-10.174S','Weekly Log Supplement','Weekly Performance Log Supplement print view'],
    ['Weekly Packet Acknowledgement','Separate acknowledgement workflow','Weekly Acknowledgements','Acknowledgement print view'],
    ...PRIMARY_RUN_FORMS.map(form=>[form.label,form.formNumber,'Run Forms; Run Checklist','Daily print packet']),
    ...SUPPLEMENTAL_RUN_FORMS.map(form=>[form.label,form.formNumber||'Supplemental form','Run Forms; Run Checklist','Daily print packet']),
    ['Scope','Device-local records','Values are exported from saved workspace records; no server or Patrol View data is included.','Browser print-to-PDF; review the page setup and margins.'],
  ];
  const selectedMissedActionRows:(string|number)[][]=[
    ['Training week','Week start','Week end','Class','Probationary Officer','PO badge','Phase','Shift date','Source form','Form number','Source checklist task','Selected missed action','Form page reference','Daily log ID','Run ID','Run status','Checklist review','Count basis','Saved selection occurrences'],
    ...sorted.flatMap(report=>{
      const packet=resolveOperationalPacket(report,folders,orientations);
      const week=getSundaySaturdayWeek(report.date);
      const phaseFolder=folders.find(folder=>folder.phase===report.phase&&folder.recruitBadge===report.recruitBadge
        &&(folder.className??'')===(report.className??''));
      const phaseWeek=report.phaseWeek??(phaseFolder
        ?getPhaseWeekNumber(report.date,phaseFolder.phaseStartDate,phaseFolder.phaseWeekRanges)
        :undefined);
      const programWeek=phaseWeek?PHASE_PROGRAM_WEEK_START[report.phase]+phaseWeek-1:undefined;
      const weekLabel=programWeek?`Week ${programWeek}`:`Week of ${formatDateDMY(week?.start??report.date)}`;
      return collectSelectedFailureActions(report,packet).map(item=>[
        weekLabel,week?.start??'',week?.end??'',safeText(report.className??''),safeText(report.recruitName),
        safeText(report.recruitBadge),`Phase ${report.phase}`,formatDateDMY(report.date),safeText(item.formLabel),
        safeText(item.formNumber),safeText(item.taskLabel),safeText(item.action),safeText(item.reference??''),
        safeText(report.id),safeText(item.runId),item.runComplete?'Complete':'Incomplete',
        item.checklistReviewed?'Reviewed':'Not reviewed','One saved action selection; not a SEG rating',1,
      ]);
    }),
  ];

  const sheets: [string, (string | number)[][]][] = [
    ['Form Index', formIndexRows],
    ['Class Summary', [...summary, [], ...poRows]],
    ['Daily Summary Index', dailyRows],
    ['SEG Ratings', ratingRows],
    ['Weekly Totals', weeklyRows],
    ['Weekly Run Checklist', weeklyRunChecklistRows],
    ['Phase Totals', phaseRows],
    ['Daily Activity', activityRows],
    ['Reporting for Duty', dutyRows],
    ['Run Forms', runRows],
    ['Run Checklist', runChecklistRows],
    ['Weekly Acknowledgements',acknowledgementRows],
    ['Weekly Log Supplement',weeklyPerformanceLogXlsxRows(weeklyLogs)],
    ['Substation Orientation',substationOrientationXlsxRows(orientations)],
    ['Daily Narratives', narrativeRows],
    ['UA NRT Follow-up', followUpRows],
    ['Legend and Scope', legendRows],
    ['Daily Page Index', [
      ['Daily log ID', 'Shift date', 'Page', 'Training-folder reference', 'Form', 'Run ID', 'Packet review'],
      ...reports.flatMap(report => {
        const packet = resolveOperationalPacket(report, folders, orientations);
        return packet.pages.map(page => [
          report.id, report.date, page.page, page.reference ?? 'Unavailable: phase schedule required', page.title, page.runId ?? '',
          packet.blockingIssues.join(' ') || 'Review source records before use',
        ]);
      }),
    ]],
    ['Checklist Exceptions', [
      ['Daily log ID', 'Shift date', 'Training-folder reference', 'Page', 'Run ID', 'Section', 'Task', 'Specific failure actions', 'Checklist reviewed', 'Attribution status', 'FTO articulation'],
      ...reports.flatMap(report => {
        const packet=resolveOperationalPacket(report,folders,orientations);
        const groups=collectDeficiencies(report,packet);
        return packet.exceptions.map(item => {
          const group=groups.find(group=>group.tasks.some(task=>task.id===item.id));
          return [
        report.id, report.date, item.reference ?? 'Unavailable: phase schedule required', item.page, item.runId ?? '',
        item.section, item.task, item.failureActions?.join('\n')??'', item.reviewed ? 'Yes' : 'No',
        group?`UA source: ${CATEGORY_LABEL[group.category]}`:'SEG mapping and FTO rating decision required',
        group?.narrative??'',
      ];});
      }),
    ]],
    ['Selected Missed Actions',selectedMissedActionRows],
    ['Generated Document Payloads', [
      ['Daily log ID','Run ID','Draft payload ID','Form','Charge ID','Charge description','Scope'],
      ...reports.flatMap(report=>report.runs.flatMap(run=>buildClearanceDocuments(run).map(document=>[
        report.id,run.id,document.id,document.kind,document.chargeId??'',document.description??'',
        'Local draft payload only; not a completed or filed legal form',
      ]))),
    ]],
  ];
  for (const [name, rows] of sheets) {
    XLSX.utils.book_append_sheet(wb, sheet(rows.map(row => row.map(safeText))), name);
  }
  for (const reports of weeklyGroups.values()) {
    const first=reports[0];
    const week=getSundaySaturdayWeek(first.date);
    const dateToken=week?.start.replace(/-/g,'')??'Unknown';
    const badgeToken=first.recruitBadge.replace(/[^A-Za-z0-9]/g,'').slice(-4)||'PO';
    const classToken=(first.className??'').replace(/[^A-Za-z0-9]/g,'').slice(0,2)||'CL';
    const base=`Weekly Summary ${dateToken} ${badgeToken} ${classToken}`;
    let sheetName=base.slice(0,31);
    let suffix=2;
    while(wb.SheetNames.includes(sheetName)) {
      sheetName=`${base.slice(0,27)} ${suffix++}`.slice(0,31);
    }
    XLSX.utils.book_append_sheet(wb,weeklyWorkbookForm(reports,reports.filter(report=>!!report.ratingsReviewedAt&&!report.limboDay)),sheetName);
  }
  autosize(wb);
  return wb;
}

export function exportClassWorkbook(reports: Report[], acknowledgements:WeeklyPacketAcknowledgement[] = [], weeklyLogs:WeeklyPerformanceLog[] = [], orientations:SubstationOrientationRecord[] = [], folders:readonly PhaseCaseFolder[] = []) {
  const wb=buildClassWorkbook(reports,acknowledgements,weeklyLogs,orientations,folders);
  const generatedAt=new Date();
  const filename = `Field_Training_Officer_Portal_Class_Aggregate_${generatedAt.toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
