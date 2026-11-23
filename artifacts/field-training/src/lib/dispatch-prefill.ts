import type {PrimaryRunForm} from './model.js';

export type DispatchPrefill = {
  eventIngressAt?: string;
  incidentNumber?: string;
  location?: string;
  dispatchedCode?: string;
};

export type DispatchIncidentPrefill=DispatchPrefill & {
  incidentNumber:string;
  unitNumber?:string;
  dispatchedAt?:string;
  clearedAt?:string;
  runKind?:PrimaryRunForm;
};
const dispatchRunTypes:readonly string[]=['call_for_service','self_initiated','domestic_incident','traffic_crash','traffic_stop','high_risk_stop','building_search'];
const normalizedUnit=(value:string)=>value.trim().toUpperCase().replace(/\s+/g,' ');

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
    for(const key of ['dispatchedAt','clearedAt'] as const){
      const time=record[key];
      if(time===undefined)continue;
      if(typeof time!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/i.test(time)||!Number.isFinite(Date.parse(time)))return;
      // Unit-specific clock values require a unit association.
      if(row.unitNumber)row[key]=new Date(time).toISOString();
    }
    if(row.dispatchedAt&&row.clearedAt&&Date.parse(row.clearedAt)<Date.parse(row.dispatchedAt))return;
    if(typeof record.runKind==='string'&&dispatchRunTypes.includes(record.runKind))row.runKind=record.runKind as PrimaryRunForm;
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
  dispatchedCode: string;
};

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
  if (record.eventIngressAt !== undefined) {
    if (typeof record.eventIngressAt !== "string" || !Number.isFinite(Date.parse(record.eventIngressAt))) return;
    result.eventIngressAt = record.eventIngressAt;
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
    if (typeof record.dispatchedCode !== "string" || !/^\d{1,3}[A-Za-z]?$/.test(record.dispatchedCode)) return;
    result.dispatchedCode = record.dispatchedCode.toUpperCase();
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
      prefill.location,
    ),
    dispatchedCode: applyDispatchPrefillValue(
      current.dispatchedCode,
      initial.dispatchedCode,
      prefill.dispatchedCode,
    ),
  };
}
