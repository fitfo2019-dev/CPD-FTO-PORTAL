import { isValidAssignment } from './cpd-geography.js';
import { SUBMITTED_PRIMARY_CHECKLISTS, SUBMITTED_SUPPLEMENTAL_CHECKLISTS } from './manual-form-checklists.js';
import {
  PHASE_TIMELINE_REGISTRY,
  PHASE_LENGTH_WEEKS,
  PHASE_LIMBO_FULL_WEEKS,
  PHASE_LIMBO_WORKDAYS,
  PHASE_PROGRAM_WEEK_START,
  TOTAL_TRAINING_WEEKS,
  type PhaseId,
} from '../../../../src/config/phaseConfiguration.js';

export {
  PHASE_TIMELINE_REGISTRY,
  PHASE_LENGTH_WEEKS,
  PHASE_LIMBO_FULL_WEEKS,
  PHASE_LIMBO_WORKDAYS,
  PHASE_PROGRAM_WEEK_START,
  TOTAL_TRAINING_WEEKS,
};

export const SEG_CATEGORIES = [
  { key:'dutyReadiness', label:'Report/Prepared for Duty', group:'Duty Readiness', definition:'Arrive on time in a neat, clean uniform; be groomed, equipped, and fit to assume duties. Participate in roll call, review Division material, and inspect the cruiser and equipment under Patrol SOP.', manualReference:'SEGs 1–2 · Appearance/Equipment; Roll Call/Cruiser Inspection' },
  { key:'communicationsUsage', label:'Comprehension/Usage', group:'Communications/Computer', definition:'Understand and clearly use cruiser and portable radios, acknowledge calls, communicate necessary information, and operate assigned radio channels, computer, and MPS functions.', manualReference:'SEGs 3–4 · Comprehension; Usage Skills' },
  { key:'publicPoliceInteraction', label:'Public/Police Interaction', group:'Interpersonal Skills', definition:'Communicate professionally and respectfully with the public, peers, supervisors, and civilian employees; establish rapport, ask relevant questions, and follow proper protocol.', manualReference:'SEGs 5–6 · Public Interaction; Police Interaction' },
  { key:'feedbackAcceptance', label:'Feedback Acceptance', group:'Interpersonal Skills', definition:'Accept and apply feedback or constructive criticism from the FTO or supervisor to improve performance; do not rationalize mistakes or blame others.', manualReference:'SEG 7 · Feedback Acceptance' },
  { key:'precinctOrientation', label:'Precinct Orientation', group:'Geographic Skills', definition:'Know precinct boundaries, major roads and landmarks; stay aware of location, use the City address numbering system, and locate destinations using maps and direct routes.', manualReference:'SEGs 8–9 · Precinct Orientation; Response Time/Map Skills' },
  { key:'routineDriving', label:'Routine', group:'Driving Skills', definition:'Operate the police vehicle safely, lawfully, and courteously during routine conditions while carrying out related duties such as radio, computer, and traffic observation.', manualReference:'SEG 10 · Routine' },
  { key:'emergencyPursuit', label:'EVO', group:'Driving Skills', definition:'Drive safely with due regard during emergency responses and pursuits; use lights and siren correctly, monitor radio and surroundings, and follow policy.', manualReference:'SEG 11 · Emergency/Pursuit' },
  { key:'policiesProcedures', label:'Policies/Procedures', group:'Knowledge', definition:'Know and apply Division rules, directives, policies, procedures, and Patrol SOP to police duties, reports, and forms.', manualReference:'SEG 12 · Policies/Procedures' },
  { key:'criminalTrafficCodes', label:'Criminal / Traffic Offenses', group:'Knowledge', definition:'Know and apply the Ohio Revised Code, Columbus City Code, and State and City traffic codes; locate and select the proper enforcement code.', manualReference:'SEG 13 · Criminal/Traffic Codes' },
  { key:'arrestSearchSeizure', label:'Arrest, Search, Seizure', group:'Knowledge', definition:'Understand the Arrest, Search & Seizure manual and legal updates, and apply that knowledge to patrol situations.', manualReference:'SEG 14 · Arrest, Search, Seizure' },
  { key:'informationGathering', label:'Information Gathering', group:'Knowledge', definition:'Gather, verify, and organize relevant facts through interviews, observations, records checks, and investigation so the PO can choose an appropriate response and document it accurately.', manualReference:'Related manual guidance: Public Interaction, Arrest/Search/Seizure, Content Accuracy, Criminal Violations, Traffic Enforcement, and Suspicious Activity. The 2025 manual does not list this as a separate named SEG.' },
  { key:'resourceEquipmentUsage', label:'Resource/Equipment Usage', group:'Knowledge', definition:'Use manuals, databases, units, and bureaus to complete patrol tasks; properly use and maintain Division-issued and personally assigned equipment.', manualReference:'SEGs 15–16 · Resource Usage; Proper Usage of Equipment' },
  { key:'formUsage', label:'Form Usage', group:'Official Report', definition:'Select and use the departmental forms needed to accomplish the task.', manualReference:'SEG 17 · Form Usage' },
  { key:'grammarLegibility', label:'Grammar/Legibility', group:'Official Report', definition:'Use correct spelling, grammar, and punctuation; complete forms neatly in legible, easy-to-read block printing.', manualReference:'SEG 18 · Grammar/Legibility' },
  { key:'contentAccuracy', label:'Content Accuracy', group:'Official Report', definition:'Complete reports that accurately reflect the incident in a detailed, thorough, and organized manner.', manualReference:'SEG 19 · Content Accuracy' },
  { key:'completionTime', label:'Completion Time', group:'Official Report', definition:'Complete reports in a reasonable time for the incident’s complexity, accounting for legitimate delays such as scene processing, transports, or waiting for other units.', manualReference:'SEG 20 · Completion Time' },
  { key:'responseToEnforcement', label:'Response to Enforcement', group:'Engagement', definition:'Recognize criminal violations, traffic violations, and suspicious activity during patrol and take the appropriate enforcement action.', manualReference:'SEGs 21–23 · Criminal Violations; Traffic Enforcement; Suspicious Activity' },
  { key:'threatAssessment', label:'Threat Assessment', group:'Officer Safety', definition:'Use trained officer-safety techniques when initiating contacts and recognize and respond appropriately to known threats at locations or involving people.', manualReference:'SEGs 24–25 · Unknown Threat Contacts; Known Threat Contacts' },
  { key:'initiatingArrests', label:'Initiating Arrests', group:'Officer Safety', definition:'Maintain officer safety and control while initiating arrests; handcuff before searching, safely escort the prisoner, and secure the prisoner in the cruiser.', manualReference:'SEG 26 · Initiating Arrests; related Use of Force guidance in SEG 31' },
  { key:'handlingPrisoners', label:'Handling Prisoners', group:'Officer Safety', definition:'Safely control and transport prisoners, monitor movement, search when custody is transferred, seatbelt before transport, check the cruiser afterward, and prevent escape.', manualReference:'SEG 27 · Handling Prisoners' },
  { key:'vehicleStops', label:'Vehicle Stops', group:'Officer Safety', definition:'Conduct vehicle and high-risk stops using trained safety standards: air stop information, position the cruiser, approach systematically, control occupant movement, and give clear instructions.', manualReference:'SEG 28 · Vehicle Stops' },
  { key:'runApproach', label:'Run Approach', group:'Officer Safety', definition:'Approach a location or structure using trained officer-safety techniques, appropriate positioning and cover, communication, and awareness of potential threats.', manualReference:'Related criteria in SEG 29 · Approach/Inside Structures' },
  { key:'buildingSearch', label:'Building Search', group:'Officer Safety', definition:'Apply trained building-search tactics, enter and clear methodically, use equipment safely, communicate, and maintain awareness of potential threats.', manualReference:'Related criteria in SEG 29 · Approach/Inside Structures' },
  { key:'patDownSearches', label:'Pat Down/Searches', group:'Officer Safety', definition:'Safely and thoroughly perform a systematic pat down or search, locate weapons, contraband, or property, and comply with Division policy.', manualReference:'SEG 30 · Pat Down/Searches' },
  { key:'lowStressSituations', label:'Low Stress Situations', group:'Judgment Decisions', definition:'Assess routine, low-stress incidents, choose a reasonable course of action, and handle, manage, or resolve calls and self-initiated runs.', manualReference:'SEG 32 · Low Stress Situation' },
  { key:'stressSituations', label:'High Stress Situations', group:'Judgment Decisions', definition:'Remain calm and decisive in moderate- and high-stress incidents; recognize, control, and resolve the situation and restore order.', manualReference:'SEG 33 · Stress Situations; related Verbal Conflict guidance in SEG 36' },
  { key:'arrestSituations', label:'Arrest Situations', group:'Judgment Decisions', definition:'Assess the facts, identify an arrest situation, and make a sound decision about whether to effect an arrest.', manualReference:'SEG 34 · Arrest Situations' },
  { key:'problemSolving', label:'Problem Solving', group:'Judgment Decisions', definition:'Perceive facts, form valid conclusions, exercise sound judgment, make proper decisions, and refer people to appropriate agencies when needed.', manualReference:'SEG 35 · Problem Solving' },
  { key:'motivationalTraits', label:'Motivational Traits', group:'Judgment Decisions', definition:'Act independently of the FTO with assertiveness and determination; engage in calls and self-initiated activity, complete patrol tasks, and assist fellow officers.', manualReference:'SEG 38 · Motivational Traits' },
  { key:'taskManagement', label:'Task Management', group:'Judgment Decisions', definition:'Safely and effectively perform multiple police-related tasks at the same time while remaining focused.', manualReference:'SEG 37 · Multitasking' },
] as const;
export type Category = typeof SEG_CATEGORIES[number]['key'];
export const CATEGORIES = SEG_CATEGORIES.map(({ key }) => key) as Category[];
export const CATEGORY_GROUPS = [...new Set(SEG_CATEGORIES.map(({ group }) => group))];
export const SEG_RATING_COLUMNS = [
  ['Duty Readiness', 'Communications/Computer', 'Interpersonal Skills', 'Geographic Skills', 'Driving Skills'],
  ['Knowledge', 'Official Report', 'Engagement'],
  ['Officer Safety', 'Judgment Decisions'],
] as const;
export const SEG_RATING_GROUP_LABELS: Readonly<Record<string, string>> = {
  'Duty Readiness': 'Reporting for Duty',
  Engagement: 'Self-Initiated Activity',
};
export const CATEGORY_LABEL = Object.fromEntries(SEG_CATEGORIES.map(({ key, label }) => [key, label])) as Record<Category,string>;
export const DEFAULT_NO_CATEGORIES: readonly Category[] = ['emergencyPursuit','initiatingArrests','handlingPrisoners','vehicleStops','buildingSearch','patDownSearches','stressSituations','arrestSituations'];
const DEFAULT_NO_CATEGORY_SET = new Set<Category>(DEFAULT_NO_CATEGORIES);
export const isRtRestricted = (category: Category) => {
  const group = SEG_CATEGORIES.find(item => item.key === category)?.group;
  return group === 'Officer Safety' || group === 'Driving Skills' || group === 'Duty Readiness';
};
export const defaultRatings = (): Record<Category, RatingEntry> => Object.fromEntries<RatingEntry>(CATEGORIES.map(category => [category, {
  rating: DEFAULT_NO_CATEGORY_SET.has(category) ? 'NO' : 'A', justification: '', nrtWithUnacceptable: false, nrtPriorDocumentationReviewed: false,
  nrtPriorUnacceptableIds: [], nrtTrainingReviewed: false, nrtCoordinatorsNotified: false, nrtFtoSergeantNotified: false,
  nrtCorrectiveActions: '', nrtOfficeReviewStatus: 'not_submitted',
}])) as Record<Category, RatingEntry>;
export const emptyRatings = (): Record<Category, RatingEntry> => Object.fromEntries<RatingEntry>(CATEGORIES.map(category => [category, {
  rating: '', justification: '', nrtWithUnacceptable: false, nrtPriorDocumentationReviewed: false,
  nrtPriorUnacceptableIds: [], nrtTrainingReviewed: false, nrtCoordinatorsNotified: false, nrtFtoSergeantNotified: false,
  nrtCorrectiveActions: '', nrtOfficeReviewStatus: 'not_submitted',
}])) as Record<Category, RatingEntry>;

