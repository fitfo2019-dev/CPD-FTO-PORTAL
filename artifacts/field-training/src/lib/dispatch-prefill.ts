import { DEFAULT_RUN_TYPE_CODES } from './radio-codes.js';
import type { TrainingRun } from './model.js';
import { OperationalIdentitySnapshot, type OperationalIdentity } from '@workspace/api-zod/operational-profile';

export type DispatchPrefill = {
  cadIdentity?: OperationalIdentity;
  eventDate?: string;
  eventIngressAt?: string;
  incidentNumber?: string;
  location?: string;
  locationAddress?: string;
  locationCity?: string;
  locationState?: string;
  locationZip?: string;
  zone?: string;
  cruiserDistrict?: string;
  dispatchedCode?: string;
  clearanceCode?: ''|'1V'|'2V'|'3V'|'4V';
};

export type DispatchIncidentPrefill=DispatchPrefill & {
  incidentNumber:string;
  unitNumber?:string;
  dispatchedAt?:string;
  clearedAt?:string;
};

export type DispatchIncidentDraftFields = {
  location: string;
  locationCity: string;
  locationState: string;
  locationZip: string;
  zone: string;
  cruiserDistrict: string;
  occurredAtText: string;
  dispatchedAtText: string;
  clearedAtText: string;
  dispatchedCode: string;
  clearanceCode: NonNullable<DispatchPrefill['clearanceCode']>;
};

export type DispatchIncidentDraftDefaults = Partial<DispatchIncidentDraftFields>;

/** A retry fills only fields that still match their values before the first lookup. */
export function applyDispatchIncidentRetry(
  current: DispatchIncidentDraftFields,
  initial: DispatchIncidentDraftFields,
  incoming: DispatchIncidentDraftDefaults,
): DispatchIncidentDraftFields {
  const next = { ...current };
  const keys: (keyof DispatchIncidentDraftFields)[] = [
    'location',
    'locationCity',
    'locationState',
    'locationZip',
    'zone',
    'cruiserDistrict',
    'occurredAtText',
    'dispatchedAtText',
    'clearedAtText',
    'dispatchedCode',
    'clearanceCode',
  ];
  for (const key of keys) {
    const value = incoming[key];
    if (value !== undefined && current[key] === initial[key]) {
      Object.assign(next, { [key]: value });
    }
  }
  return next;
}

const normalizedUnit=(value:string)=>value.trim().toUpperCase().replace(/\s+/g,' ');
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME=/(?:Z|[+-]\d{2}:\d{2})$/i;

function validOptionalText(record:Record<string,unknown>,key:string,max:number,pattern?:RegExp):string|undefined|false {
  const value=record[key];
  if(value===undefined)return;
  if(typeof value!=='string'||value.trim().length>max|| (pattern&&!pattern.test(value.trim())))return false;
  return value.trim()||undefined;
}

/** Reject malformed envelopes rather than silently selecting a partial result. */
export function mapDispatchIncidentResponse(value:unknown):DispatchIncidentPrefill[]|undefined {
  if(value===null||typeof value!=='object'||Array.isArray(value))return;
  const root=value as Record<string,unknown>;
  const metadata=root.metadata;
  if(root.status!=='success'||metadata===null||typeof metadata!=='object'||Array.isArray(metadata)||
    !Array.isArray(root.data)||root.data.length>100||
    (metadata as Record<string,unknown>).total_records!==root.data.length)return;
  const result:DispatchIncidentPrefill[]=[];
  for(const item of root.data){
    const common=mapDispatchPrefillResponse({status:'success',metadata:{total_records:1},data:[item]});
    if(!common?.incidentNumber?.trim()||typeof item!=='object'||item===null||Array.isArray(item))return;
    const record=item as Record<string,unknown>;
    if(record.unitNumber!==undefined&&(typeof record.unitNumber!=='string'||!/^[A-Za-z0-9 ._:/-]{1,40}$/.test(record.unitNumber.trim())))return;
    const row:DispatchIncidentPrefill={...common,incidentNumber:common.incidentNumber};
    if(typeof record.unitNumber==='string')row.unitNumber=record.unitNumber.trim();
    if(row.cadIdentity&&row.unitNumber&&normalizedUnit(row.unitNumber)!==row.cadIdentity.cadUnit)return;
    for(const key of ['dispatchedAt','clearedAt'] as const){
      const time=record[key];
      if(time===undefined)continue;
      if(typeof time!=='string'||!ISO_DATE_TIME.test(time)||!Number.isFinite(Date.parse(time)))return;
      // Unit-specific clock values require a unit association.
      if(row.unitNumber)row[key]=new Date(time).toISOString();
    }
    if(row.dispatchedAt&&row.clearedAt&&Date.parse(row.clearedAt)<Date.parse(row.dispatchedAt))return;
    result.push(row);
  }
  return result;
}

