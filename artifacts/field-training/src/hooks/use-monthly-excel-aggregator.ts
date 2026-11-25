import { useMemo } from 'react';
import type { PhaseWeekRange, Report } from '@/lib/model.js';
import { filterReportsForMonth, summarizeMonthlyReports } from '@/lib/monthly-summary.js';

export function useMonthlyExcelAggregator(reports: readonly Report[], monthKey: string, phaseWeekRanges?:readonly PhaseWeekRange[]) {
  const monthlyReports = useMemo(
    () => filterReportsForMonth(reports, monthKey),
    [reports, monthKey],
  );
  const summary = useMemo(
    () => summarizeMonthlyReports(monthlyReports),
    [monthlyReports],
  );
  const workbookWeekRanges=useMemo(
    ()=>phaseWeekRanges?.map(range=>({startDate:range.startDate,endDate:range.endDate})),
    [phaseWeekRanges],
  );

  return { reports: monthlyReports, summary, workbookWeekRanges };
}
