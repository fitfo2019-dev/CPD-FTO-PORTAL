import {fetchPatrolViewJson,mapPatrolViewEvent,PatrolViewIntegrationError,type PatrolViewConfig,type DispatchEventPrefill} from './patrolViewIntegration.js';
import { operationalIdentityFromCad } from '@workspace/api-zod/operational-profile';

export type DispatchIncidentPrefill=DispatchEventPrefill & {
  incidentNumber:string;
  unitNumber?:string;
  dispatchedAt?:string;
  clearedAt?:string;
};
function object(value:unknown):Record<string,unknown>|undefined {
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
}
function invalid():never {
  throw new PatrolViewIntegrationError('PATROLVIEW_INVALID_RESPONSE',502,'The approved incident adapter returned invalid data.');
}
function optionalUnit(source:Record<string,unknown>):string|undefined {
  const aliases=[source.unitNumber,source.unit_number,source.cadUnit].filter(value=>value!=null);
  const value=aliases[0];
  if(value==null)return;
  if(typeof value!=='string'||!/^[A-Za-z0-9 ._:/-]{1,40}$/.test(value.trim()))return invalid();
  if(aliases.some(alias=>typeof alias!=='string'||alias.trim().toUpperCase()!==value.trim().toUpperCase()))return invalid();
  return value.trim();
}
function optionalTime(source:Record<string,unknown>,camel:string,snake:string):string|undefined {
  const value=source[camel]??source[snake];
  if(value==null)return;
  if(typeof value!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)||!Number.isFinite(Date.parse(value)))return invalid();
  return new Date(value).toISOString();
}
function incidentTime(source:Record<string,unknown>,keys:string[]):string|undefined {
  const value=keys.map(key=>source[key]).find(item=>item!==undefined&&item!==null);
  if(value===undefined)return;
  if(typeof value!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)||!Number.isFinite(Date.parse(value)))return invalid();
  return new Date(value).toISOString();
}
const CLEARED_NOTE=/^\s*(?:\d{3,4}\s*:\s*)?([A-Z0-9]{2,10})[a-z-]*\s*-+\s*CLEARED\s+([1-4]V)\b/i;
const unitBase=(unit:string)=>unit.trim().replace(/[-a-z]+$/,'').toUpperCase();
/**
 * Dispatch writes each unit's clearance into the call notes ("154B - CLEARED 2V").
 * Returns the unit's last clearance from those notes. The notes themselves never leave the server.
 */