export type DispatchIncidentSelection=
  |{status:'matched';match:DispatchIncidentPrefill}
  |{status:'empty'|'choose_unit'|'ambiguous';matches:DispatchIncidentPrefill[]};

export function selectDispatchIncidentMatch(
  matches:readonly DispatchIncidentPrefill[],incidentNumber:string,unitNumber:string,
):DispatchIncidentSelection {
  const candidates=matches.filter(row=>normalizedUnit(row.incidentNumber)===normalizedUnit(incidentNumber));
  if(!candidates.length)return {status:'empty',matches:[]};
  const ownUnit=unitNumber.trim()?candidates.filter(row=>row.unitNumber&&normalizedUnit(row.unitNumber)===normalizedUnit(unitNumber)):[];
  if(ownUnit.length===1)return {status:'matched',match:ownUnit[0]};
  if(ownUnit.length>1)return {status:'ambiguous',matches:ownUnit};
  if(candidates.length===1&&!candidates[0].unitNumber)return {status:'matched',match:candidates[0]};
  // Never offer another unit's run as an override for the FTO's assigned unit.
  return {status:'empty',matches:[]};
}

export type DispatchPrefillDraft = {
  runDateTimeText: string;
  runTimeText: string;
  incidentNumber: string;
  runLocation: string;
  runLocationCity?: string;
  runLocationState?: string;
  runLocationZip?: string;
  runZone?: string;
  runCruiserDistrict?: string;
  clearanceCode?: DispatchPrefill['clearanceCode'];
  dispatchedCode: string;
};

export type SavedRunDispatchFields = {
  incidentNumber: string;
  runLocation: string;
  runLocationCity: string;
  runLocationState: string;
  runLocationZip: string;
  runZone: string;
  runCruiserDistrict: string;
  clearanceCode: NonNullable<DispatchPrefill['clearanceCode']>;
  dispatchedCode: string;
};

export function isDispatchedRunMissingIncidentNumber(
  run: Pick<TrainingRun, 'isDispatched' | 'incidentNumber'>,
): boolean {
  return run.isDispatched && !run.incidentNumber?.trim();
}

export function serializeDispatchPrefillFields(
  draft: DispatchPrefillDraft,
): Pick<
  TrainingRun,
  | 'incidentNumber'
  | 'location'
  | 'locationCity'
  | 'locationState'
  | 'locationZip'
  | 'incidentZone'
  | 'incidentCruiserDistrict'
  | 'clearanceCode'
  | 'dispatchedCode'
> {
  return {
    incidentNumber: draft.incidentNumber.trim() || undefined,
    location: draft.runLocation.trim() || undefined,
    locationCity: draft.runLocationCity?.trim() || undefined,
    locationState: draft.runLocationState?.trim() || undefined,
    locationZip: draft.runLocationZip?.trim() || undefined,
    incidentZone: draft.runZone?.trim() || undefined,
    incidentCruiserDistrict: draft.runCruiserDistrict?.trim() || undefined,
    clearanceCode: draft.clearanceCode,
    dispatchedCode: draft.dispatchedCode,
  };
}

/** Restore saved run values as-is; defaults are only for older runs missing a code. */
export function restoreDispatchPrefillFields(run: TrainingRun): SavedRunDispatchFields {
  return {
    incidentNumber: run.incidentNumber ?? '',
    runLocation: run.location ?? '',
    runLocationCity: run.locationCity ?? '',
    runLocationState: run.locationState ?? '',
    runLocationZip: run.locationZip ?? '',
    runZone: run.incidentZone ?? '',
    runCruiserDistrict: run.incidentCruiserDistrict ?? '',
    clearanceCode: run.clearanceCode ?? '',
    dispatchedCode: run.dispatchedCode ?? DEFAULT_RUN_TYPE_CODES[run.runKind] ?? '',
  };
}

export function applyDispatchPrefillValue(
  current: string,
  initial: string,
  incoming: string | undefined,
): string {
  return incoming !== undefined && current === initial ? incoming : current;
}

