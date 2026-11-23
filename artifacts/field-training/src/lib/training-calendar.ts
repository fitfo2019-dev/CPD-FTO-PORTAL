import { PHASE_LENGTH_WEEKS, PHASE_LIMBO_FULL_WEEKS, PHASE_LIMBO_WORKDAYS, PHASE_PROGRAM_WEEK_START, type Phase, type PhaseCaseFolder, type PhaseWeekRange, type Report, type ReportShift, type Shift, type Weekday } from './model.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function localISODate(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function formatDateMDY(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : '';
}

export function parseDateMDY(value: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    return undefined;
  }
  return `${match[3]}-${match[1]}-${match[2]}`;
}

/** Compatibility aliases for existing screens; both now use strict MM/DD/YYYY. */
export const formatDateDMY = formatDateMDY;
export const parseDateDMY = parseDateMDY;

export function formatDateTimeMDY(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day}/${year} ${hours}:${minutes}`;
}

export function formatDateEntryMDY(value: string): string {
  if (value.trim() === '?') return '?';
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function formatDateTimeEntryMDY(value: string): string {
  if (value.trim() === '?') return '?';
  const digits = value.replace(/\D/g, '').slice(0, 12);
  const date = formatDateEntryMDY(digits.slice(0, 8));
  if (digits.length <= 8) return date;
  const timeDigits = digits.slice(8);
  const time = timeDigits.length <= 2
    ? timeDigits
    : `${timeDigits.slice(0, 2)}:${timeDigits.slice(2)}`;
  return `${date} ${time}`;
}

export function splitDateTimeEntryMDY(value: string): { date: string; time: string } {
  const formatted = formatDateTimeEntryMDY(value);
  if (formatted === '?') return { date: '?', time: '?' };
  const [date = '', time = ''] = formatted.split(' ');
  return { date, time };
}

export function currentDateTimeMDY(now = new Date()): { date: string; time: string } {
  const date = formatDateMDY(localISODate(now));
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

export function getSundaySaturdayWeek(isoDate: string): { start: string; end: string } | undefined {
  const parsed = parseDateMDY(formatDateMDY(isoDate));
  if (!parsed) return undefined;
  const [year, month, day] = parsed.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const sunday = new Date(date.getTime() - date.getUTCDay() * DAY_MS);
  const saturday = new Date(sunday.getTime() + 6 * DAY_MS);
  const toIso = (value: Date) => value.toISOString().slice(0, 10);
  return { start: toIso(sunday), end: toIso(saturday) };
}

/** Calendar end of a phase window, using the manual's Sunday–Saturday weeks. */
export function getPhaseEndDate(phase:Phase,phaseStartDate:string):string|undefined {
  const firstWeek=getSundaySaturdayWeek(phaseStartDate);
  if(!firstWeek)return undefined;
  const finalDay=new Date(Date.parse(`${firstWeek.start}T00:00:00Z`)+(PHASE_LENGTH_WEEKS[phase]*7-1)*DAY_MS);
  return finalDay.toISOString().slice(0,10);
}

export function getTrainingWeekNumber(isoDate: string, phaseStartDate: string): number | undefined {
  const currentWeek = getSundaySaturdayWeek(isoDate);
  const firstWeek = getSundaySaturdayWeek(phaseStartDate);
  if (!currentWeek || !firstWeek) return undefined;
  const elapsedDays = Math.round((Date.parse(currentWeek.start) - Date.parse(firstWeek.start)) / DAY_MS);
  if (elapsedDays < 0) return undefined;
  return Math.floor(elapsedDays / 7) + 1;
}

export function createPhaseWeekRanges(phase:Phase,phaseStartDate:string,additionalWeeks=0,scheduledWeeks=PHASE_LENGTH_WEEKS[phase]):PhaseWeekRange[] {
  const firstWeek=getSundaySaturdayWeek(phaseStartDate);
  if(!firstWeek)return [];
  const weekCount=Math.max(1,Math.floor(scheduledWeeks))+Math.max(0,Math.floor(additionalWeeks));
  return Array.from({length:weekCount},(_,index)=>{
    const start=new Date(`${firstWeek.start}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate()+index*7);
    const end=new Date(start);
    end.setUTCDate(end.getUTCDate()+6);
    return {startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)};
  });
}

/** Resolve a case folder from its saved schedule, not the current program standard. */
export function getCaseFolderWeekRanges(folder:Pick<PhaseCaseFolder,'phase'|'phaseStartDate'|'scheduledWeeks'|'phaseWeekRanges'>):PhaseWeekRange[] {
  if(folder.phaseWeekRanges?.length)return folder.phaseWeekRanges;
  return createPhaseWeekRanges(folder.phase,folder.phaseStartDate,0,folder.scheduledWeeks);
}

export function getPhaseWeekNumber(isoDate:string,phaseStartDate:string,phaseWeekRanges?:readonly PhaseWeekRange[]):number|undefined {
  if(phaseWeekRanges?.length) {
    const index=phaseWeekRanges.findIndex(range=>isoDate>=range.startDate&&isoDate<=range.endDate);
    return index<0?undefined:index+1;
  }
  return getTrainingWeekNumber(isoDate,phaseStartDate);
}

