import type { Report, TrainingAssignment, PhaseCaseFolder } from './model';
import { PHASE_PROGRAM_WEEK_START } from './model';
import { getSundaySaturdayWeek, getTrainingWeekNumber, getWeekdayIndex } from './training-calendar';

/** Derive only week/day; P is a source page that the FTO must enter and verify. */
export function nrtReference(report: Report, assignments: TrainingAssignment[], folder?: PhaseCaseFolder, sourcePage?: number): string {
  const assignment = assignments.find(item=>item.recruitBadge===report.recruitBadge&&item.className===report.className
    &&item.phase===report.phase&&item.phaseStartDate<=report.date);
  const matchingFolder = folder?.recruitBadge===report.recruitBadge&&folder.phase===report.phase&&folder.className===report.className ? folder : undefined;
  const start = report.substituteCoverage?.phaseStartDate ?? assignment?.phaseStartDate ?? matchingFolder?.phaseStartDate;
  const daysOff = assignment?.daysOff ?? matchingFolder?.daysOff;
  const phaseWeek = report.phaseWeek ?? (start ? getTrainingWeekNumber(report.date,start) : undefined);
  const week = phaseWeek ? PHASE_PROGRAM_WEEK_START[report.phase] + phaseWeek - 1 : undefined;
  const window = getSundaySaturdayWeek(report.date);
  let day: number | undefined;
  if (start && daysOff?.length && window) {
    let count = 0;
    for (let date=window.start; date<=report.date; date=new Date(Date.parse(`${date}T00:00:00Z`)+86_400_000).toISOString().slice(0,10)) {
      const weekday=getWeekdayIndex(date);
      if (date>=start&&weekday!==undefined&&!daysOff.includes(weekday)) count++;
    }
    day = count || undefined;
  }
  return `W${week??'?'}D${day??'?'}P${sourcePage??'?'}`;
}
