import type { ReportShift } from './model.js';

/**
 * Regular start times by precinct, from the City of Columbus patrol staffing study
 * (Matrix Consulting Group, Aug 19, 2019, "Current Patrol Schedule and Assignments"):
 * https://www.columbus.gov/files/sharedassets/city/v/1/city-council/documents/columbus-final-report-8-19-19.pdf
 * Owner decision (Nov 27, 2026): the daily start time defaults to the assignment and stays editable.
 * A Company starts at 06:00 or 07:00 by precinct; B and C Company follow at 8 and 16 hours.
 */
const A_COMPANY_START_HOUR: Readonly<Record<string, 6 | 7>> = {
  '1': 7, '2': 7, '3': 7, '6': 7, '12': 7, '13': 7, '14': 7, '15': 7, '16': 7, '19': 7,
  '4': 6, '5': 6, '7': 6, '8': 6, '9': 6, '10': 6, '11': 6, '17': 6, '18': 6, '20': 6,
};
const COMPANY_OFFSET_HOURS: Readonly<Partial<Record<ReportShift, number>>> = { 'A-Co': 0, 'B-Co': 8, 'C-Co': 16 };
const MIDWATCH_START: Readonly<Partial<Record<ReportShift, string>>> = { DMW: '09:00', EMW: '19:00' };

/** The assignment's regular start time (24-hour HH:MM), or '' when the assignment is not in the table. */
export function assignmentShiftStartTime(shift: ReportShift, precinct: string): string {
  const midwatch = MIDWATCH_START[shift];
  if (midwatch) return midwatch;
  const offset = COMPANY_OFFSET_HOURS[shift];
  const base = A_COMPANY_START_HOUR[String(Number.parseInt(String(precinct).replace(/\D/g, ''), 10))];
  if (offset === undefined || base === undefined) return '';
  return `${String((base + offset) % 24).padStart(2, '0')}:00`;
}
