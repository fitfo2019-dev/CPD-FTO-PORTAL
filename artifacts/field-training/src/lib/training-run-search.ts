/** Filter saved runs by an incident-number substring without numeric coercion. */
export function searchTrainingRunsByIncidentNumber<T extends { incidentNumber?: string }>(
  runs: readonly T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...runs];
  return runs.filter(run => run.incidentNumber?.toLowerCase().includes(normalizedQuery));
}

export function searchSavedTrainingRunsByIncidentNumber<
  TReport extends { runs: readonly { incidentNumber?: string }[] },
>(
  reports: readonly TReport[],
  query: string,
): Array<{ report: TReport; run: TReport['runs'][number] }> {
  if (!query.trim()) return [];

  return reports.flatMap(report =>
    searchTrainingRunsByIncidentNumber(report.runs, query)
      .map(run => ({ report, run })),
  );
}
