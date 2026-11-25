import { OperatorFacingError } from './operator-errors.js';
import { OperationalAssignmentToken } from '@workspace/api-zod/operational-profile';

import {
  PHASES, SHIFTS, WEEKDAYS, type FtoRosterEntry, type Phase, type Shift,
  type TrainingAssignment, type Weekday,
} from './model.js';
import { parseDateDMY, requiredDaysOff } from './training-calendar.js';
import {
  cruiserDistrictForFtoAssignment, isUniversalFtoAssignment, isValidFtoAssignment, PatrolAssignmentMetadataSchema,
} from './cpd-geography.js';

export type AssignmentDraft = Omit<TrainingAssignment, 'id'>;
export interface ParsedRoster {
  ftos: FtoRosterEntry[];
  assignments: AssignmentDraft[];
  errors: string[];
  warnings: string[];
  sourceRows: number;
}

const HEADER_ALIASES: Record<string, string[]> = {
  operationalAssignmentToken: ['fto operational assignment', 'fto vehicle profile'],
  poOperationalAssignmentToken: ['po operational assignment', 'po vehicle profile'],
  className: ['class', 'class name', 'training class'],
  recruitName: ['po name', 'po full name', 'probationary officer', 'recruit name'],
  recruitBadge: ['po badge', 'po badge number', 'recruit badge', 'recruit badge number'],
  recruitEmail: ['po email', 'recruit email'],
  ftoName: ['fto name', 'fto full name', 'field training officer'],
  ftoBadge: ['fto badge', 'fto badge number', 'badge number'],
  ftoEmail: ['fto email'],
  phase: ['phase', 'training phase'],
  phaseStartDate: ['phase start date', 'start date', 'phase start'],
  shift: ['shift', 'company', 'shift company'],
  daysOff: ['days off', 'required days off'],
  zone: ['zone', 'patrol zone'],
  precinct: ['precinct', 'patrol precinct'],
  cruiserDistrict: ['cruiser district', 'district'],
  ftoAssignment: ['fto assignment', 'patrol assignment code', 'call sign', 'callsign', 'tactical call sign', 'tactical identifier'],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseDelimited(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [',', '\t', ';'].sort((a,b) =>
    [...firstLine].filter(character=>character===b).length - [...firstLine].filter(character=>character===a).length,
  )[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const character = source[i];
    if (character === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim()); cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(value=>value)) rows.push(row);
      row = [];
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(value=>value)) rows.push(row);
  return rows;
}

function getValue(row: string[], columns: Map<string,number>, field: string) {
  const index = columns.get(field);
  return index === undefined ? '' : (row[index] ?? '').trim();
}

