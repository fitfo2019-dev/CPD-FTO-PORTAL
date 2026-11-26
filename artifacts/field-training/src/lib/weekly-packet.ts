import type { PhaseCaseFolder, Weekday } from './model.js';
import { getCaseFolderWeekRanges } from './training-calendar.js';

const DAY_MS = 86_400_000;

function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function weekdayOf(isoDate: string): Weekday {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay() as Weekday;
}

export type DueBasis = 'off_days' | 'manual_default';

export interface WeeklyPacketDue {
  /** Calendar date (YYYY-MM-DD); the packet is due by 23:59 local time on this date. */
  dueDate: string;
  basis: DueBasis;
}

/**
 * Owner decision (set 32): the weekly packet is due at the end of the FTO's first
 * working day after the Saturday week end, using the off days saved at Phase Setup.
 * Without saved off days, the manual's "within 3 days" applies.
 */
export function weeklyPacketDueDate(weekEnd: string, daysOff: readonly Weekday[] | undefined): WeeklyPacketDue {
  const off = new Set(daysOff ?? []);
  if (off.size === 0 || off.size >= 7) return { dueDate: addDays(weekEnd, 3), basis: 'manual_default' };
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(weekEnd, offset);
    if (!off.has(weekdayOf(candidate))) return { dueDate: candidate, basis: 'off_days' };
  }
  return { dueDate: addDays(weekEnd, 3), basis: 'manual_default' };
}

export type DueState =
  | { kind: 'not_due'; daysUntilDue: number }
  | { kind: 'due_today' }
  | { kind: 'late'; daysLate: number }
  | { kind: 'complete'; daysLate: number };

/** Packet timeliness; lateness is tracked against the FTO, never the PO (set 23). */
export function weeklyPacketDueState(dueDate: string, today: string, completedOn?: string): DueState {
  const diff = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DAY_MS);
  if (completedOn) return { kind: 'complete', daysLate: Math.max(0, diff(completedOn, dueDate)) };
  const remaining = diff(dueDate, today);
  if (remaining > 0) return { kind: 'not_due', daysUntilDue: remaining };
  if (remaining === 0) return { kind: 'due_today' };
  return { kind: 'late', daysLate: -remaining };
}

export type Week15Choice = 'release' | 'not_release';

/**
 * Manual "Week 15 Recommendation" verbiage. Owner-approved change: 30 categories
 * (the manual text reads 38). All other words are verbatim.
 */
export function week15Statement(choice: Week15Choice, poName: string): string {
  const name = poName.trim() || '_______';
  return choice === 'release'
    ? `On Phase four PO ${name} demonstrated they could perform at an acceptable level in the 30 categories that make up the Standard Evaluation Guidelines and have shown they can operate as a safe efficient one officer unit with little to no FTO assistance.`
    : `On Phase four PO ${name} did not demonstrate they could perform at an acceptable level in the 30 categories that make up the Standard Evaluation Guidelines and have not shown they can operate as a safe efficient one officer car without significant FTO assistance.`;
}

/** Start date of program Week 15 (Phase IV, phase week 3); the pre-selection is due before it. */
export function week15StartDate(folder: Pick<PhaseCaseFolder, 'phase' | 'phaseStartDate' | 'scheduledWeeks' | 'phaseWeekRanges'>): string | undefined {
  if (folder.phase !== 4) return undefined;
  return getCaseFolderWeekRanges(folder)[2]?.startDate;
}

export type Week15Window = 'not_phase_four' | 'open' | 'overdue' | 'final_week';

export function week15Window(
  folder: Pick<PhaseCaseFolder, 'phase' | 'phaseStartDate' | 'scheduledWeeks' | 'phaseWeekRanges'>,
  today: string,
  selected: boolean,
): Week15Window {
  const start = week15StartDate(folder);
  if (!start) return 'not_phase_four';
  if (today < start) return 'open';
  return selected ? 'final_week' : 'overdue';
}
