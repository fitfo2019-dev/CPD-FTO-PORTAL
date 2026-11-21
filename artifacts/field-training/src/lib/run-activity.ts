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
      if(!selected)continue;
      if(key in counts) counts[key as keyof DailyActivitySummary]++;
    }
  }
  return counts;
}

/** Official activity totals come only from the manually entered daily statistics. */
export function activityTotals(report:Pick<Report,'activity'|'runs'|'activityCountsIncludeRuns'>):DailyActivitySummary {
  return Object.fromEntries(Object.entries(report.activity??{}).map(([key,value])=>[
    key,Math.max(0,Math.floor(Number(value)||0)),
  ])) as DailyActivitySummary;
}

export function activityDiscrepancies(entered:DailyActivitySummary,supportingRunCounts:DailyActivitySummary):ActivityKey[] {
  return (Object.keys(entered) as ActivityKey[]).filter(key=>entered[key]!==supportingRunCounts[key]);
}
