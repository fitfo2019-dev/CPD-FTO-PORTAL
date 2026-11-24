import {
  defaultRatings,
  defaultReportingForDutyRecord,
  emptyDailyActivitySummary,
  emptyRatings,
  uid,
  type PhaseCaseFolder,
  type Report,
} from './model.js';
import { getPhaseScheduleInfo } from './training-calendar.js';
import { OperationalIdentitySnapshot, type OperationalIdentity } from '@workspace/api-zod/operational-profile';

/** Build a daily draft from the active folder without carrying forward prior evaluations. */
export function createDailyReportDraft(folder:PhaseCaseFolder,date:string,prior?:Report,identity?:OperationalIdentity):Report {
  const snapshot=identity?OperationalIdentitySnapshot.parse(identity):undefined;
  const now=new Date().toISOString();
  const schedule=getPhaseScheduleInfo(folder.phase,date,folder.phaseStartDate,folder.daysOff,folder.phaseWeekRanges,folder.limboExtensionWeeks);
  return {
    id:uid(),date,shiftStartTime:'',shift:folder.shift,phase:folder.phase,zone:folder.zone,precinct:folder.precinct,
    cruiserDistrict:folder.cruiserDistrict,ftoAssignment:folder.ftoAssignment,className:folder.className??'',
    recruitName:folder.recruitName,recruitBadge:folder.recruitBadge,ftoName:folder.ftoName,ftoBadge:folder.ftoBadge,
    activity:emptyDailyActivitySummary(),activityCountsIncludeRuns:false,runs:[],
    ...(snapshot?{operationalIdentity:{...snapshot}}:{}),
    reportingForDuty:{...defaultReportingForDutyRecord(),cruiserId:prior?.reportingForDuty?.cruiserId},
    deficiencyAutomationEnabled:true,ratings:schedule.limboDay?emptyRatings():defaultRatings(),
    phaseWeek:schedule.phaseWeek,limboDay:schedule.limboDay,narrative:'',remedial:'',recruitComments:'',
    syncStatus:'local_draft_pending',serverVersion:0,
    status:'draft',signatures:{},createdAt:now,updatedAt:now,
  };
}
