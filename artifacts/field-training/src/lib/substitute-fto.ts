import {
  defaultRatings, defaultReportingForDutyRecord, emptyDailyActivitySummary, emptyRatings,
  type FtoRosterEntry, type Report, type Shift, type TrainingAssignment,
} from './model.js';
import { getPhaseScheduleInfo, getTrainingWeekNumber, parseDateDMY, formatDateDMY } from './training-calendar.js';
import { cruiserDistrictForFtoAssignment, isValidAssignment } from './cpd-geography.js';

export interface SubstituteDayInput {
  assignment: TrainingAssignment;
  regularFto: FtoRosterEntry;
  substitute: FtoRosterEntry;
  date: string;
  shift: Shift;
  zone: string;
  precinct: string;
  cruiserDistrict: string;
  ftoAssignment?: string;
}

export function createSubstituteDay(input: SubstituteDayInput, reports: Report[], id: string, now: string): Report {
  const { assignment, regularFto, substitute, date, shift, zone, precinct, cruiserDistrict: providedDistrict, ftoAssignment } = input;
  const cruiserDistrict = ftoAssignment
    ? cruiserDistrictForFtoAssignment(zone, precinct, ftoAssignment, shift)
    : providedDistrict;
  if (!date || parseDateDMY(formatDateDMY(date)) !== date || date < assignment.phaseStartDate) {
    throw new Error('Choose a valid coverage date on or after the phase start date.');
  }
  if (!substitute.name?.trim() || !substitute.badge?.trim() || regularFto.badge !== assignment.ftoBadge) {
    throw new Error('Select the assigned FTO and a substitute from the FTO Office roster.');
  }
  if (substitute.badge.toLowerCase() === regularFto.badge.toLowerCase()) {
    throw new Error('Select a substitute other than the regularly assigned FTO.');
  }
  if (!shift || !cruiserDistrict || !isValidAssignment(zone, precinct, cruiserDistrict)) {
    throw new Error('Confirm the coverage shift, zone, precinct, and FTO assignment.');
  }
  if (reports.some(report => report.date === date && report.phase === assignment.phase
    && report.recruitBadge === assignment.recruitBadge && report.className === assignment.className)) {
    throw new Error('A daily log already exists for this PO, phase, and date. Open that log instead; no duplicate was created.');
  }
  const schedule=assignment.daysOff?.length
    ?getPhaseScheduleInfo(assignment.phase,date,assignment.phaseStartDate,assignment.daysOff)
    :{phaseWeek:getTrainingWeekNumber(date,assignment.phaseStartDate),limboDay:false};
  return {
    id, date, shift, phase: assignment.phase, phaseWeek: schedule.phaseWeek, limboDay:schedule.limboDay,
     className: assignment.className, zone, precinct, cruiserDistrict, ftoAssignment,
    recruitName: assignment.recruitName, recruitBadge: assignment.recruitBadge,
    ftoName: substitute.name, ftoBadge: substitute.badge,
    substituteCoverage: {
      assignmentId: assignment.id, regularFtoName: regularFto.name,
      regularFtoBadge: regularFto.badge, phaseStartDate: assignment.phaseStartDate,
    },
    activity: emptyDailyActivitySummary(), runs: [],
    reportingForDuty: {
      ...defaultReportingForDutyRecord(),
      notes: `FTO ${substitute.name} #${substitute.badge} substituting for FTO ${regularFto.name} #${regularFto.badge}.`,
    },
    ratings: schedule.limboDay?emptyRatings():defaultRatings(), narrative: '', remedial: '', recruitComments: '',
    status: 'draft', signatures: {}, createdAt: now, updatedAt: now,
  };
}