export const RATINGS = ['NO','A','RT','UA','NRT'] as const;
export type Rating = typeof RATINGS[number] | '';
const RATING_LABEL: Record<Exclude<Rating,''>,string> = {
  NO:'Not Observed',
  A:'Acceptable',
  RT:'Responding to Training',
  UA:'Unacceptable',
  NRT:'Not Responding to Training',
};
export const ratingLabel = (r: Rating) => r ? RATING_LABEL[r] : '—';
export const ratingShortLabel = (r: Rating) => r || '—';
export const needsJustification = (r: Rating) => r==='UA'||r==='NRT';
export const RATING_LEGEND = [
  { code:'NO', label:'Not Observed' },
  { code:'A', label:'Acceptable' },
  { code:'RT', label:'Responding to Training' },
  { code:'UA', label:'Unacceptable' },
  { code:'NRT', label:'Not Responding to Training' },
] as const;
export const DAILY_ACTIVITY_FIELDS = [
  { key:'premierOneReports', label:'PremierOne Reports' },
  { key:'fiReports', label:'FI Reports' },
  { key:'accidentReports', label:'Accident Reports' },
  { key:'impoundSlips', label:'Impound Slips' },
  { key:'pcAffidavits', label:'Probable Cause Affidavit' },
  { key:'propertySlips', label:'Property Slips' },
  { key:'trafficStops', label:'Traffic Stops' },
  { key:'trafficCitations', label:'Traffic Citations' },
  { key:'solveCitationSummons', label:'Solve Citation/Summons*' },
  { key:'parkingCitations', label:'Parking Citations' },
  { key:'firstResponderLetters', label:'First Responder Letters' },
  { key:'u10100Reports', label:'Arrest Reports · U-10.100' },
  { key:'arrestProcessForms', label:'Arrest Process Forms' },
  { key:'criminalComplaints', label:'Criminal Complaints' },
  { key:'misdemeanorSummons', label:'Misdemeanor Summons' },
  { key:'misdemeanorArrests', label:'Misdemeanor Arrests' },
  { key:'felonyPackets', label:'Felony Packet / Direct Ind.' },
  { key:'felonyArrests', label:'Felony Arrests' },
  { key:'dvPackets', label:'D.V. Charges/Arrest' },
  { key:'oviPackets', label:'OVI Process' },
  { key:'prisonersSlated', label:'Prisoners Slated' },
  { key:'completedPayouts', label:'Completed Payouts' },
  { key:'summonsReissued', label:'Summons Re-issued' },
  { key:'suspiciousPersonStops', label:'Suspicious Person / Stops' },
  { key:'prisonerSearches', label:'Prisoner Searches' },
  { key:'patDowns', label:'Pat Downs' },
  { key:'attemptedWarrantsServed', label:'Attempted / Warrants Served' },
  { key:'forceDisplays', label:'Use of Force / Taser Firearm Display' },
  { key:'vehicleExtractions', label:'Vehicle Extractions' },
  { key:'evo', label:'EVO' },
] as const;
export type ActivityKey = typeof DAILY_ACTIVITY_FIELDS[number]['key'];
export const DAILY_ACTIVITY_COLUMNS: ReadonlyArray<{ title: string; keys: readonly ActivityKey[] }> = [
  {
    title: 'Reports',
    keys: ['premierOneReports', 'fiReports', 'accidentReports', 'impoundSlips', 'pcAffidavits', 'propertySlips'],
  },
  {
    title: 'Traffic & citations',
    keys: ['trafficStops', 'trafficCitations', 'solveCitationSummons', 'parkingCitations', 'firstResponderLetters', 'u10100Reports', 'criminalComplaints'],
  },
  {
    title: 'Arrests & processing',
    keys: ['misdemeanorSummons', 'misdemeanorArrests', 'felonyPackets', 'felonyArrests', 'dvPackets', 'oviPackets', 'arrestProcessForms'],
  },
  {
    title: 'Other activity',
    keys: ['prisonersSlated', 'completedPayouts', 'summonsReissued', 'suspiciousPersonStops', 'prisonerSearches', 'patDowns', 'attemptedWarrantsServed', 'forceDisplays', 'vehicleExtractions', 'evo'],
  },
];
export type DailyActivitySummary = Record<ActivityKey, number>;
export const PRIMARY_RUN_FORMS = [
  { key:'call_for_service', label:'Call for Service', formNumber:'' },
  { key:'self_initiated', label:'Self-Initiated Run / Training', formNumber:'' },
  { key:'domestic_incident', label:'Domestic Incident', formNumber:'' },
  { key:'traffic_crash', label:'Traffic Crash Investigation', formNumber:'' },
  { key:'traffic_stop', label:'Traffic Stop', formNumber:'' },
  { key:'high_risk_stop', label:'High Risk Traffic Stop', formNumber:'' },
  { key:'building_search', label:'Building Search', formNumber:'' },
] as const;
export const RUN_FORM_GUIDANCE: Record<PrimaryRunForm,string> = {
  call_for_service:'Use for dispatched calls unless a dedicated Domestic Incident, Traffic Crash, Traffic Stop, Building Search, or High Risk Traffic Stop form applies.',
  self_initiated:'Use for self-initiated runs unless a dedicated primary form applies; the manual includes suspicious-person or vehicle stops, field interviews, parking violators, and additional training.',
  domestic_incident:'Use for domestic incidents whether dispatched or self-initiated.',
  traffic_crash:'Use for traffic crash investigations, whether dispatched or self-initiated.',
  traffic_stop:'Use for motor-vehicle traffic stops, dispatched or self-initiated; do not use this form for a High Risk Traffic Stop.',
  high_risk_stop:'Use for a high-risk stop when there is potential for felonious assault; follow the manual’s high-risk stop guidance.',
  building_search:'Use the dedicated Building Search primary form when that task applies.',
};
export type PrimaryRunForm = typeof PRIMARY_RUN_FORMS[number]['key'];
export const SUPPLEMENTAL_RUN_FORMS = [
  { key:'arrest_process', label:'Arrest Process', formNumber:'U-10.188' },
  { key:'ovi_process', label:'OVI Process', formNumber:'' },
  { key:'narrative_addition', label:'Narrative Addition / Continuation', formNumber:'U-10.192' },
] as const;
export const SUPPLEMENTAL_FORM_GUIDANCE: Record<(typeof SUPPLEMENTAL_RUN_FORMS)[number]['key'],string> = {
  arrest_process:'The manual requires Arrest Process for an arrest that is transported for processing; also select it for payout arrests or transfers to another jurisdiction. Select U-10.100 Reports in the related activity checkboxes only when the Arrest Report was completed; no statistic is added automatically.',
  ovi_process:'Use with the applicable primary form when the person is processed for OVI. Select OVI Packets in the related activity checkboxes only when the packet was completed; no statistic is added automatically.',
  narrative_addition:'Use only when an additional narrative page is needed for the primary run record.',
};
export type SupplementalRunForm = typeof SUPPLEMENTAL_RUN_FORMS[number]['key'];
type ChecklistItemDefinition = { label: string; help: string };
type ChecklistSectionDefinition = { title: string; items: readonly ChecklistItemDefinition[] };
const checklistItem = (label:string,help:string):ChecklistItemDefinition=>({label,help});
const checklistSection = (title:string,...items:ChecklistItemDefinition[]):ChecklistSectionDefinition=>({title,items});
export const RUN_CHECKLIST_SECTIONS: Record<PrimaryRunForm, readonly ChecklistSectionDefinition[]> = {
  call_for_service: [
    checklistSection('Pre-contact actions',
      checklistItem('Radio, call number, and MPS','PO acknowledges/notifies radio, records the call number and location, and reviews MPS information.'),
      checklistItem('En route, arrival, route, and location','PO uses the en-route and arrival buttons, finds the run location, and takes a direct route using the map or area knowledge.'),
      checklistItem('Safe arrival and approach','PO parks safely away from the run and makes a safe approach to the person or location.'),
      checklistItem('Driving, coordination, and BWC','PO demonstrates proper driving, coordinates with other units when needed, and activates BWC.')),
    checklistSection('Contact and investigation',
      checklistItem('Initiates contact and communicates','PO identifies and initiates contact, uses effective communication, asks relevant questions, and interviews involved parties.'),
      checklistItem('Information and records checks','PO airs pertinent information, obtains identification and documentation, and conducts appropriate LEADS/Records checks.'),
      checklistItem('Decision-making and follow-up','PO recognizes when more investigation is needed, communicates a course of action, provides resources or an incident number, and secures or collects evidence.'),
      checklistItem('Notifications and CVS','PO notifies supervisors or investigative personnel when appropriate and uses backseat CVS as required.')),
    checklistSection('Action and enforcement',
      checklistItem('Incident response and report choice','PO mediates or speaks with involved parties as appropriate and selects the correct report or form.'),
      checklistItem('Accurate paperwork and enforcement','PO completes an accurate, detailed report and applies appropriate summons, arrest, or other enforcement.'),
      checklistItem('Legal references and supporting forms','PO uses directives, SOPs, and criminal codes, and completes applicable probable-cause or lethality-assessment forms.')),
    checklistSection('Officer safety',
      checklistItem('Presence, control, and interview stance','PO maintains command presence, verbally controls the situation, and uses a safe interview stance and reactionary gap.'),
      checklistItem('Threat awareness and searches','PO scans for weapons or threats and conducts applicable pat-downs or searches.'),
      checklistItem('Force, prisoner control, and flashlight','PO uses force appropriately, maintains prisoner control, and uses a flashlight when needed.')),
    checklistSection('Clearance and directives',
      checklistItem('Correct disposition and radio clearance','PO reclassifies when needed and clears with radio/MPS using the correct disposition and required transport, location, and mileage notifications.'),
      checklistItem('CVS/BWC and report timing','PO classifies CVS/BWC correctly and completes reports and paperwork within an appropriate time.'),
      checklistItem('Division directives and SOPs','PO reviews the applicable Division directives, SOPs, and other listed guidance.')),
  ],
  self_initiated: [
    checklistSection('Pre-contact actions',
      checklistItem('Radio and call details','PO notifies radio of the stop and provides the call number and location.'),
      checklistItem('Safe positioning and approach','PO safely positions the cruiser and approaches the person, location, or vehicle safely.'),
      checklistItem('Additional resources and BWC','PO requests additional officers when needed and activates BWC.')),
    checklistSection('Contact and investigation',
      checklistItem('Contact type and purpose','PO identifies whether the contact is consensual, a Terry stop, arrest situation, parking violation, pedestrian violation, suspicious vehicle, or other initiated contact.'),
      checklistItem('Communication and information','PO uses effective communication, asks relevant questions, obtains documentation and identification, and notifies a supervisor when needed.'),
      checklistItem('Records, decisions, and evidence','PO conducts appropriate LEADS/Records checks, exercises sound judgment, recognizes further investigative needs, and secures evidence.')),
    checklistSection('Action and enforcement',
      checklistItem('Search, FI, and vehicle outcome','PO applies consent search, pat-down, or search-incident procedures as applicable; completes an FI when required; and selects an appropriate vehicle outcome.'),
      checklistItem('Report and enforcement paperwork','PO selects and completes the correct report/forms, including U-10.100 when applicable, and uses warnings, citations, summonses, or arrest appropriately.'),
      checklistItem('References, uploads, and timely work','PO uses the proper legal references, completes paperwork in a reasonable time, backseats CVS as required, and uploads to Matrix when applicable.')),
    checklistSection('Officer safety',
      checklistItem('Presence, verbal control, and stance','PO maintains command presence, controls the interaction verbally, and uses a safe interview stance and reactionary gap.'),
      checklistItem('Threat awareness and searches','PO scans for threats and conducts applicable pat-downs or searches.'),
      checklistItem('Force, prisoner control, and flashlight','PO uses force appropriately, maintains prisoner control, and uses a flashlight when needed.')),
    checklistSection('Clearance and directives',
      checklistItem('Radio and MPS disposition','PO clears with radio/MPS using the proper disposition and gives required notifications.'),
      checklistItem('Division directives and SOPs','PO reviews the applicable Division directives, SOPs, and other listed guidance.')),
  ],
  domestic_incident: [
    checklistSection('Pre-contact actions',
      checklistItem('Radio, call number, and MPS','PO acknowledges/notifies radio, records call number and location, and reviews MPS information.'),
      checklistItem('En route, arrival, and safe approach','PO uses en-route/arrival buttons, finds the location, coordinates with other units, takes a direct route, parks safely, and approaches safely.'),
      checklistItem('Driving and BWC','PO demonstrates proper driving and activates BWC.')),
    checklistSection('Contact and investigation',
      checklistItem('Separate, protect, and assess','PO identifies and separates victim and offender, secures weapons, detains witnesses as needed, and requests medical aid when appropriate.'),
      checklistItem('Interview and records checks','PO communicates effectively, asks pertinent questions, interviews involved parties, obtains identification, and checks LEADS/Records and prior domestic-violence convictions.'),
      checklistItem('Protection orders and probable cause','PO verifies applicable protection orders, determines the relationship and probable cause, and collects evidence.'),
      checklistItem('Victim and supervisor notifications','PO provides victim resources or pamphlets, notifies supervisors as required, and contacts the domestic-violence detective when appropriate.')),
    checklistSection('Action and enforcement',
      checklistItem('Dispute resolution and protection','PO mediates when appropriate, makes referrals, enforces protection orders, and identifies the primary aggressor.'),
      checklistItem('Arrest and required reports','PO completes applicable arrest warrant, complaints, PremierOne/U-10.100, constitutional-rights waiver, and other required report forms.'),
      checklistItem('Supporting documentation and upload','PO completes applicable lethality assessment, domestic-violence phone/worksheet, PC affidavit, victim/witness statements, photos, incident number, reclassification, and Matrix upload.'),
      checklistItem('No-arrest explanation','If no arrest is made, PO articulates why no charges were filed.')),
    checklistSection('Officer safety',
      checklistItem('Presence, control, and stance','PO maintains command presence, verbally controls the situation, and uses a safe interview stance and reactionary gap.'),
      checklistItem('Threat awareness and searches','PO scans for threats and conducts applicable pat-downs or searches.'),
      checklistItem('Force, prisoner control, and flashlight','PO uses force appropriately, maintains prisoner control, and uses a flashlight when needed.')),
    checklistSection('Clearance and directives',
      checklistItem('Radio/MPS clearance and notifications','PO clears with the correct disposition and gives required transport, location, and mileage notifications.'),
      checklistItem('Division directives and SOPs','PO reviews the applicable Division directives, SOPs, and other listed guidance.')),
  ],
  traffic_crash: [
    checklistSection('Pre-contact and scene safety',
      checklistItem('Radio and scene information','PO airs pertinent information and obtains accounts from involved parties and witnesses.'),
      checklistItem('Injuries and medical response','PO determines whether anyone is injured and requests appropriate medical services or transport.'),
      checklistItem('Scene, vehicles, and follow-up','PO secures the scene, collects evidence, coordinates tow exchange, follows up at a hospital when appropriate, and secures/inventories vehicles.'),
      checklistItem('Impairment and CVS','PO assesses possible driver impairment, follows City crash requirements, and uses backseat CVS as required.')),
    checklistSection('Investigation and reporting',
      checklistItem('Clearance policy and records checks','PO applies quick-clearance policy and conducts LEADS/Records checks on drivers.'),
      checklistItem('Exchange and enforcement','PO provides exchange information and applies warning, citation, summons, or arrest as appropriate.'),
      checklistItem('Crash report and supporting forms','PO completes the Traffic Crash Report and applicable impound, parking/traffic citation, U-10.100, PC affidavit, or related forms.'),
      checklistItem('References, upload, and timely completion','PO uses proper traffic/criminal references, uploads to Matrix when applicable, and completes reports in a reasonable time.')),
    checklistSection('Officer safety',
      checklistItem('Presence, control, and interview stance','PO maintains command presence, controls the scene, and uses a safe interview stance and reactionary gap.'),
      checklistItem('Threat awareness, searches, and prisoner control','PO scans for threats, searches when appropriate, and maintains prisoner control.'),
      checklistItem('Force and flashlight','PO uses force appropriately and uses a flashlight when needed.')),
    checklistSection('Clearance and directives',
      checklistItem('Disposition and notifications','PO reclassifies when needed, gives radio notifications, and clears with the appropriate disposition.'),
      checklistItem('Division directives and SOPs','PO reviews the applicable Division directives, SOPs, and other listed guidance.')),
  ],
  traffic_stop: [
    checklistSection('Identify and plan the stop',
      checklistItem('Violation and tactical location','PO recognizes the violation and chooses a tactically advantageous location.'),
      checklistItem('Plate, support, and BWC','PO enters the plate in LEADS when possible, requests additional units based on occupant behavior, and activates BWC.')),
    checklistSection('Initiate the stop',
      checklistItem('Lights, radio, and stop details','PO activates lights/siren as appropriate and airs the call number, location, reason, vehicle, and tag information.'),
      checklistItem('Cruiser position and visibility','PO positions the cruiser about 8–12 feet back with an offset, uses PA/spotlight appropriately, and keeps occupants in the vehicle when safe.'),
      checklistItem('Ongoing threat awareness','PO watches doors, trunk, windows, occupants, and other developing safety concerns.')),
    checklistSection('Approach and contact',
      checklistItem('Approach awareness and positioning','PO monitors occupant and pedestrian movement, scans the vehicle, uses a flashlight as needed, gives clear directions, and maintains safe body position.'),
      checklistItem('Reason, identity, and documents','PO greets the violator, identifies the reason for the stop, obtains operator/license/registration/insurance information, and avoids reaching into the vehicle.'),
      checklistItem('Decision and records checks','PO watches the violator and traffic while returning to the cruiser, checks LEADS/warrants, requests a tow when needed, and chooses the appropriate enforcement.')),
    checklistSection('Enforcement and re-approach',
      checklistItem('Citation or other enforcement','PO applies the correct traffic/criminal code, explains and provides the citation/summons when issued, and completes required forms within a reasonable time.'),
      checklistItem('Safe re-approach and closeout','PO repeats awareness and safe positioning, explains the outcome, closes the contact, classifies CVS/BWC, and clears radio/MPS correctly.'),
      checklistItem('Traffic data collection','PO completes the Traffic Data Collection form when the stop meets the manual’s requirement.')),
    checklistSection('Arrest and vehicle options',
      checklistItem('Arrest communication and control','If arrest occurs, PO advises the person, controls movement and exit, secures keys, and safely shuts off the vehicle when appropriate.'),
      checklistItem('Vehicle disposition','PO releases, inventories/impounds, protects, or searches the vehicle as appropriate.')),
    checklistSection('Directives',
      checklistItem('Division directives and SOPs','PO reviews the applicable Division directives, SOPs, and other listed guidance.')),
  ],
  high_risk_stop: [
    checklistSection('Identify and plan the stop',
      checklistItem('Reason and threat assessment','PO recognizes the stop reason, assesses threat level, and selects the appropriate high-risk-stop type.'),
      checklistItem('Radio, plate, support, and roles','PO enters plate information when possible, notifies radio of the reason, requests adequate units, assigns roles, and selects a tactical location.'),
      checklistItem('Vehicle details and BWC','PO provides vehicle/tag information to radio and activates BWC.')),
    checklistSection('Initiate and control the stop',
      checklistItem('Position, lights, and communication','PO activates lights/siren, airs call number/location, positions about 20–30 feet back with an offset, and communicates with officers.'),
      checklistItem('Cover, crossfire, and threat awareness','PO uses spotlight and cover, scans the vehicle, watches trunk/doors/windows, uses weapons safely, and avoids crossfire.')),
    checklistSection('Occupant contact and prisoner control',
      checklistItem('Clear commands and coordinated movement','PO uses loud, direct commands or PA, turns off the vehicle when appropriate, directs occupants one at a time, and coordinates positions.'),
      checklistItem('Secure and search the suspect','PO maintains control, handcuffs and searches the suspect, moves them to a safe location, and secures them in the cruiser.')),
    checklistSection('Actions and paperwork',
      checklistItem('Checks and identity','PO completes LEADS/warrant checks and verifies identity using available records or images.'),
      checklistItem('Enforcement and reports','PO selects the proper enforcement, completes the required report including U-10.100 when applicable, and completes Traffic Data Collection when required.'),
      checklistItem('Notifications, PC affidavit, and upload','PO contacts the appropriate investigative unit/supervisor, completes PC affidavit when needed, and uploads to Matrix when applicable.'),
      checklistItem('Vehicle disposition','PO releases, inventories/impounds, protects, or searches the vehicle as appropriate.')),
    checklistSection('Clearance and directives',
      checklistItem('Radio/MPS and CVS/BWC','PO clears with the correct disposition, gives required notifications, and classifies CVS/BWC correctly.'),
      checklistItem('Division directives and SOPs','PO reviews the applicable Division directives, SOPs, and other listed guidance.')),
  ],
  building_search: [
    checklistSection('Pre-contact actions',
      checklistItem('Radio, location, and MPS','PO acknowledges/notifies radio, records call number/location, reviews MPS, and finds the address using map or area knowledge.'),
      checklistItem('Route, coordination, and approach','PO coordinates units, takes a direct route, parks and positions the cruiser safely, approaches safely, and demonstrates proper driving.'),
      checklistItem('En route, arrival, and BWC','PO uses the en-route/arrival buttons and activates BWC.')),
    checklistSection('Cruiser approach and perimeter',
      checklistItem('Safe approach and positioning','PO plans a safe approach, avoids blocking the front of the location, and avoids slamming the cruiser door.'),
      checklistItem('Threat check and backup','PO scans for threats, waits for needed backup, uses radio to set a perimeter, and requests helicopter/K-9/additional officers when appropriate.'),
      checklistItem('Radio updates','PO airs pertinent vehicle and suspect information and notifies radio when air should be held or released.')),
    checklistSection('Entry, search tactics, and safety',
      checklistItem('Announce and entry position','PO knocks/announces when appropriate, enters doorways/hallways without standing in the doorway, and coordinates radio air control.'),
      checklistItem('Weapon and light discipline','PO keeps finger off trigger, uses flashlight/weapon safely, avoids backlighting self or partner, and communicates with officers.'),
      checklistItem('Systematic search and awareness','PO completes a thorough inside/outside search, uses cover/concealment, stays aware of surroundings, and uses quick peek/slicing techniques appropriately.'),
      checklistItem('Room-entry technique and roles','PO uses the assigned button-hook, high-low, criss-cross, pie, cover, or fill role as directed.')),
    checklistSection('Contact and investigation',
      checklistItem('Contact, records, and information','PO initiates contact, communicates and interviews, obtains identification, conducts LEADS/Records checks, and airs pertinent information.'),
      checklistItem('Investigation, evidence, and coordination','PO uses sound judgment, identifies further investigation, notifies supervisors/investigators, secures evidence, and communicates the course of action.'),
      checklistItem('Apprehension, if applicable','PO gives appropriate directions, maintains prisoner control, searches when required, notifies supervisors/investigators, and protects the crime scene.')),
    checklistSection('Clearance and directives',
      checklistItem('Forms and building security','PO completes applicable incident/FI/false-alarm/business-check forms, secures the building, and attempts to contact the owner when appropriate.'),
      checklistItem('Radio, CAD, and disposition','PO documents entry/exit in CAD, clears with the correct disposition, reclassifies when needed, and leaves the scene safely.'),
      checklistItem('Division directives and SOPs','PO reviews the applicable Division directives, SOPs, and other listed guidance.')),
  ],
};
Object.assign(RUN_CHECKLIST_SECTIONS, SUBMITTED_PRIMARY_CHECKLISTS);
export const RUN_CHECKLIST_ITEMS = Object.fromEntries(
  Object.entries(RUN_CHECKLIST_SECTIONS).map(([key,sections])=>[key,sections.flatMap(section=>section.items.map(item=>item.label))]),
) as unknown as Record<PrimaryRunForm, readonly string[]>;
export const RUN_CHECKLIST_HELP = Object.fromEntries(
  Object.entries(RUN_CHECKLIST_SECTIONS).map(([key,sections])=>[key,sections.flatMap(section=>section.items.map(item=>item.help))]),
) as unknown as Record<PrimaryRunForm, readonly string[]>;
export const RUN_SUPPLEMENT_CHECKLIST_SECTIONS: Record<SupplementalRunForm, readonly ChecklistSectionDefinition[]> = {
  arrest_process: [
    checklistSection('Arrest at scene',
      checklistItem('Restraints, search, and property','PO applies appropriate handcuff/leg restraints, conducts the required search, and secures property and evidence.'),
      checklistItem('Separate, notify, and assess','PO separates combative prisoners, completes radio checks, moves to a safe location, and requests medical aid when needed.'),
      checklistItem('Charges and review','PO places the person on appropriate charges and contacts a supervisor to review arrest paperwork before slating when required.')),
    checklistSection('Transport and prisoner safety',
      checklistItem('Transport radio and route','PO advises radio of transport, provides required mileage, and takes a direct route.'),
      checklistItem('Continuous control and camera','PO maintains observation and prisoner control, activates the backseat camera, checks the backseat after removal, and uses seatbelts.')),
    checklistSection('Processing and disposition',
      checklistItem('Headquarters / ID Unit','PO follows weapon storage, monitoring, room entry, handcuff, and property procedures when processing through the ID Unit.'),
      checklistItem('Clerk, jail, or hospital','PO obtains case numbers and completes the applicable court, jail, hospital, or transfer steps and notifications.'),
      checklistItem('Property and electronic records','PO submits property/evidence and completes the required electronic paperwork.')),
    checklistSection('Directives',
      checklistItem('Division directives and SOPs','PO reviews the applicable Division directives, SOPs, and other listed guidance.')),
  ],
  ovi_process: [
    checklistSection('Contact at scene',
      checklistItem('CVS, BWC, and observations','PO activates CVS/BWC, recognizes and documents observable clues, and observes/interviews the driver.'),
      checklistItem('DRE/DICE and decisions','PO contacts a DRE/DICE officer when appropriate and makes sound decisions and commands.')),
    checklistSection('Field sobriety tests',
      checklistItem('Questions and instructions','PO asks relevant questions and gives clear instructions.'),
      checklistItem('Applicable tests','PO performs the applicable Horizontal Gaze Nystagmus, Walk-and-Turn, and One-Leg Stand steps.')),
    checklistSection('Arrest and safety',
      checklistItem('Arrest communication and search','PO advises of arrest, uses restraints, conducts the required search, and secures property/evidence.'),
      checklistItem('Prisoner care and transport','PO monitors and controls the prisoner, separates co-defendants when needed, requests medical aid, and follows transport/seatbelt procedures.')),
    checklistSection('Paperwork and vehicle options',
      checklistItem('OVI forms and rights','PO completes applicable rights, interview, alcohol influence, chemical-test, BMV 2255, and U-10.100 paperwork.'),
      checklistItem('Citations, reports, and PC','PO completes applicable citations, complaints, impound slips, electronic reports, felony packet, and PC affidavit.'),
      checklistItem('Vehicle and property disposition','PO releases or inventories/impounds the vehicle, searches when appropriate, and follows property procedures.')),
    checklistSection('Officer safety and directives',
      checklistItem('Safety and prisoner control','PO maintains command presence, scans for threats, controls the scene, and uses searches/force appropriately.'),
      checklistItem('Division directives and SOPs','PO reviews the applicable Division directives, SOPs, and other listed guidance.')),
  ],
  narrative_addition: [
    checklistSection('Narrative continuation',
      checklistItem('Need and attachment','PO/FTO adds continuation pages when the primary narrative needs more room and attaches each page to the correct run.'),
      checklistItem('Primary-run reference','Continuation identifies and clearly refers to its primary run record.'),
      checklistItem('Required details','Continuation includes the relevant performance, coaching, and training details without duplicating unnecessary personal or incident identifiers.')),
  ],
};
Object.assign(RUN_SUPPLEMENT_CHECKLIST_SECTIONS, SUBMITTED_SUPPLEMENTAL_CHECKLISTS);
export const RUN_SUPPLEMENT_CHECKLIST_ITEMS = Object.fromEntries(
  Object.entries(RUN_SUPPLEMENT_CHECKLIST_SECTIONS).map(([key,sections])=>[key,sections.flatMap(section=>section.items.map(item=>item.label))]),
) as unknown as Record<SupplementalRunForm, readonly string[]>;
export const RUN_SUPPLEMENT_CHECKLIST_HELP = Object.fromEntries(
  Object.entries(RUN_SUPPLEMENT_CHECKLIST_SECTIONS).map(([key,sections])=>[key,sections.flatMap(section=>section.items.map(item=>item.help))]),
) as unknown as Record<SupplementalRunForm, readonly string[]>;
export function newRunChecklist(runKind: PrimaryRunForm, supplements: SupplementalRunForm[] = []): Record<string, boolean> {
  return Object.fromEntries([
    ...RUN_CHECKLIST_ITEMS[runKind].map((_,index)=>[`task-${index}`,true]),
    ['na-task',false],
    ...supplements.flatMap(form=>[
      ...RUN_SUPPLEMENT_CHECKLIST_ITEMS[form].map((_,index)=>[`supp-${form}-${index}`,true]),
      [`na-supp-${form}`,false],
    ]),
  ]);
}
export function hasRunChecklistEdits(checklist:Record<string,boolean>):boolean {
  return Object.entries(checklist).some(([key,value]) =>
    (value===false&&(key.startsWith('task-')||key.startsWith('supp-')))
    ||(value===true&&(key==='na-task'||key.startsWith('na-supp-'))),
  );
}
export const DIRECTIVE_REVIEW_LABEL='Review of Division Directives, SOP, etc. (list)';
export type DirectiveReviewField='divisionDirectives'|'selectedDirectives'|'directiveDetails'|'ohioRevisedCode'|'selectedOrcReferences'|'columbusCityCode'|'selectedColumbusCodeReferences'|'other'|'otherDetails';
export interface DirectiveReviewRecord {
  divisionDirectives:boolean;
  selectedDirectives:string[];
  directiveDetails:string;
  ohioRevisedCode:boolean;
  selectedOrcReferences?:string[];
  columbusCityCode:boolean;
  selectedColumbusCodeReferences?:string[];
  other:boolean;
  otherDetails:string;
}
export function defaultDirectiveReviewRecord():DirectiveReviewRecord {
  return {divisionDirectives:true,selectedDirectives:[],directiveDetails:'',ohioRevisedCode:true,selectedOrcReferences:[],columbusCityCode:true,selectedColumbusCodeReferences:[],other:true,otherDetails:''};
}
export type DirectiveReviewForm=PrimaryRunForm|SupplementalRunForm;
export type DirectiveReviews=Partial<Record<DirectiveReviewForm,DirectiveReviewRecord>>;
export interface TrainingRun {
  clearanceRulesVersion?: 1;
  charges?: { id: string; description: string }[];
  generatedDocuments?: { id: string; kind: 'U-10.100' | 'Probable Cause Affidavit' | 'Criminal Complaint Form'; chargeId?: string; description?: string }[];
  id: string;
  incidentNumber?: string;
  location?: string;
  transportDestination?: string;
  transportDestinationType?: 'Jail'|'HQ'|'Clerks';
  endedAt?: string;
  occurredAt: string;
  runKind: PrimaryRunForm;
  isDispatched: boolean;
  trafficMode: 'none'|'motor_vehicle'|'pedestrian'|'bicycle'|'other';
  dispatchedCode?: string;
  situationFoundCode?: string;
  clearanceCode?: ''|'1V'|'2V'|'3V'|'4V';
  arrestMade: boolean;
  transportedAfterArrest: boolean;
  arrestProcessRequired?: boolean;
  activityFlags?: Partial<Record<ActivityKey,boolean>>;
  oviProcessed: boolean;
  narrativeAdditionRequired: boolean;
  formStatus: 'not_started'|'in_progress'|'complete';
  checklist: Record<string, boolean>;
  directiveReviews?:DirectiveReviews;
  checklistReviewedAt?: string;
  narrative: string;
}
export const DAILY_DUTY_CHECKLIST = [
  { section:'Appearance/Equipment', items:[
     { key:'reported_on_time', label:'Reported to assignment in timely manner' },
     { key:'uniform_appearance', label:'Uniform Appearance-neat, pressed & shined' },
     { key:'professional_appearance', label:'Professional personal appearance' },
     { key:'prepared_for_duties', label:'Prepared to assume duties (paperwork/personal assigned equipment)' },
     { key:'checked_daily_bulletin', label:'Checked Division email/Daily Bulletin' },
     { key:'interacted_with_team', label:'Interacted with peers/supervisors' },
     { key:'assigned_shotgun', label:'Assigned shotgun' },
  ] },
  { section:'Roll Call/Cruiser Inspection', items:[
    { key:'participated_in_roll_call', label:'Participated in daily roll call' },
     { key:'inspected_cruiser_start', label:'Conducted inspection of cruiser (cleanliness, damage, weapons, contraband, equipment, etc.)' },
     { key:'inspected_assigned_equipment', label:'Conducted inspection of assigned equipment' },
     { key:'reported_equipment_issue', label:'Reported cruiser damage/missing equipment to supervisor' },
     { key:'turned_on_cvs', label:'Log on CVS' },
     { key:'signed_on_mps', label:'Turned on/signed onto MPS' },
     { key:'carried_forms', label:'Carried necessary forms/booklets/paperwork/manuals' },
     { key:'unit_assignment_one', label:'Worked as a one officer unit' },
     { key:'unit_assignment_two', label:'Worked as a two officer unit' },
     { key:'po_drove', label:'PO drove during tour of duty' },
     { key:'bwc_operational', label:'BWC Operational' },
  ] },
  { section:'Marking out of Service', items:[
     { key:'inspected_cruiser_end', label:'Conducted inspection of cruiser (cleanliness, damage, weapons, contraband, equipment,etc.)' },
     { key:'cruiser_half_tank', label:'Cruiser ½ tank of gas' },
     { key:'turned_off_cvs', label:'Log off CVS' },
     { key:'signed_off_mps', label:'Signed off/turned off MPS' },
     { key:'turned_in_paperwork', label:'Turned in completed paperwork' },
     { key:'returned_equipment', label:'Returned assigned equipment to substation (unloaded shotgun, keys, Taser, etc)' },
     { key:'docked_bwc', label:'Properly dock BWC' },
  ] },
  { section:'Shotgun Training (FTO demonstrated & PO should repeatedly perform this training)', items:[
     { key:'shotgun_readiness', label:'The different stages of readiness' },
     { key:'shotgun_loading', label:'Method of loading/unloading' },
     { key:'shotgun_cruiser_ready', label:'Made shotgun “cruiser ready”' },
     { key:'shotgun_loaded_round', label:'Loaded round into shotgun' },
     { key:'shotgun_cleared', label:'Cleared shotgun & made shotgun “cruiser ready”' },
     { key:'shotgun_unloaded', label:'Unloaded the shotgun' },
     { key:'shotgun_bullet_trap', label:'Utilized bullet trap system' },
     { key:'shotgun_proficiency', label:'Demonstrated shotgun proficiency' },
  ] },
] as const;
export function dutyChecklistChecked(checklist:Record<string,boolean>|undefined,key:string):boolean {
  if(checklist?.[key]!==undefined)return checklist[key];
  if(key==='unit_assignment_one'||key==='unit_assignment_two')return checklist?.unit_assignment??true;
  return true;
}
export type DutyStatus = 'on_duty'|'training'|'sick'|'off_duty'|'other';
export interface ReportingForDutyRecord {
  dutyStatus: DutyStatus;
  cruiserId?: string;
  shotgunTraining?: 'Y' | 'N';
  checklist: Record<string, boolean>;
  notApplicable?: Record<string, boolean>;
  notes: string;
  reviewedAt?: string;
}
export const emptyReportingForDutyRecord = (): ReportingForDutyRecord => ({ dutyStatus:'on_duty', checklist:{}, notes:'' });
export const defaultReportingForDutyRecord = (): ReportingForDutyRecord => ({
  dutyStatus:'on_duty',
  checklist:Object.fromEntries(DAILY_DUTY_CHECKLIST.flatMap(group=>group.items.map(item=>[item.key,true]))),
  notApplicable:Object.fromEntries(DAILY_DUTY_CHECKLIST.map(group=>[group.section,false])),
  notes:'',
});
export function requiredSupplementalForms(run: Pick<TrainingRun, 'runKind'|'trafficMode'|'isDispatched'|'arrestMade'|'transportedAfterArrest'|'oviProcessed'|'narrativeAdditionRequired'> & {arrestProcessRequired?:boolean}): SupplementalRunForm[] {
  const forms: SupplementalRunForm[] = [];
  if (run.arrestMade) forms.push('arrest_process');
  if (run.oviProcessed) forms.push('ovi_process');
  if (run.narrativeAdditionRequired) forms.push('narrative_addition');
  return forms;
}
export const emptyDailyActivitySummary = (): DailyActivitySummary =>
  Object.fromEntries(DAILY_ACTIVITY_FIELDS.map(({ key }) => [key, 0])) as DailyActivitySummary;
