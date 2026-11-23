import { emptyDailyActivitySummary, type ActivityKey, type DailyActivitySummary, type Report, type TrainingRun } from './model.js';

export function runActivityValidationError(run:Pick<TrainingRun,'runKind'|'dispatchedCode'|'clearanceCode'|'activityFlags'|'arrestMade'|'transportedAfterArrest'|'transportDestination'|'transportDestinationType'|'clearanceRulesVersion'>):string|undefined {
  if(run.clearanceCode==='3V'&&!run.arrestMade) return '3V means Arrest Made. Correct the clearance code or record the arrest that occurred.';
  if(run.clearanceRulesVersion===1&&run.clearanceCode==='3V'&&!run.transportedAfterArrest) return '3V requires a recorded transport. If no transport occurred, use 1V.';
  if(run.clearanceRulesVersion===1&&run.arrestMade&&run.transportedAfterArrest&&run.clearanceCode!=='3V') return 'A transported arrest must use 3V.';
  if(run.clearanceRulesVersion===1&&run.arrestMade&&!run.transportedAfterArrest&&run.clearanceCode!=='1V') return 'An arrest without transport must use 1V.';
  if(run.transportedAfterArrest&&!run.transportDestination?.trim()) return 'Record the actual destination before confirming transport after arrest.';
  if(run.clearanceRulesVersion===1&&run.transportedAfterArrest&&!run.transportDestinationType) return 'Select Jail, HQ, or Clerks as the transport destination type.';
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
    } else if (run.clearanceCode === '3V' && run.arrestMade && run.transportedAfterArrest) {
      counts.u10100Reports++;
      counts.prisonersSlated++;
      counts.premierOneReports++;
      counts.pcAffidavits++;
      counts.criminalComplaints += run.charges?.length ?? 0;
    }
    // 2V has no report/citation increment; 4V has no approved extra multiplier.
    if (run.clearanceCode && run.clearanceCode !== '4V' && run.runKind === 'traffic_stop') counts.trafficStops++;
  }
  return counts;
}

export function buildClearanceDocuments(run: TrainingRun): NonNullable<TrainingRun['generatedDocuments']> {
  if (run.clearanceRulesVersion !== 1 || run.clearanceCode !== '3V' || !run.arrestMade || !run.transportedAfterArrest) return [];
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

/** Convert the visible total back to its manual portion without duplicating run-derived counts. */
export function manualActivityEntryForTotal(displayedTotal:string|number,derivedTotal:number):number {
  const displayed=Math.max(0,Math.floor(Number(displayedTotal)||0));
  const derived=Math.max(0,Math.floor(Number(derivedTotal)||0));
  return Math.max(0,displayed-derived);
}

export function activityDiscrepancies(entered:DailyActivitySummary,supportingRunCounts:DailyActivitySummary):ActivityKey[] {
  return (Object.keys(entered) as ActivityKey[]).filter(key=>entered[key]!==supportingRunCounts[key]);
}
