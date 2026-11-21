import { emptyDailyActivitySummary, type ActivityKey, type DailyActivitySummary, type Report, type TrainingRun } from './model.js';

export function runActivityValidationError(run:Pick<TrainingRun,'runKind'|'dispatchedCode'|'clearanceCode'|'activityFlags'>):string|undefined {
  if(run.runKind==='traffic_stop'&&run.dispatchedCode==='6'&&['1V','3V'].includes(run.clearanceCode??'')&&run.activityFlags?.premierOneReports) {
    return 'A 10-6 Traffic Stop with 1V or 3V must not count as a PremierOne/Axon report. Clear PremierOne Reports; select Solve Citation/Summons* only when applicable.';
  }
  return undefined;
}

export function runDerivedActivityCounts(runs:TrainingRun[]):DailyActivitySummary {
  const counts=emptyDailyActivitySummary();
  for(const run of runs){
    if(run.formStatus!=='complete'||!run.checklistReviewedAt)continue;
    for(const [key,selected] of Object.entries(run.activityFlags??{})){
      if(selected!==true)continue;
      if(key in counts) counts[key as keyof DailyActivitySummary]++;
    }
  }
  return counts;
}

/** New, explicitly versioned run records use deterministic clearance multipliers. */
export function clearanceDerivedActivityCounts(runs: TrainingRun[]): DailyActivitySummary {
  const counts = emptyDailyActivitySummary();
  for (const run of runs) {
    if (run.clearanceRulesVersion !== 1 || run.formStatus !== 'complete' || !run.checklistReviewedAt) continue;
    if (run.clearanceCode === '1V') {
      if (run.activityFlags?.trafficCitations) counts.trafficCitations++;
      else if (run.runKind === 'traffic_stop' || run.activityFlags?.solveCitationSummons) counts.solveCitationSummons++;
      else counts.premierOneReports++;
    } else if (run.clearanceCode === '3V') {
      counts.u10100Reports++;
      counts.prisonersSlated++;
      counts.premierOneReports++;
      counts.pcAffidavits++;
      counts.criminalComplaints += run.charges?.length ?? 0;
    }
    // 2V has no report/citation increment; 4V has no approved extra multiplier.
    if (run.clearanceCode && run.runKind === 'traffic_stop') counts.trafficStops++;
  }
  return counts;
}

export function buildClearanceDocuments(run: TrainingRun): NonNullable<TrainingRun['generatedDocuments']> {
  if (run.clearanceRulesVersion !== 1 || run.clearanceCode !== '3V') return [];
  return [
    { id: `${run.id}:U-10.100`, kind: 'U-10.100' },
    { id: `${run.id}:Probable-Cause-Affidavit`, kind: 'Probable Cause Affidavit' },
    ...(run.charges ?? []).map(charge => ({
      id: `${run.id}:complaint:${charge.id}`, kind: 'Criminal Complaint Form' as const,
      chargeId: charge.id, description: charge.description,
    })),
  ];
}

/** Manual extras plus new versioned clearance counts; legacy saved totals are not reinterpreted. */
export function activityTotals(report:Pick<Report,'activity'|'runs'|'activityCountsIncludeRuns'>):DailyActivitySummary {
  const automatic = clearanceDerivedActivityCounts(report.runs ?? []);
  return Object.fromEntries(Object.entries(emptyDailyActivitySummary()).map(([key])=>[
    key,Math.max(0,Math.floor(Number(report.activity?.[key as ActivityKey])||0)) + automatic[key as ActivityKey],
  ])) as DailyActivitySummary;
}

export function activityDiscrepancies(entered:DailyActivitySummary,supportingRunCounts:DailyActivitySummary):ActivityKey[] {
  return (Object.keys(entered) as ActivityKey[]).filter(key=>entered[key]!==supportingRunCounts[key]);
}
