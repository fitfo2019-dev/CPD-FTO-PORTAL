import type { ActivityKey, PrimaryRunForm } from './model';

export interface DirectivePrompt {
  number: string;
  title: string;
  url: string;
  reminder: string;
}

const DIRECTIVES = {
  force: {
    number: '2.01',
    title: 'Use of Force',
    url: 'https://www.columbus.gov/files/sharedassets/city/v/3/public-safety/police/directives/divisiondirective2.01.pdf',
    reminder: 'If force was used or a weapon was displayed, review the applicable reporting and end-of-shift requirements.',
  },
  arrest: {
    number: '3.01',
    title: 'Arrests and Warrants',
    url: 'https://www.columbus.gov/files/sharedassets/city/v/5/public-safety/police/directives/divisiondirective3.01.pdf',
    reminder: 'Arrest/slating paperwork includes Form U-10.100 and supervisor review before slating.',
  },
  transport: {
    number: '3.03',
    title: 'Transport and Slating',
    url: 'https://www.columbus.gov/files/sharedassets/city/v/2/public-safety/police/directives/divisiondirective3.03.pdf',
    reminder: 'Review transport, transfer, and slating requirements that apply to this run.',
  },
  domestic: {
    number: '4.05',
    title: 'Domestic Violence',
    url: 'https://www.columbus.gov/files/sharedassets/city/v/3/public-safety/police/directives/divisiondirective4.05.pdf',
    reminder: 'Review the applicable domestic-violence enforcement and documentation requirements.',
  },
  crash: {
    number: '5.05',
    title: 'Traffic Crash Investigations',
    url: 'https://www.columbus.gov/files/sharedassets/city/v/2/public-safety/police/directives/divisiondirective5.05.pdf',
    reminder: 'Confirm whether the crash meets a condition requiring an Ohio Traffic Crash Report (OH-1).',
  },
  ovi: {
    number: '5.06',
    title: 'OVI Violators',
    url: 'https://www.columbus.gov/files/sharedassets/city/v/2/public-safety/police/directives/divisiondirective5.06.pdf',
    reminder: 'Review the OVI-specific investigation and paperwork requirements that apply.',
  },
  traffic: {
    number: '5.07',
    title: 'Enforcement of Traffic and Parking Violations',
    url: 'https://www.columbus.gov/files/sharedassets/city/v/6/public-safety/police/directives/divisiondirective5.07.pdf',
    reminder: 'Review the applicable traffic-enforcement, stop, and disposition requirements.',
  },
  stoppingTactics: {
    number: '5.03',
    title: 'Stopping Tactics',
    url: 'https://www.columbus.gov/files/sharedassets/city/v/3/public-safety/police/directives/divisiondirective5.03.pdf',
    reminder: 'If a stopping tactic was used or attempted, Directive 5.03 requires the applicable Stopping Tactic Report (U-10.194).',
  },
  impound: {
    number: '6.01',
    title: 'Impounding and Towing',
    url: 'https://www.columbus.gov/files/sharedassets/city/v/2/public-safety/police/directives/divisiondirective6.01.pdf',
    reminder: 'Review towing, impound, and required vehicle documentation.',
  },
  property: {
    number: '6.02',
    title: 'Property and Evidence Handling',
    url: 'https://www.columbus.gov/files/sharedassets/city/v/2/public-safety/police/directives/divisiondirective6.02.pdf',
    reminder: 'Review applicable property, evidence, and transfer documentation.',
  },
  video: {
    number: '11.07',
    title: 'Body-Worn Camera and Cruiser Video System',
    url: 'https://www.columbus.gov/files/sharedassets/city/v/4/public-safety/police/directives/divisiondirective11.07.pdf',
    reminder: 'Confirm applicable BWC/CVS activation, documentation, and retention steps.',
  },
} satisfies Record<string, DirectivePrompt>;

export function getRunDirectivePrompts(input: {
  runKind: PrimaryRunForm;
  arrestMade: boolean;
  transportedAfterArrest: boolean;
  oviProcessed: boolean;
  activityFlags?: Partial<Record<ActivityKey, boolean>>;
}): DirectivePrompt[] {
  const prompts: DirectivePrompt[] = [DIRECTIVES.video,DIRECTIVES.force];
  if (input.runKind === 'domestic_incident') prompts.push(DIRECTIVES.domestic);
  if (input.runKind === 'traffic_stop' || input.runKind === 'high_risk_stop') prompts.push(DIRECTIVES.traffic,DIRECTIVES.stoppingTactics);
  if (input.runKind === 'traffic_crash') prompts.push(DIRECTIVES.crash);
  if (input.arrestMade) prompts.push(DIRECTIVES.arrest);
  if (input.arrestMade && input.transportedAfterArrest) prompts.push(DIRECTIVES.transport);
  if (input.oviProcessed) prompts.push(DIRECTIVES.ovi);
  if (input.activityFlags?.impoundSlips) prompts.push(DIRECTIVES.impound);
  if (input.activityFlags?.propertySlips) prompts.push(DIRECTIVES.property);
  return prompts;
}
