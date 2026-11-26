import {
  PRIMARY_RUN_FORMS,
  RUN_CHECKLIST_SECTIONS,
  RUN_SUPPLEMENT_CHECKLIST_SECTIONS,
  SUPPLEMENTAL_RUN_FORMS,
  requiredSupplementalForms,
  type PrimaryRunForm,
  type SupplementalRunForm,
  type TrainingRun,
} from './model.js';

export type RunChecklistSourceForm = PrimaryRunForm | SupplementalRunForm;
export type RunChecklistFailureSummary = { key:string; label:string; failureActions:readonly string[] };

type FailureActionSpec = {
  sourceLabel: string;
  actions: readonly string[];
};

const failureActionSpecs: Readonly<Record<string, FailureActionSpec>> = {
  'call_for_service:task-17': {
    sourceLabel: 'Obtained the proper documentation, identification, information',
    actions: ['Obtained the proper documentation', 'Obtained identification', 'Gathered relevant information'],
  },
  'call_for_service:task-22': {
    sourceLabel: 'Provided resource documentation/provided incident number for report',
    actions: ['Provided resource documentation', 'Provided the incident number for the report'],
  },
  'call_for_service:task-47': {
    sourceLabel: 'Properly clear with radio and MPS the correct disposition code',
    actions: ['Cleared with radio using the correct disposition code', 'Cleared MPS using the correct disposition code'],
  },
  'call_for_service:task-48': {
    sourceLabel: 'Deactivate CVS/BWC',
    actions: ['Deactivated CVS', 'Deactivated BWC'],
  },
  'call_for_service:task-49': {
    sourceLabel: 'Proper notifications to radio (transport, location, mileage)',
    actions: ['Notified radio of transport', 'Notified radio of location', 'Notified radio of mileage'],
  },
  'self_initiated:task-17': {
    sourceLabel: 'Obtained the proper documentation, identification, information',
    actions: ['Obtained the proper documentation', 'Obtained identification', 'Gathered relevant information'],
  },
  'self_initiated:task-27': {
    sourceLabel: 'Inventoried/impound vehicle',
    actions: ['Inventoried the vehicle', 'Impounded the vehicle'],
  },
  'self_initiated:task-49': {
    sourceLabel: 'Properly cleared with radio and MPS the appropriate disposition code',
    actions: ['Cleared with radio using the appropriate disposition code', 'Cleared MPS using the appropriate disposition code'],
  },
  'self_initiated:task-50': {
    sourceLabel: 'Properly notified radio (transport, location, mileage)',
    actions: ['Notified radio of transport', 'Notified radio of location', 'Notified radio of mileage'],
  },
  'domestic_incident:task-21': {
    sourceLabel: 'Conducted appropriate LEADS/Records checks/Prior DV convictions',
    actions: ['Conducted the appropriate LEADS/Records checks', 'Checked prior domestic-violence convictions'],
  },
  'domestic_incident:task-50': {
    sourceLabel: 'Deactivate/Reactivate BWC for Lethality Assessment',
    actions: ['Deactivated BWC for the Lethality Assessment', 'Reactivated BWC after the Lethality Assessment'],
  },
  'domestic_incident:task-60': {
    sourceLabel: 'Properly cleared with radio and MPS the appropriate disposition code',
    actions: ['Cleared with radio using the appropriate disposition code', 'Cleared MPS using the appropriate disposition code'],
  },
  'domestic_incident:task-61': {
    sourceLabel: 'Properly notified radio (transport, location, mileage)',
    actions: ['Notified radio of transport', 'Notified radio of location', 'Notified radio of mileage'],
  },
  'traffic_crash:task-15': {
    sourceLabel: 'Obtained information/statements of involved parties and witnesses',
    actions: ['Obtained information from involved parties', 'Obtained statements from involved parties', 'Obtained information from witnesses', 'Obtained statements from witnesses'],
  },
  'traffic_crash:task-37': {
    sourceLabel: 'Completed report(s)/form(s) (impound, parking cite, traffic cite, U-10.100) in reasonable amount of time',
    actions: ['Completed the applicable report(s) or form(s)', 'Completed the report(s) or form(s) in a reasonable amount of time'],
  },
  'traffic_crash:task-49': {
    sourceLabel: 'Properly made radio notifications (transport, location, mileage)',
    actions: ['Notified radio of transport', 'Notified radio of location', 'Notified radio of mileage'],
  },
  'traffic_crash:task-50': {
    sourceLabel: 'Properly cleared with radio and MPS the appropriate disposition code',
    actions: ['Cleared with radio using the appropriate disposition code', 'Cleared MPS using the appropriate disposition code'],
  },
  'traffic_stop:task-6': {
    sourceLabel: 'Marked with call number and location',
    actions: ['Marked the call number', 'Marked the location'],
  },
  'traffic_stop:task-7': {
    sourceLabel: 'Marked with nature of stop, vehicle tag/other info',
    actions: ['Marked the nature of the stop', 'Marked the vehicle tag and other information'],
  },
  'traffic_stop:task-8': {
    sourceLabel: 'Cruiser positioned 1 to 1.5 car lengths away with 3’ offset (L or R)',
    actions: ['Positioned the cruiser 1 to 1.5 car lengths away', 'Used the 3-foot left or right offset'],
  },
  'traffic_stop:task-31': {
    sourceLabel: 'Walk back to the cruiser; watched the violator, watched for traffic',
    actions: ['Walked back to the cruiser', 'Watched the violator', 'Watched for traffic'],
  },
  'traffic_stop:task-32': {
    sourceLabel: 'Properly used LEADS and does a proper records check while keeping a visual on driver',
    actions: ['Used LEADS properly', 'Completed the appropriate records check', 'Kept a visual on the driver'],
  },
  'traffic_stop:task-52': {
    sourceLabel: 'Explained, issued, provided copy of citation/ summons',
    actions: ['Explained the citation or summons', 'Issued the citation or summons', 'Provided a copy'],
  },
  'traffic_stop:task-55': {
    sourceLabel: 'Properly cleared with radio and MPS the appropriate disposition code',
    actions: ['Cleared with radio using the appropriate disposition code', 'Cleared MPS using the appropriate disposition code'],
  },
  'high_risk_stop:task-19': {
    sourceLabel: 'Cruiser Positioning 20-30 ft. away/ 3’ offset (L or R)',
    actions: ['Positioned the cruiser 20–30 feet away', 'Used the 3-foot left or right offset'],
  },
  'high_risk_stop:task-32': {
    sourceLabel: 'Ordered driver to remove keys from ignition and place on top of vehicle',
    actions: ['Ordered the driver to remove the keys from the ignition', 'Ordered the driver to place the keys on top of the vehicle'],
  },
  'high_risk_stop:task-33': {
    sourceLabel: 'Removed driver first then passengers one at a time',
    actions: ['Removed the driver first', 'Removed passengers one at a time'],
  },
  'high_risk_stop:task-56': {
    sourceLabel: 'Properly clear with radio and MPS',
    actions: ['Cleared with radio', 'Cleared MPS'],
  },
  'high_risk_stop:task-57': {
    sourceLabel: 'Proper notifications to radio (transport, location, mileage)',
    actions: ['Notified radio of transport', 'Notified radio of location', 'Notified radio of mileage'],
  },
  'high_risk_stop:task-58': {
    sourceLabel: 'Classify CVS/BWC',
    actions: ['Classified CVS', 'Classified BWC'],
  },
  'building_search:task-17': {
    sourceLabel: 'Requested helicopter, canine, additional officers',
    actions: ['Requested a helicopter', 'Requested a canine unit', 'Requested additional officers'],
  },
  'building_search:task-18': {
    sourceLabel: 'Knocked and announced (each level)',
    actions: ['Knocked', 'Announced', 'Completed the knock-and-announce at each applicable level'],
  },
  'building_search:task-27': {
    sourceLabel: 'Completed a thorough slow systematic search (interior/exterior)',
    actions: ['Completed the applicable interior search', 'Completed the applicable exterior search', 'Used a thorough, slow, systematic search'],
  },
  'building_search:task-61': {
    sourceLabel: 'Proper form(s) completed (premier one/addition, FI, false alarm, business/residence check)',
    actions: ['Completed the applicable Premier One report or addition', 'Completed the applicable FI', 'Completed the applicable false-alarm form', 'Completed the applicable business/residence check'],
  },
  'building_search:task-63': {
    sourceLabel: 'Properly cleared with radio and MPS the appropriate disposition code',
    actions: ['Cleared with radio using the appropriate disposition code', 'Cleared MPS using the appropriate disposition code'],
  },
  'building_search:task-67': {
    sourceLabel: 'CAD Documentation (entry, exit, secure)',
    actions: ['Documented entry in CAD', 'Documented exit in CAD', 'Documented that the building was secured in CAD'],
  },
  'arrest_process:supp-arrest_process-0': {
    sourceLabel: 'Gapped/Double locked handcuffs',
    actions: ['Gapped the handcuffs', 'Double-locked the handcuffs'],
  },
  'arrest_process:supp-arrest_process-3': {
    sourceLabel: 'Retrieved/secured property and evidence',
    actions: ['Retrieved property', 'Secured property', 'Retrieved evidence', 'Secured evidence'],
  },
  'arrest_process:supp-arrest_process-10': {
    sourceLabel: 'Prior to slating, contacted supervisor for review of all arrest paperwork',
    actions: ['Contacted the supervisor before slating', 'Obtained supervisor review of the arrest paperwork'],
  },
  'arrest_process:supp-arrest_process-14': {
    sourceLabel: 'Read rights/conducted interview',
    actions: ['Read the rights', 'Conducted the interview'],
  },
  'arrest_process:supp-arrest_process-19': {
    sourceLabel: 'Advised radio of arrival and provided mileage if prisoner is of opposite sex/juvenile',
    actions: ['Advised radio of arrival', 'Provided the required mileage to radio'],
  },
  'arrest_process:supp-arrest_process-29': {
    sourceLabel: 'Entered ID room & secured leg shackle prior to removing & securing handcuffs',
    actions: ['Entered the ID room', 'Secured the leg shackle before removing handcuffs', 'Secured the handcuffs after removing the leg shackle'],
  },
  'arrest_process:supp-arrest_process-30': {
    sourceLabel: 'After processed, reapplied handcuffs and removed leg shackle',
    actions: ['Reapplied handcuffs after processing', 'Removed the leg shackle after processing'],
  },
  'arrest_process:supp-arrest_process-31': {
    sourceLabel: 'Retrieved weapons/Taser',
    actions: ['Retrieved the weapons', 'Retrieved the Taser'],
  },
  'arrest_process:supp-arrest_process-37': {
    sourceLabel: 'Obtained & executed arrest warrants',
    actions: ['Obtained the arrest warrants', 'Executed the arrest warrants'],
  },
  'arrest_process:supp-arrest_process-47': {
    sourceLabel: 'Secured weapons/Taser in lock box',
    actions: ['Secured the weapons in the lock box', 'Secured the Taser in the lock box'],
  },
  'arrest_process:supp-arrest_process-48': {
    sourceLabel: 'Provided slating with all paperwork, property & medical information',
    actions: ['Provided the paperwork for slating', 'Provided property information for slating', 'Provided medical information for slating'],
  },
  'arrest_process:supp-arrest_process-51': {
    sourceLabel: 'Contact Supervisor/Clerks',
    actions: ['Contacted the supervisor', 'Contacted the Clerks'],
  },
  'arrest_process:supp-arrest_process-52': {
    sourceLabel: 'Transfer to another Jurisdiction (Completed Case Report)',
    actions: ['Transferred the case to another jurisdiction', 'Completed the case report'],
  },
  'arrest_process:supp-arrest_process-59': {
    sourceLabel: 'Submitted property/evidence',
    actions: ['Submitted property', 'Submitted evidence'],
  },
  'ovi_process:supp-ovi_process-2': {
    sourceLabel: 'Observed and interviewed the driver',
    actions: ['Observed the driver', 'Interviewed the driver'],
  },
  'ovi_process:supp-ovi_process-14': {
    sourceLabel: 'Gapped/Double locked handcuffs',
    actions: ['Gapped the handcuffs', 'Double-locked the handcuffs'],
  },
  'ovi_process:supp-ovi_process-17': {
    sourceLabel: 'Retrieved/secured property and evidence',
    actions: ['Retrieved property', 'Secured property', 'Retrieved evidence', 'Secured evidence'],
  },
  'ovi_process:supp-ovi_process-36': {
    sourceLabel: 'Obtained white and pink copies of the BAC test report for packet and violator',
    actions: ['Obtained the white BAC report copy for the packet', 'Obtained the pink BAC report copy for the packet', 'Obtained the white BAC report copy for the violator', 'Obtained the pink BAC report copy for the violator'],
  },
  'ovi_process:supp-ovi_process-38': {
    sourceLabel: 'Completed traffic citations/complaints',
    actions: ['Completed the traffic citations', 'Completed the complaints'],
  },
};

