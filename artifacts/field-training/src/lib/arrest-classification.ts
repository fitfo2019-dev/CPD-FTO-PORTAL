export const ARREST_SEVERITIES = ['Felony', 'Misdemeanor'] as const;
export type ArrestSeverity = typeof ARREST_SEVERITIES[number];

export const ARREST_TYPES = ['Warrant', 'On-view'] as const;
export type ArrestType = typeof ARREST_TYPES[number];

export const ARREST_CLASSIFICATION_VERSION = 1 as const;

export function isArrestSeverity(value: unknown): value is ArrestSeverity {
  return typeof value === 'string' && ARREST_SEVERITIES.includes(value as ArrestSeverity);
}

export function isArrestType(value: unknown): value is ArrestType {
  return typeof value === 'string' && ARREST_TYPES.includes(value as ArrestType);
}

export function expandArrestClassificationShortcut(
  field: 'severity' | 'type',
  input: string,
): string {
  const value = input.trim().toLowerCase();
  if (field === 'severity') {
    if (value === 'f' || value === 'felony') return 'Felony';
    if (value === 'm' || value === 'misdemeanor') return 'Misdemeanor';
  } else {
    if (value === 'w' || value === 'warrant') return 'Warrant';
    if (value === 'o' || value === 'on-view' || value === 'on view') return 'On-view';
  }
  return input;
}
