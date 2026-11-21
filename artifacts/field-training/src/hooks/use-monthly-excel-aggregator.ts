import { useMemo } from 'react';
import type { Report } from '@/lib/model.js';
import { filterReportsForMonth, summarizeMonthlyReports } from '@/lib/monthly-summary.js';

export function useMonthlyExcelAggregator(reports: readonly Report[], monthKey: string) {
  const monthlyReports = useMemo(
    () => filterReportsForMonth(reports, monthKey),
    [reports, monthKey],
  );
  const summary = useMemo(
    () => summarizeMonthlyReports(monthlyReports),
    [monthlyReports],
  );

  return { reports: monthlyReports, summary };
}
