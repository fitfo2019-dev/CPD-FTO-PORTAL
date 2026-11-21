import { parseDateDMY, splitDateTimeEntryMDY } from './training-calendar';

/** Parse a complete local timestamp; never infer an overnight date. */
export function parseRunDateTime(value:string):string|undefined {
  const {date,time}=splitDateTimeEntryMDY(value);
  const parsedDate=parseDateDMY(date);
  if(!parsedDate||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
  const local=new Date(`${parsedDate}T${time}:00`);
  if(Number.isNaN(local.getTime())) return;
  // Reject nonexistent local times during a daylight-saving transition.
  if(local.getHours()!==Number(time.slice(0,2))||local.getMinutes()!==Number(time.slice(3,5))) return;
  return local.toISOString();
}

export function runDetailError(occurredAt:string,endText:string):string|undefined {
  if(!endText.trim()) return;
  const endedAt=parseRunDateTime(endText);
  if(!endedAt) return 'Enter the end date and time as MM/DD/YYYY HH:MM, or leave it blank while the run is in progress.';
  if(new Date(endedAt).getTime()<new Date(occurredAt).getTime()) return 'End time cannot be before the run started. For an overnight run, enter the next date.';
  return undefined;
}
