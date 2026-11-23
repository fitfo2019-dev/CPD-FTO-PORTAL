import {fetchPatrolViewJson,mapPatrolViewEvent,PatrolViewIntegrationError,type PatrolViewConfig,type DispatchEventPrefill} from './patrolViewIntegration.js';

const RUN_TYPES=['call_for_service','self_initiated','domestic_incident','traffic_crash','traffic_stop','high_risk_stop','building_search'] as const;
export type DispatchIncidentPrefill=DispatchEventPrefill & {
  incidentNumber:string;
  unitNumber?:string;
  dispatchedAt?:string;
  clearedAt?:string;
  runKind?:typeof RUN_TYPES[number];
};
function object(value:unknown):Record<string,unknown>|undefined {
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
}
function invalid():never {
  throw new PatrolViewIntegrationError('PATROLVIEW_INVALID_RESPONSE',502,'The approved incident adapter returned invalid data.');
}
function optionalUnit(source:Record<string,unknown>):string|undefined {
  const value=source.unitNumber??source.unit_number;
  if(value==null)return;
  if(typeof value!=='string'||!/^[A-Za-z0-9 ._:/-]{1,40}$/.test(value.trim()))return invalid();
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
    const common=mapPatrolViewEvent(single);
    rows=single.units.map(unit=>{
      const detail=object(unit);
      if(!detail)return invalid();
      const unitDispatchedAt=optionalTime(detail,'dispatchedAt','dispatched_at');
      const unitClearedAt=optionalTime(detail,'clearedAt','cleared_at');
      return {
        ...common,
        ...(incidentDispatchedAt?{dispatchedAt:incidentDispatchedAt}:{}),
        ...(incidentClearedAt?{clearedAt:incidentClearedAt}:{}),
        ...detail,
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
    const dispatchedAt=optionalTime(source,'dispatchedAt','dispatched_at');
    const clearedAt=optionalTime(source,'clearedAt','cleared_at');
    if(dispatchedAt&&clearedAt&&Date.parse(clearedAt)<Date.parse(dispatchedAt))return invalid();
    const suppliedKind=source.runKind??source.run_kind;
    // A dispatch code is not an approved classification. Unknown kinds stay ambiguous.
    const runKind=typeof suppliedKind==='string'&&RUN_TYPES.includes(suppliedKind as typeof RUN_TYPES[number])
      ?suppliedKind as typeof RUN_TYPES[number]:undefined;
    // Whitelist only the approved run metrics. Never pass caller, officer, phone,
    // narrative, notes, or any other upstream payload fields to the browser.
    return {...common,incidentNumber:common.incidentNumber,...(unitNumber?{unitNumber}:{}),
      ...(unitNumber&&dispatchedAt?{dispatchedAt}:{}),...(unitNumber&&clearedAt?{clearedAt}:{}),...(runKind?{runKind}:{})};
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
  // Do not disclose other units' rows to the caller. Each FTO/PO looks up the
  // shared incident independently and receives only its assigned-unit record.
  return records.filter(record=>record.unitNumber&&normalize(record.unitNumber)===normalize(unitNumber));
}