function emailIsValid(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseDate(value: string) {
  return parseDateDMY(value.trim());
}

const WEEKDAY_ALIASES: Record<string, Weekday> = {
  sun:0, sunday:0, mon:1, monday:1, tue:2, tues:2, tuesday:2,
  wed:3, wednesday:3, thu:4, thur:4, thurs:4, thursday:4,
  fri:5, friday:5, sat:6, saturday:6,
};

function parseDaysOff(value: string): Weekday[] | undefined {
  if (!value.trim()) return undefined;
  const tokens = value.split(/[;,|]+/).map(token=>token.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return undefined;
  const days = tokens.map(token=>WEEKDAY_ALIASES[token]);
  if (days.some(day=>day===undefined)) return undefined;
  return [...new Set(days)].sort((a,b)=>a-b) as Weekday[];
}

export function parseRosterRows(rows: string[][]): ParsedRoster {
  if (rows.length < 2) return { ftos:[], assignments:[], errors:['The file needs a header row and at least one data row.'], warnings:[], sourceRows:0 };
  const headers = rows[0].map(normalizeHeader);
  const columns = new Map<string,number>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = headers.findIndex(header=>aliases.includes(header));
    if (index >= 0) columns.set(field,index);
  }
  if (!columns.has('ftoName') || !columns.has('ftoBadge')) {
    return { ftos:[], assignments:[], errors:['Add “FTO Name” and “FTO Badge” columns. PO fields may be left blank for an FTO-only roster row.'], warnings:[], sourceRows:rows.length-1 };
  }

  const ftos = new Map<string,FtoRosterEntry>();
  const assignments: AssignmentDraft[] = [];
  const errors: string[] = [];
  rows.slice(1).forEach((row,index)=>{
    const line=index+2;
    const ftoName=getValue(row,columns,'ftoName');
    const ftoBadge=getValue(row,columns,'ftoBadge');
    const ftoEmail=getValue(row,columns,'ftoEmail');
    const recruitName=getValue(row,columns,'recruitName');
    const recruitBadge=getValue(row,columns,'recruitBadge');
    const recruitEmail=getValue(row,columns,'recruitEmail');
    const rowErrors:string[]=[];
    const operationalAssignmentToken=getValue(row,columns,'operationalAssignmentToken');
    const poOperationalAssignmentToken=getValue(row,columns,'poOperationalAssignmentToken');
    for(const token of [operationalAssignmentToken,poOperationalAssignmentToken]) {
      if(token&&!OperationalAssignmentToken.safeParse(token).success) rowErrors.push('operational vehicle profile must use four district digits, an uppercase shift letter, and optional -1 or -2');
    }
    if (!ftoName || !ftoBadge) rowErrors.push('FTO name and badge are required');
    if (!emailIsValid(ftoEmail) || !emailIsValid(recruitEmail)) rowErrors.push('email address is invalid');
    if (ftoName && ftoBadge) {
      const key=ftoBadge.toLowerCase();
      const previous=ftos.get(key);
      ftos.set(key,{name:ftoName,badge:ftoBadge,email:ftoEmail||previous?.email,
        ...(operationalAssignmentToken&&OperationalAssignmentToken.safeParse(operationalAssignmentToken).success
          ?{operationalAssignmentToken}:previous?.operationalAssignmentToken?{operationalAssignmentToken:previous.operationalAssignmentToken}:{})});
    }
    if (!recruitName && !recruitBadge) {
      if (rowErrors.length) errors.push(`Row ${line}: ${rowErrors.join('; ')}`);
      return;
    }
    if (!recruitName || !recruitBadge) rowErrors.push('PO name and badge must both be provided');
    const className=getValue(row,columns,'className');
    const rawPhase=getValue(row,columns,'phase');
    const phaseValue=Number(rawPhase);
    const phase=rawPhase
      ? PHASES.includes(phaseValue as Phase) ? phaseValue as Phase : undefined
      : 1;
    const startDate=parseDate(getValue(row,columns,'phaseStartDate'));
    const shiftValue=getValue(row,columns,'shift') as Shift;
    const shift=SHIFTS.includes(shiftValue) ? shiftValue : undefined;
    const rawShift=getValue(row,columns,'shift');
    const daysOff=parseDaysOff(getValue(row,columns,'daysOff'));
    const rawDaysOff=getValue(row,columns,'daysOff');
    const zone=getValue(row,columns,'zone');
    const precinct=getValue(row,columns,'precinct');
    const ftoAssignment=getValue(row,columns,'ftoAssignment');
    const explicitDistrict=getValue(row,columns,'cruiserDistrict');
    const districtFromAssignment=ftoAssignment&&!isUniversalFtoAssignment(ftoAssignment)
      ?cruiserDistrictForFtoAssignment(zone,precinct,ftoAssignment,shiftValue)
      :undefined;
    const cruiserDistrict=explicitDistrict||districtFromAssignment||'';
    if(isUniversalFtoAssignment(ftoAssignment)&&!explicitDistrict) {
      rowErrors.push('Cruiser District is required for 80C, 80C-1 and 80C-2 so the mapped patrol area is preserved');
    } else if(ftoAssignment&&!isValidFtoAssignment(zone,precinct,ftoAssignment,shiftValue,cruiserDistrict)) {
      rowErrors.push('FTO assignment must match the selected patrol area, mapped cruiser district, and shift');
    }
    if(zone||precinct||cruiserDistrict||ftoAssignment) {
      const metadata=PatrolAssignmentMetadataSchema.safeParse({zone,precinct,cruiserDistrict,shift:shiftValue,ftoAssignment:ftoAssignment||undefined});
      if(!metadata.success) rowErrors.push(...metadata.error.issues.map(issue=>issue.message));
    }
    if (!className) rowErrors.push('training class is required');
    if (!phase) rowErrors.push('phase must be 1, 2, 3, or 4');
    if (!startDate) rowErrors.push('phase start date must use MM/DD/YYYY');
    if (rawShift && !shift) rowErrors.push('shift must be A-Co, B-Co, C-Co, DMW, or EMW');
    if (rawDaysOff && !daysOff) rowErrors.push('days off must list weekday names separated by semicolons');
    if (daysOff && shift && daysOff.length!==requiredDaysOff(shift)) rowErrors.push(`${shift} requires ${requiredDaysOff(shift)} days off`);
    if (rowErrors.length) {
      errors.push(`Row ${line}: ${rowErrors.join('; ')}`);
      return;
    }
    assignments.push({
      className,recruitName,recruitBadge,recruitEmail:recruitEmail||undefined,
      ftoBadge,phase:phase!,phaseStartDate:startDate!,shift,
      daysOff,zone:zone||undefined,
      precinct:precinct||undefined,
      cruiserDistrict:cruiserDistrict||undefined,
      ftoAssignment:ftoAssignment||undefined,
      ...(poOperationalAssignmentToken?{poOperationalAssignmentToken}:{}),
    });
  });
  return { ftos:[...ftos.values()],assignments,errors,warnings:[],sourceRows:rows.length-1 };
}

export async function parseRosterFile(file: File): Promise<ParsedRoster> {
  if (file.size > 2*1024*1024) throw new OperatorFacingError('Choose a file smaller than 2 MB.');
  if (/\.csv$/i.test(file.name)) return parseRosterRows(parseDelimited(await file.text()));
  if (/\.xlsx$/i.test(file.name)) {
    const imported=await import('xlsx');
    const workbook=imported.read(await file.arrayBuffer(),{type:'array',cellDates:false});
    if(!workbook.SheetNames.length) throw new OperatorFacingError('The Excel workbook needs a roster worksheet.');
    const sheet=workbook.Sheets[workbook.SheetNames[0]];
    return parseRosterRows(imported.utils.sheet_to_json<string[]>(sheet,{header:1,raw:false,defval:''}));
  }
  if (!/\.docx$/i.test(file.name)) throw new OperatorFacingError('Use a CSV, Excel .xlsx, or Word .docx file with a header row.');
  const imported=await import('mammoth');
  const {value, messages}=await imported.convertToHtml({arrayBuffer:await file.arrayBuffer()});
  const document=new DOMParser().parseFromString(value,'text/html');
  const table=[...document.querySelectorAll('table')].find(item=>item.rows.length>1);
  if (!table) throw new OperatorFacingError('The Word document needs a table with column headings in its first row.');
  const rows=[...table.rows].map(row=>[...row.cells].map(cell=>cell.textContent?.trim()??''));
  const parsed=parseRosterRows(rows);
  const warnings=messages.filter(message=>message.type==='warning');
  if (warnings.length) parsed.warnings.push(`${warnings.length} Word formatting warning(s); review the import preview before adding the roster.`);
  return parsed;
}

export const ROSTER_CSV_TEMPLATE = [
  'Class,PO Name,PO Badge,PO Email,FTO Name,FTO Badge,FTO Email,Phase,Phase Start Date,Shift,Days Off,Zone,Precinct,Cruiser District,FTO Assignment',
  'Class name,,,,FTO name,FTO badge,,,MM/DD/YYYY,A-Co,Sunday;Saturday,,,,',
].join('\n');
