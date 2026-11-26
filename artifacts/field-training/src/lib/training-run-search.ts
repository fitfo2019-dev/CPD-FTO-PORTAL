/** Filter saved runs by an incident-number substring without numeric coercion. */
export function searchTrainingRunsByIncidentNumber<T extends { incidentNumber?: string }>(
  runs: readonly T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...runs];
  return runs.filter(run => run.incidentNumber?.toLowerCase().includes(normalizedQuery));
}
