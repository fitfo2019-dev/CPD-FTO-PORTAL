import type { PhaseCaseFolder, SubstationOrientationRecord, Workspace } from './model.js';
import { getNextReportDate } from './training-calendar.js';

export function savedOrientationHref(
  role: Workspace['role'],
  orientation: SubstationOrientationRecord | undefined,
): string | undefined {
  if (!orientation || (role !== 'fto' && role !== 'fto_coordinator')) return undefined;
  return `/substation-orientation?orientation=${encodeURIComponent(orientation.id)}`;
}

/** Resolve a saved record without changing the active phase or falling back to another record. */
export function savedOrientationContext(
  id: string,
  folders: readonly PhaseCaseFolder[],
  orientations: readonly SubstationOrientationRecord[],
) {
  const existing = orientations.find(item => item.id === id);
  if (!existing) return undefined;
  const folder = folders.find(item =>
    item.phase === (existing.phase ?? 1) &&
    item.recruitBadge === existing.recruitBadge &&
    (item.className ?? '') === existing.className &&
    (existing.phaseStartDate === getNextReportDate(item, []) || existing.phaseStartDate === item.phaseStartDate),
  );
  return folder ? { folder, existing } : undefined;
}