export function clearanceFromNotes(source:Record<string,unknown>|undefined,unit:string|undefined):''|'1V'|'2V'|'3V'|'4V' {
  if(!source||!unit)return '';
  const notes=[source.notes,source.remarks,source.comments].find(Array.isArray) as unknown[]|undefined;
  let found:''|'1V'|'2V'|'3V'|'4V'='';
  for(const note of notes??[]){
    const text=typeof note==='string'?note:typeof object(note)?.text==='string'?String(object(note)?.text):'';
    const match=CLEARED_NOTE.exec(text);
    if(match&&match[1].toUpperCase()===unitBase(unit))found=match[2].toUpperCase() as typeof found;
  }
  return found;
}
function situationFoundOf(source:Record<string,unknown>):string|undefined {
  const raw=['situationFoundCode','situation_found_code','situationFound','situation_found'].map(key=>source[key]).find(value=>value!==undefined&&value!==null&&value!=='');
  if(raw===undefined)return;
  if(typeof raw!=='string')return invalid();
  const code=raw.trim().replace(/^10[\s-]*/i,'').toUpperCase();
  return /^\d{1,3}[A-Z]{0,2}$/.test(code)?code:invalid();
}
/** Canonical approved adapter rows; unit times are never taken from another unit. */
export function mapPatrolViewIncident(payload:unknown,incidentNumber:string):DispatchIncidentPrefill[] {
  const root=object(payload);
  if(root?.status!==undefined&&root.status!=='success')return invalid();
  const candidate=root?.data??root?.incident??payload;
  const single=object(candidate);
  const incidentDispatchedAt=single?incidentTime(single,['dispatchedAt','dispatched_at','dispatchTime','dispatch_time']):undefined;
  const incidentClearedAt=single?incidentTime(single,['clearedAt','cleared_at','clearTime','clear_time']):undefined;
  if(incidentDispatchedAt&&incidentClearedAt&&Date.parse(incidentClearedAt)<Date.parse(incidentDispatchedAt))return invalid();
  let rows:unknown[];
  if(single&&Array.isArray(single.units)){
    // Clearance belongs to each car. A run-level clearance is used only when one car is on the run;
    // with several cars it is never copied onto every unit.
    // Situation found is logged once for the whole run by one officer, who may not be the FTO's cruiser,
    // so it applies to every car. Two different logged codes are left blank for the FTO to enter.
    const event=mapPatrolViewEvent(single);
    const {clearanceCode:runClearance,situationFoundCode:_eventSituation,...shared}=event;
    const common=single.units.length===1?event:shared;
    void runClearance; void _eventSituation;
    const logged=[event.situationFoundCode,...single.units.map(unit=>{
      const detail=object(unit);
      return detail?situationFoundOf(detail):undefined;
    })].filter((value):value is string=>!!value);
    const runSituationFound=new Set(logged).size===1?logged[0]:undefined;
    rows=single.units.map(unit=>{
      const detail=object(unit);
      if(!detail)return invalid();
      const unitDispatchedAt=optionalTime(detail,'dispatchedAt','dispatched_at');
      const unitClearedAt=optionalTime(detail,'clearedAt','cleared_at');
      const unitNumber=optionalUnit(detail);
      const hasCadClearance=['clearanceCode','clearance_code'].some(key=>detail[key]!==undefined&&detail[key]!==null&&detail[key]!=='');
      const noteClearance=hasCadClearance?'':clearanceFromNotes(single,unitNumber);
      return {
        ...common,
        ...(incidentDispatchedAt?{dispatchedAt:incidentDispatchedAt}:{}),
        ...(incidentClearedAt?{clearedAt:incidentClearedAt}:{}),
        ...detail,
        ...(noteClearance?{clearanceCode:noteClearance}:{}),
        // Every alias is replaced by the one run-wide value so no car keeps a conflicting code.
        situationFoundCode:undefined,situation_found_code:undefined,situationFound:undefined,situation_found:undefined,
        ...(runSituationFound?{situationFoundCode:runSituationFound}:{}),
        ...(unitDispatchedAt?{dispatchedAt:unitDispatchedAt}:{}),
        ...(unitClearedAt?{clearedAt:unitClearedAt}:{}),
      };
    });
  }else rows=Array.isArray(candidate)?candidate:single?[{
    ...single,...(incidentDispatchedAt?{dispatchedAt:incidentDispatchedAt}:{}),...(incidentClearedAt?{clearedAt:incidentClearedAt}:{}),
  }]:invalid();
  if(rows.length>100)return invalid();
  return rows.map(row=>{
    const source=object(row);
    if(!source)return invalid();
    const common=mapPatrolViewEvent(source);
    if(!common.incidentNumber||common.incidentNumber.trim().toUpperCase()!==incidentNumber.trim().toUpperCase())return invalid();
    const unitNumber=optionalUnit(source);
    const cadIdentity=operationalIdentityFromCad(source);
    const dispatchedAt=optionalTime(source,'dispatchedAt','dispatched_at');
    const clearedAt=optionalTime(source,'clearedAt','cleared_at');
    if(dispatchedAt&&clearedAt&&Date.parse(clearedAt)<Date.parse(dispatchedAt))return invalid();
    // Whitelist only the approved run metrics. Never pass caller, officer, phone,
    // narrative, notes, or any other upstream payload fields to the browser.
    return {...common,incidentNumber:common.incidentNumber,...(unitNumber?{unitNumber}:{}),...(cadIdentity?{cadIdentity}:{}),
      ...(unitNumber&&dispatchedAt?{dispatchedAt}:{}),...(unitNumber&&clearedAt?{clearedAt}:{})};
  });
}

export async function fetchPatrolViewIncident(
  incidentNumber:string,
  unitNumber:string,
  config:PatrolViewConfig=process.env,
  fetchImpl:Parameters<typeof fetchPatrolViewJson>[2]=fetch,
):Promise<DispatchIncidentPrefill[]> {
  if(!/^[A-Za-z0-9._:-]{1,120}$/.test(incidentNumber)||!/^[A-Za-z0-9 ._:/-]{1,40}$/.test(unitNumber.trim())) {
    throw new PatrolViewIntegrationError('PATROLVIEW_INVALID_RESPONSE',400,'The incident number and assigned unit are required.');
  }
  const template=config.PATROLVIEW_INCIDENT_LOOKUP_URL?.trim();
  const token=config.PATROLVIEW_API_TOKEN?.trim();
  if(!template||!token||(template.match(/\{incidentNumber\}/g)??[]).length!==1){
    throw new PatrolViewIntegrationError('PATROLVIEW_NOT_CONFIGURED',503,'The approved incident lookup is not configured.');
  }
  let endpoint:URL;
  try{endpoint=new URL(template.replace('{incidentNumber}',encodeURIComponent(incidentNumber)));}
  catch{throw new PatrolViewIntegrationError('PATROLVIEW_NOT_CONFIGURED',503,'The incident lookup endpoint is invalid.');}
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||
    !new URL(template.replace('{incidentNumber}','INCIDENT_IDENTIFIER')).pathname.includes('INCIDENT_IDENTIFIER')){
    throw new PatrolViewIntegrationError('PATROLVIEW_NOT_CONFIGURED',503,'The incident lookup requires an approved HTTPS path.');
  }
  const records=mapPatrolViewIncident(await fetchPatrolViewJson(endpoint,token,fetchImpl),incidentNumber);
  const normalize=(value:string)=>value.trim().toUpperCase().replace(/\s+/g,' ');
  // Shared incident fields are repeated into each matching unit's row. Keep
  // unit-specific times scoped to the assigned unit; never return officer data.
  return records.filter(record=>record.unitNumber&&normalize(record.unitNumber)===normalize(unitNumber));
}