export function normalizeDailyActivitySummary(value: unknown): DailyActivitySummary {
  if (value == null) return emptyDailyActivitySummary();
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A saved activity summary is invalid. Its data was not changed.');
  }
  const source = value as Record<string, unknown>;
  const result = emptyDailyActivitySummary();
  for (const { key } of DAILY_ACTIVITY_FIELDS) {
    if (source[key] === undefined) continue;
    if (!Number.isInteger(source[key]) || Number(source[key]) < 0) {
      throw new Error('A saved activity count is invalid. Its data was not changed.');
    }
    result[key] = Number(source[key]);
  }
  return result;
}
export function evaluationProgress(r: Report): 'Limbo day'|'Not started'|'In progress'|'Needs follow-up'|'Review required'|'Complete' {
  if (r.limboDay) return 'Limbo day';
  if (r.deficiencyAutomationEnabled && r.checklistDeficiencies?.some(group=>!group.narrative.trim())) return 'Review required';
  const entries = CATEGORIES.map(category => r.ratings?.[category]);
  const selected = entries.filter(entry => !!entry?.rating);
  if (selected.length === 0) return 'Not started';
  if (selected.length < CATEGORIES.length) return 'In progress';
  if (entries.some((entry, index) => {
    if (!entry) return true;
    return (entry.rating === 'RT' && isRtRestricted(CATEGORIES[index]))
      || (entry.rating === 'NRT' && (!(entry.nrtPriorUnacceptableIds?.length) || !entry.nrtPriorDocumentationReviewed || !entry.nrtTrainingReviewed || !entry.nrtCoordinatorsNotified || !entry.nrtFtoSergeantNotified || !entry.nrtCorrectiveActions?.trim()))
      || (needsJustification(entry.rating) && !entry.justification.trim());
  })) return 'Needs follow-up';
  return r.ratingsReviewedAt ? 'Complete' : 'Review required';
}
export type Role = 'po'|'fto'|'fto_coordinator'|'fto_coc'|'policenet'|'policenet_admin_sgt';
export const ROLES: Role[] = ['po','fto','fto_coordinator','fto_coc','policenet','policenet_admin_sgt'];
export const ROLE_LABEL: Record<Role,string> = {
  po:'PO',
  fto:'FTO',
  fto_coordinator:'FTO Coordinator',
  fto_coc:'FTO COC',
  policenet:'POLICENET',
  policenet_admin_sgt:'POLICENET ADMIN — SGT',
};
export const isTechnicalRole = (role:Role) => role==='policenet'||role==='policenet_admin_sgt';
// Legacy saved role values are translated to their current operational role.
export const normalizePreviewRole = (value: unknown): Role => {
  if (value==='recruit') return 'po';
  if (value==='admin') return 'fto_coordinator';
  if (value==='coc') return 'fto_coc';
  if (value==='sergeant' || value==='fto_sgt') return 'po';
  return ROLES.includes(value as Role) ? value as Role : 'po';
};
export const canViewClass = (role: Role) => role === 'fto' || role === 'fto_coordinator';
export type Phase = PhaseId;
export const PHASES: Phase[] = PHASE_TIMELINE_REGISTRY.map(({ phaseId }) => phaseId);
export const phaseLabel = (p: Phase) => 'Phase ' + p;
export interface PhaseWeekRange {
  startDate: string;
  endDate: string;
}
export interface PhaseExtensionRequest {
  id: string;
  className: string;
  recruitName: string;
  recruitBadge: string;
  phase: Phase;
  phaseStartDate: string;
  requestingFtoName: string;
  requestingFtoBadge: string;
  extensionType: 'training_weeks'|'limbo_period';
  requestedWeeks: number;
  justification: string;
  createdAt: string;
}
export type Shift = 'A-Co'|'B-Co'|'C-Co'|'DMW'|'EMW';
export type Weekday = 0|1|2|3|4|5|6;
export const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
];
export type ReportShift = Shift|'Day'|'Swing'|'Night';
export const SHIFTS: Shift[] = ['A-Co','B-Co','C-Co','DMW','EMW'];
export const SHIFT_LABEL: Record<Shift,string> = {
  'A-Co': 'A-Co · Company A',
  'B-Co': 'B-Co · Company B',
  'C-Co': 'C-Co · Company C',
  DMW: 'DMW · Day Midwatch · 10 hours',
  EMW: 'EMW · Evening Midwatch · 10 hours',
};
export function shiftDisplayLabel(shift: ReportShift): string {
  return shift in SHIFT_LABEL ? SHIFT_LABEL[shift as Shift] : `Unmapped legacy shift: ${shift}`;
}
export function shiftCodeLabel(shift: ReportShift): string {
  return shift in SHIFT_LABEL ? shift : `Legacy: ${shift}`;
}
export function phaseAssignmentLabel(ftoAssignment?: string, shift?: ReportShift): string {
  if (!ftoAssignment) return 'Not recorded';
  return shift ? `${ftoAssignment} · ${shiftCodeLabel(shift)}` : ftoAssignment;
}
export type Status = 'draft'|'fto_signed'|'recruit_signed'|'locked';
export const STATUS_LABEL: Record<Status,string> = { draft:'Draft', fto_signed:'Legacy status · signature not verified', recruit_signed:'Legacy status · signature not verified', locked:'Locked on this device' };
export interface Signature {
  name: string;
  badge: string;
  at: string;
  method?: 'demo'|'account'|'acrobat';
  accountId?: string;
  contentSha256?: string;
}
export interface WeeklyPacketAcknowledgement {
  id: string;
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  phase: Phase;
  recruitName: string;
  recruitBadge: string;
  recruitAssignment: string;
  ftoName: string;
  ftoBadge: string;
  ftoAssignment: string;
  recruitComments: string;
  ftoComments: string;
  officeComments: string;
  signatures: {
    recruit?: Signature;
    fto?: Signature;
    ftoOffice?: Signature;
    legacySergeant?: Signature;
  };
  status: 'draft'|'recruit_signed'|'fto_signed'|'office_signed';
  createdAt: string;
  updatedAt: string;
}
export interface WeeklyPerformanceLogEntry {
  id:string;
  kind:'strength'|'corrective';
  category:Category;
  totalTime:string;
  narrative:string;
  sourceReportIds:string[];
  sourceReferences?:string[];
  sourceReferenceReviewed?:boolean;
  autoGeneratedFromUa?:boolean;
  autoSourceNarrative?:string;
  autoSourceGroup?:string;
  sourceEvidenceActive?:boolean;
}
export interface WeeklyPerformanceLog {
  id:string;
  weekStart:string;
  weekEnd:string;
  weekNumber:number;
  phase:Phase;
  phaseWeek?:number;
  ftoWeek?:number;
  className:string;
  recruitName:string;
  recruitBadge:string;
  ftoName:string;
  ftoBadge:string;
  entries:WeeklyPerformanceLogEntry[];
  updatedAt:string;
}
export interface SubstationOrientationRecord {
  id:string;
  className:string;
  recruitName:string;
  recruitBadge:string;
  ftoName:string;
  ftoBadge:string;
  phase?:Phase;
  phaseStartDate:string;
  dateTime:string;
  substation:string;
  checklist:Record<string,boolean>;
  checklistReviewedAt?:string;
  directivesReview:string;
  narrative:string;
  updatedAt:string;
}
export interface PhaseCaseFolder {
  assignmentId?: string;
  className?: string;
  recruitName: string;
  recruitBadge: string;
  ftoName: string;
  ftoBadge: string;
  phase: Phase;
  shift: Shift;
  zone: string;
  precinct: string;
  cruiserDistrict: string;
  ftoAssignment?: string;
  daysOff: Weekday[];
  phaseStartDate: string;
  phaseWeekRanges?: PhaseWeekRange[];
  limboExtensionWeeks?: number;
  openedAt: string;
  legacyGeography?: { previousPrecinctText?: string; previousAreaText?: string };
}
export interface FtoRosterEntry {
  badge: string;
  name: string;
  email?: string;
}
export interface FtoPhasePosting {
  id:string;
  className:string;
  phase:Phase;
  phaseStartDate:string;
  status:'open'|'closed';
  createdAt:string;
  updatedAt:string;
}
export interface FtoPhaseSignup {
  id:string;
  postingId:string;
  ftoBadge:string;
  ftoName:string;
  status:'local_unsent'|'selected_locally'|'withdrawn';
  selectedAssignmentId?:string;
  createdAt:string;
  updatedAt:string;
}
export interface CoverageRequest {
  id:string;
  assignmentId?:string;
  className:string;
  phase:Phase;
  recruitName:string;
  recruitBadge:string;
  requestingFtoName:string;
  requestingFtoBadge:string;
  startDateTime:string;
  endDateTime:string;
  reason:string;
  status:'local_unsent'|'cancelled';
  createdAt:string;
  updatedAt:string;
}
export interface TrainingAssignment {
  id: string;
  className: string;
  recruitName: string;
  recruitBadge: string;
  recruitEmail?: string;
  ftoBadge: string;
  phase: Phase;
  phaseStartDate: string;
  shift?: Shift;
  daysOff?: Weekday[];
  zone?: string;
  precinct?: string;
  cruiserDistrict?: string;
  ftoAssignment?: string;
}
export interface RatingEntry {
  rating: Rating;
  /** Legacy compatibility field; a current NRT rating is linked to prior UA records, never paired with UA. */
  nrtWithUnacceptable: boolean;
  nrtPriorUnacceptableIds?: string[];
  nrtPriorDocumentationReviewed: boolean;
  nrtTrainingReviewed: boolean;
  nrtCoordinatorsNotified: boolean;
  nrtFtoSergeantNotified: boolean;
  justification: string;
  nrtCorrectiveActions?: string;
  nrtOfficeReviewStatus?: 'not_submitted'|'submitted'|'responded';
  nrtOfficeAction?: 'accepted_meeting'|'call_office'|'more_information';
  nrtOfficeResponse?: string;
  nrtOfficeSubmittedAt?: string;
  nrtOfficeRespondedAt?: string;
}
export interface ChecklistDeficiencyGroup {
  id: string;
  runId?: string;
  category: Category;
  tasks: { id: string; label: string; reference?: string }[];
  narrative: string;
  reviewed?: boolean;
}
export interface Report {
  id: string; date: string; shiftStartTime?: string; shift: ReportShift; phase: Phase; zone: string; precinct: string; cruiserDistrict: string;
  deficiencyAutomationEnabled?: boolean;
  deficiencyOverrides?: Record<string, Category>;
  deficiencyNarratives?: Record<string, string>;
  checklistDeficiencies?: ChecklistDeficiencyGroup[];
  deficiencyPriorRatings?: Partial<Record<Category, RatingEntry>>;
  deficiencyGeneratedText?: Partial<Record<Category, string>>;
  deficiencySafetyLocks?: Category[];
  notApplicableCategories?: Category[];
  ftoAssignment?: string;
  className?: string;
  phaseWeek?: number;
  limboDay?: boolean;
  ftoWeek?: number;
  recruitName: string; recruitBadge: string; ftoName: string; ftoBadge: string;
  substituteCoverage?: { assignmentId: string; regularFtoName: string; regularFtoBadge: string; phaseStartDate: string };
  activity: DailyActivitySummary;
  /** Legacy saved activity summaries already included counts from their run forms. */
  activityCountsIncludeRuns?: boolean;
  legacyActivity?: Record<string, unknown>;
  runs: TrainingRun[];
  reportingForDuty: ReportingForDutyRecord;
  ratings: Record<Category,RatingEntry>;
  ratingsReviewedAt?: string;
  legacyEvaluation?: { source: string; ratings: Record<string,{ rating: string; justification: string }> };
  legacyGeography?: { previousPrecinctText?: string; previousAreaText?: string };
  narrative: string; remedial: string; recruitComments: string;
  status: Status; signatures: { fto?: Signature; recruit?: Signature; sergeant?: Signature };
  createdAt: string; updatedAt: string;
}
export interface Task { id: string; phase: Phase; group: string; title: string; done: boolean; by?: string; at?: string; }
export interface LawReviewRecord {
  id: string;
  assignmentId: string;
  className: string;
  phase: Phase;
  recruitName: string;
  recruitBadge: string;
  sourceId: string;
  sourceLabel: string;
  sourceUrl?: string;
  state: 'assigned' | 'reviewed';
  assignedAt?: string;
  assignedByFtoBadge?: string;
  reviewedAt?: string;
}
export interface Workspace {
  version: number;
  /** Packet-reference review scheme; distinct from encrypted storage revision. */
  packetIndexVersion?: 1;
  role: Role;
  reports: Report[];
  tasks: Task[];
  caseFolder?: PhaseCaseFolder;
  phaseFolders: PhaseCaseFolder[];
  ftoDirectory: FtoRosterEntry[];
  assignments: TrainingAssignment[];
  weeklyAcknowledgements: WeeklyPacketAcknowledgement[];
  weeklyPerformanceLogs:WeeklyPerformanceLog[];
  substationOrientations:SubstationOrientationRecord[];
  ftoPhasePostings:FtoPhasePosting[];
  ftoPhaseSignups:FtoPhaseSignup[];
  coverageRequests:CoverageRequest[];
  lawReviewRecords:LawReviewRecord[];
  phaseExtensionRequests:PhaseExtensionRequest[];
}