export function mapDispatchPrefillResponse(value: unknown): DispatchPrefill | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return;
  const root = value as Record<string, unknown>;
  const metadata = root.metadata;
  if (
    root.status !== "success"
    || typeof metadata !== "object"
    || metadata === null
    || Array.isArray(metadata)
    || typeof (metadata as Record<string, unknown>).total_records !== "number"
    || !Array.isArray(root.data)
    || root.data.length > 1
    || (metadata as Record<string, unknown>).total_records !== root.data.length
  ) return;
  if (root.data.length === 0) return {};
  const data = root.data[0];
  if (typeof data !== "object" || data === null || Array.isArray(data)) return;
  const record = data as Record<string, unknown>;
  const result: DispatchPrefill = {};
  if(record.cadIdentity!==undefined) {
    const identity=OperationalIdentitySnapshot.safeParse(record.cadIdentity);
    // Adapter responses must use current full identities, not historical packets.
    if(!identity.success||identity.data.districtToken===undefined)return;
    result.cadIdentity=identity.data;
  }
  for(const [key,max,pattern] of [
    ['location',200,undefined],
    ['locationAddress',200,undefined],
    ['locationCity',80,undefined],
    ['locationState',2,/^[A-Z]{2}$/],
    ['locationZip',10,/^\d{5}(?:-\d{4})?$/],
    ['zone',40,undefined],
    ['cruiserDistrict',40,undefined],
  ] as const) {
    const value=validOptionalText(record,key,max,pattern);
    if(value===false)return;
    if(value!==undefined)Object.assign(result,{[key]:value});
  }
  if(record.eventDate!==undefined) {
    if(typeof record.eventDate!=='string'||!ISO_DATE.test(record.eventDate))return;
    const parsedDate=new Date(`${record.eventDate}T00:00:00.000Z`);
    if(!Number.isFinite(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==record.eventDate)return;
    result.eventDate=record.eventDate;
  }
  if (record.eventIngressAt !== undefined) {
    if (typeof record.eventIngressAt !== "string" || !ISO_DATE_TIME.test(record.eventIngressAt) || !Number.isFinite(Date.parse(record.eventIngressAt))) return;
    result.eventIngressAt = new Date(record.eventIngressAt).toISOString();
  }
  if (record.incidentNumber !== undefined) {
    if (typeof record.incidentNumber !== "string" || record.incidentNumber.length > 120) return;
    result.incidentNumber = record.incidentNumber;
  }
  if (record.location !== undefined) {
    if (typeof record.location !== "string" || record.location.length > 200) return;
    result.location = record.location;
  }
  if (record.dispatchedCode !== undefined) {
    if (typeof record.dispatchedCode !== "string" || !/^(?:10[\s-]*)?\d{1,3}[A-Za-z]{0,2}$/.test(record.dispatchedCode.trim())) return;
    result.dispatchedCode = record.dispatchedCode.trim().replace(/^10[\s-]*/i,'').toUpperCase();
  }
  if(record.clearanceCode!==undefined) {
    if(!['','1V','2V','3V','4V'].includes(record.clearanceCode as string))return;
    result.clearanceCode=record.clearanceCode as DispatchPrefill['clearanceCode'];
  }
  return result;
}

/** Apply an incoming default only where the user has not edited that field. */
export function applyDispatchPrefill(
  current: DispatchPrefillDraft,
  initial: DispatchPrefillDraft,
  prefill: DispatchPrefill,
  eventDateTimeText?: string,
): DispatchPrefillDraft {
  return {
    runDateTimeText: applyDispatchPrefillValue(
      current.runDateTimeText,
      initial.runDateTimeText,
      eventDateTimeText,
    ),
    runTimeText: applyDispatchPrefillValue(
      current.runTimeText,
      initial.runTimeText,
      eventDateTimeText?.split(" ")[1],
    ),
    incidentNumber: applyDispatchPrefillValue(
      current.incidentNumber,
      initial.incidentNumber,
      prefill.incidentNumber,
    ),
    runLocation: applyDispatchPrefillValue(
      current.runLocation,
      initial.runLocation,
      prefill.locationAddress??prefill.location,
    ),
    ...(current.runLocationCity!==undefined||initial.runLocationCity!==undefined||prefill.locationCity!==undefined
      ?{runLocationCity:applyDispatchPrefillValue(current.runLocationCity??'',initial.runLocationCity??'',prefill.locationCity)}:{}),
    ...(current.runLocationState!==undefined||initial.runLocationState!==undefined||prefill.locationState!==undefined
      ?{runLocationState:applyDispatchPrefillValue(current.runLocationState??'',initial.runLocationState??'',prefill.locationState)}:{}),
    ...(current.runLocationZip!==undefined||initial.runLocationZip!==undefined||prefill.locationZip!==undefined
      ?{runLocationZip:applyDispatchPrefillValue(current.runLocationZip??'',initial.runLocationZip??'',prefill.locationZip)}:{}),
    ...(current.runZone!==undefined||initial.runZone!==undefined||prefill.zone!==undefined
      ?{runZone:applyDispatchPrefillValue(current.runZone??'',initial.runZone??'',prefill.zone)}:{}),
    ...(current.runCruiserDistrict!==undefined||initial.runCruiserDistrict!==undefined||prefill.cruiserDistrict!==undefined
      ?{runCruiserDistrict:applyDispatchPrefillValue(current.runCruiserDistrict??'',initial.runCruiserDistrict??'',prefill.cruiserDistrict)}:{}),
    ...(current.clearanceCode!==undefined||initial.clearanceCode!==undefined||prefill.clearanceCode!==undefined
      ?{clearanceCode:current.clearanceCode===initial.clearanceCode?prefill.clearanceCode??current.clearanceCode:current.clearanceCode}:{}),
    dispatchedCode: applyDispatchPrefillValue(
      current.dispatchedCode,
      initial.dispatchedCode,
      prefill.dispatchedCode,
    ),
  };
}