function specKey(form: RunChecklistSourceForm, itemKey: string): string {
  return `${form}:${itemKey}`;
}

export function runFailureActionChoices(
  form: RunChecklistSourceForm,
  itemKey: string,
  sourceLabel: string,
): readonly string[] | undefined {
  const spec = failureActionSpecs[specKey(form, itemKey)];
  if (!spec) return undefined;
  if (spec.sourceLabel !== sourceLabel) {
    throw new Error(`Failure action choices no longer match ${form}:${itemKey}.`);
  }
  return spec.actions;
}

export function validateRunFailureActionSpecs(): void {
  const knownSources = new Map<string, string>();
  for (const form of PRIMARY_RUN_FORMS) {
    let index = 0;
    for (const section of RUN_CHECKLIST_SECTIONS[form.key]) {
      for (const item of section.items) knownSources.set(specKey(form.key, `task-${index++}`), item.label);
    }
  }
  for (const form of SUPPLEMENTAL_RUN_FORMS) {
    let index = 0;
    for (const section of RUN_SUPPLEMENT_CHECKLIST_SECTIONS[form.key]) {
      for (const item of section.items) knownSources.set(specKey(form.key, `supp-${form.key}-${index++}`), item.label);
    }
  }
  for (const [key, spec] of Object.entries(failureActionSpecs)) {
    if (knownSources.get(key) !== spec.sourceLabel) {
      throw new Error(`Failure action choices do not match the submitted checklist item ${key}.`);
    }
    if (spec.actions.length < 2 || new Set(spec.actions).size !== spec.actions.length || spec.actions.some(action => !action.trim())) {
      throw new Error(`Failure action choices must be distinct, non-empty actions: ${key}.`);
    }
  }
}