const PII = [
  { re: /\b\d{3}-\d{2}-\d{4}\b/, msg: 'Looks like a Social Security number' },
  { re: /\b(dob|d\.o\.b|date of birth)\b/i, msg: 'Date of birth reference' },
  { re: /\b(dl|driver'?s? licen[cs]e|cdl)\s*#?\s*[a-z]?\d{5,}/i, msg: 'Driver license number' },
  { re: /\b(ncic|clets|rap sheet|criminal history|priors?)\b/i, msg: 'Criminal history / restricted system reference' },
  { re: /\b(case|incident|booking)\s*(no\.?|#|number)\s*\d+/i, msg: 'Case or booking identifier' },
  { re: /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, msg: 'Phone number' },
];
export function scanPII(text: string): string[] { return PII.filter(p => p.re.test(text)).map(p => p.msg); }

export function validateReport(r: Report): string[] {
  const errs: string[] = [];
  if (r.shiftStartTime !== undefined && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(r.shiftStartTime)) errs.push('Shift start time must use 24-hour HH:MM format');
  if (r.deficiencyAutomationEnabled && !r.limboDay && r.checklistDeficiencies?.some(group=>!group.narrative.trim())) errs.push('Every checklist deficiency requires an FTO articulation');
  if (r.reportingForDuty.shotgunTraining !== undefined && !['Y','N'].includes(r.reportingForDuty.shotgunTraining)) errs.push('Shotgun Training must be Y or N');
  for(const run of r.runs??[]) {
    if(run.clearanceRulesVersion===1&&run.clearanceCode==='3V'&&!run.arrestMade) errs.push('3V means Arrest Made; correct the clearance code or record the arrest that occurred');
    if(run.clearanceRulesVersion===1&&run.transportedAfterArrest&&!run.transportDestination?.trim()) errs.push('Record the actual destination for each transported arrest');
    if(run.clearanceRulesVersion===1&&run.transportedAfterArrest&&!run.transportDestinationType) errs.push('Select Jail, HQ, or Clerks for each transported arrest');
    if(run.clearanceRulesVersion===1&&run.clearanceCode==='3V'&&!run.transportedAfterArrest) errs.push('3V requires a recorded transport; use 1V when no transport occurred');
    if(run.clearanceRulesVersion===1&&run.arrestMade&&!run.transportedAfterArrest&&run.clearanceCode!=='1V') errs.push('An arrest without transport must use 1V');
    if(run.transportDestination&&run.transportDestination.length>200) errs.push('Transport destination must be 200 characters or fewer');
  }
  const req: [keyof Report, string][] = [['date','Shift date'],['shift','Shift'],['recruitName','Recruit name'],['recruitBadge','Recruit badge'],['ftoName','FTO name'],['ftoBadge','FTO badge']];
  for (const [k,l] of req) if (!String(r[k] ?? '').trim()) errs.push(l + ' is required');
  if (!isValidAssignment(r.zone, r.precinct, r.cruiserDistrict, r.shift)) errs.push('Valid Division patrol assignment (Zone, Precinct, and FTO Assignment) is required');
  if (!PHASES.includes(r.phase)) errs.push('Phase is required');
  for (const [label,value] of [['Phase week',r.phaseWeek],['FTO week',r.ftoWeek]] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 1)) errs.push(`${label} must be a positive whole number`);
  }
  if(r.phaseWeek!==undefined&&(!Number.isInteger(r.phaseWeek)||r.phaseWeek<1))errs.push('Phase week must be a positive whole number.');
  for (const c of r.limboDay ? [] : CATEGORIES) {
    const v = r.ratings?.[c];
    if (!v?.rating) errs.push(CATEGORY_LABEL[c] + ': select a manual rating');
    else {
      if (v.rating === 'NRT') {
        if (!v.nrtPriorUnacceptableIds?.length) errs.push(CATEGORY_LABEL[c] + ': link at least one earlier Unacceptable (UA) for this category');
        if (!v.nrtPriorDocumentationReviewed) errs.push(CATEGORY_LABEL[c] + ': review prior documentation before selecting NRT');
        if (!v.nrtTrainingReviewed) errs.push(CATEGORY_LABEL[c] + ': confirm training has been implemented before selecting NRT');
        if (!v.nrtCoordinatorsNotified) errs.push(CATEGORY_LABEL[c] + ': notify the FTO Coordinator when selecting NRT');
        if (!v.nrtFtoSergeantNotified) errs.push(CATEGORY_LABEL[c] + ': notify the FTO Sergeant when selecting NRT');
        if (!v.nrtCorrectiveActions?.trim()) errs.push(CATEGORY_LABEL[c] + ': document corrective actions before submitting NRT');
      }
      if (v.rating === 'RT' && isRtRestricted(c)) {
        errs.push(CATEGORY_LABEL[c] + ': RT is not permitted in this manual category');
      }
      if (needsJustification(v.rating) && !v.justification.trim()) errs.push(CATEGORY_LABEL[c] + ': document the observed performance and training for ' + ratingLabel(v.rating));
    }
  }
  return errs;
}
export function uid() { return Math.random().toString(36).slice(2, 10); }
