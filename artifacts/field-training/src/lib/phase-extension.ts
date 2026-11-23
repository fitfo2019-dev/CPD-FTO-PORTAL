import { z } from 'zod';
import type { PhaseCaseFolder, PhaseExtensionRequest, PhaseWeekRange, Workspace } from './model.js';
import { createPhaseWeekRanges, getPhaseScheduleInfo } from './training-calendar.js';

export const phaseExtensionRequestInputSchema=z.object({
  extensionType:z.enum(['training_weeks','limbo_period']),
  requestedWeeks:z.number().int().min(1),
  justification:z.string().trim().min(1),
});

const addDays=(isoDate:string,days:number)=>new Date(Date.parse(`${isoDate}T12:00:00Z`)+days*24*60*60*1000).toISOString().slice(0,10);

function matchesRequest(request:PhaseExtensionRequest,folder:PhaseCaseFolder) {
  return request.recruitBadge.toLowerCase()===folder.recruitBadge.toLowerCase()
    &&request.phase===folder.phase
    &&request.className.toLowerCase()===(folder.className??'').toLowerCase();
}

export function approvePhaseExtension(workspace:Workspace,requestId:string):Workspace {
  const request=workspace.phaseExtensionRequests.find(item=>item.id===requestId);
  if(!request)return workspace;
  const target=workspace.phaseFolders.find(folder=>matchesRequest(request,folder))
    ??(workspace.caseFolder&&matchesRequest(request,workspace.caseFolder)?workspace.caseFolder:undefined);
  if(!target)return workspace;

  const ranges:PhaseWeekRange[]=[...(target.phaseWeekRanges?.length?target.phaseWeekRanges:createPhaseWeekRanges(target.phase,target.phaseStartDate))];
  let limboExtensionWeeks=target.limboExtensionWeeks??0;
  if(request.extensionType==='training_weeks') {
    const lastEnd=ranges.at(-1)?.endDate;
    if(!lastEnd)return workspace;
    for(let week=0;week<request.requestedWeeks;week++) {
      const start=addDays(lastEnd,1+(week*7));
      ranges.push({startDate:start,endDate:addDays(start,6)});
    }
  } else {
    const offset=request.requestedWeeks*7;
    for(let index=0;index<ranges.length;index++) {
      const range=ranges[index];
      ranges[index]=index===0
        ?{...range,endDate:addDays(range.endDate,offset)}
        :{startDate:addDays(range.startDate,offset),endDate:addDays(range.endDate,offset)};
    }
    limboExtensionWeeks+=request.requestedWeeks;
  }
  const updatedFolder={...target,phaseWeekRanges:ranges,limboExtensionWeeks};
  const phaseFolders=workspace.phaseFolders.map(folder=>
    folder===target||matchesRequest(request,folder)?updatedFolder:folder,
  );
  const caseFolder=workspace.caseFolder&&matchesRequest(request,workspace.caseFolder)?updatedFolder:workspace.caseFolder;
  const reports=workspace.reports.map(report=>{
    if(report.phase!==target.phase||report.recruitBadge.toLowerCase()!==target.recruitBadge.toLowerCase()
      ||(report.className??'').toLowerCase()!==(target.className??'').toLowerCase()||report.phaseWeek!==undefined)return report;
    const schedule=getPhaseScheduleInfo(report.phase,report.date,updatedFolder.phaseStartDate,updatedFolder.daysOff,ranges,limboExtensionWeeks);
    return schedule.phaseWeek===undefined?report:{...report,phaseWeek:schedule.phaseWeek,limboDay:schedule.limboDay};
  });
  return {
    ...workspace,phaseFolders,caseFolder,reports,
    phaseExtensionRequests:workspace.phaseExtensionRequests.filter(item=>item.id!==requestId),
  };
}

export function denyPhaseExtension(workspace:Workspace,requestId:string):Workspace {
  if(!workspace.phaseExtensionRequests.some(item=>item.id===requestId))return workspace;
  return {
    ...workspace,
    phaseExtensionRequests:workspace.phaseExtensionRequests.filter(item=>item.id!==requestId),
  };
}