export function isRunFailureActionSelectionValid(
  form: RunChecklistSourceForm,
  itemKey: string,
  sourceLabel: string,
  selected: readonly string[],
): boolean {
  const choices = runFailureActionChoices(form, itemKey, sourceLabel);
  return !!choices?.length
    && selected.length > 0
    && new Set(selected).size === selected.length
    && selected.every(action => choices.includes(action));
}

export function runChecklistFailureSummaries(run:TrainingRun):RunChecklistFailureSummary[] {
  const summaries:RunChecklistFailureSummary[]=[];
  if(!run.checklist['na-task']){
    let index=0;
    for(const section of RUN_CHECKLIST_SECTIONS[run.runKind]){
      for(const item of section.items){
        const key=`task-${index++}`;
        if(run.checklist[key]===false&&run.checklistNotApplicable?.[key]!==true)summaries.push({key,label:item.label,failureActions:run.checklistFailures?.[key]??[]});
      }
    }
  }
  for(const form of requiredSupplementalForms(run).filter(item=>item!=='narrative_addition')){
    if(run.checklist[`na-supp-${form}`])continue;
    let index=0;
    for(const section of RUN_SUPPLEMENT_CHECKLIST_SECTIONS[form]){
      for(const item of section.items){
        const key=`supp-${form}-${index++}`;
        if(run.checklist[key]===false&&run.checklistNotApplicable?.[key]!==true)summaries.push({key,label:item.label,failureActions:run.checklistFailures?.[key]??[]});
      }
    }
  }
  return summaries;
}