export interface PhaseScheduleInfo {
  phaseWeek?: number;
  programWeek?: number;
  scheduledDay?: number;
  limboDay: boolean;
}

export function getPhaseScheduleInfo(phase:Phase,isoDate:string,phaseStartDate:string,daysOff:Weekday[],phaseWeekRanges?:readonly PhaseWeekRange[],limboExtensionWeeks=0):PhaseScheduleInfo {
  const phaseWeek=getPhaseWeekNumber(isoDate,phaseStartDate,phaseWeekRanges);
  if(!phaseWeek)return {limboDay:false};
  const programWeek=PHASE_PROGRAM_WEEK_START[phase]+phaseWeek-1;
  const window=getSundaySaturdayWeek(isoDate);
  if(!window||isoDate<phaseStartDate)return {phaseWeek,programWeek,limboDay:false};
  const currentWeekday=getWeekdayIndex(isoDate);
  if(currentWeekday===undefined||daysOff.includes(currentWeekday))return {phaseWeek,programWeek,limboDay:false};
  let scheduledDay=0;
  const firstDate=window.start<phaseStartDate?phaseStartDate:window.start;
  for(let date=firstDate;date<=isoDate;date=new Date(Date.parse(`${date}T00:00:00Z`)+DAY_MS).toISOString().slice(0,10)){
    const weekday=getWeekdayIndex(date);
    if(weekday!==undefined&&!daysOff.includes(weekday))scheduledDay++;
  }
  const limboDay=phaseWeek===1&&!!scheduledDay&&(PHASE_LIMBO_FULL_WEEKS.includes(phase)||scheduledDay<=PHASE_LIMBO_WORKDAYS[phase]||(limboExtensionWeeks>0&&!!phaseWeekRanges?.[0]&&isoDate<=phaseWeekRanges[0].endDate));
  return {phaseWeek,programWeek,scheduledDay,limboDay};
}

export interface TrainingFolderDayReference {
  week: number;
  day: number;
}

export function getTrainingFolderDayReference(
  phase: Phase,
  isoDate: string,
  phaseStartDate: string,
  daysOff: Weekday[],
): TrainingFolderDayReference | undefined {
  const schedule = getPhaseScheduleInfo(phase, isoDate, phaseStartDate, daysOff);
  if (!schedule.programWeek || !schedule.scheduledDay) return undefined;
  return { week: schedule.programWeek, day: schedule.scheduledDay };
}

export function formatTrainingFolderPageReference(
  dayReference: TrainingFolderDayReference | undefined,
  page: number,
): string | undefined {
  if (!dayReference || !Number.isInteger(page) || page < 1) return undefined;
  return `W${dayReference.week}D${dayReference.day}P${page}`;
}

export function shiftWeekDescription(shift: ReportShift): string {
  return shift === 'DMW' || shift === 'EMW'
    ? `${shift} uses four scheduled workdays and three days off in each Sunday–Saturday week.`
    : shift === 'Day' || shift === 'Swing' || shift === 'Night'
      ? 'Legacy shift has no configured Columbus week pattern.'
    : `${shift} uses five scheduled workdays and two days off in each Sunday–Saturday week.`;
}

export function requiredDaysOff(shift: Shift): number {
  return shift === 'DMW' || shift === 'EMW' ? 3 : 2;
}

export function getWeekdayIndex(isoDate: string): Weekday | undefined {
  const parsed = parseDateMDY(formatDateMDY(isoDate));
  if (!parsed) return undefined;
  const [year, month, day] = parsed.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as Weekday;
}

export function getNextWorkingDate(isoDate: string, daysOff: Weekday[]): string {
  const parsed = parseDateMDY(formatDateMDY(isoDate));
  if (!parsed) return isoDate;
  const [year, month, day] = parsed.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(start.getTime() + offset * DAY_MS);
    if (!daysOff.includes(candidate.getUTCDay() as Weekday)) return candidate.toISOString().slice(0, 10);
  }
  return isoDate;
}

export function getNextReportDate(folder: Pick<PhaseCaseFolder,'recruitBadge'|'recruitName'|'phase'|'shift'|'className'|'phaseStartDate'|'daysOff'>, reports: Pick<Report,'date'|'recruitBadge'|'recruitName'|'phase'|'shift'|'className'>[]): string {
  const matching = reports.filter(report =>
    report.recruitBadge === folder.recruitBadge &&
    report.recruitName === folder.recruitName &&
    report.phase === folder.phase &&
    report.shift === folder.shift &&
    (report.className ?? '') === (folder.className ?? ''),
  );
  const latest = matching.reduce<string | undefined>((date,report)=>!date || report.date > date ? report.date : date,undefined);
  if (!latest) return getNextWorkingDate(folder.phaseStartDate,folder.daysOff);
  const nextDate = new Date(Date.parse(`${latest}T00:00:00Z`)+DAY_MS).toISOString().slice(0,10);
  return getNextWorkingDate(nextDate,folder.daysOff);
}
