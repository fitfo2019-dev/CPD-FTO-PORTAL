import type { ActivityKey, Category } from './model.js';

export type ManualDefinition = {
  definition: string;
  reference: string;
};

export const WEEKLY_RATING_SUMMARY_DEFINITION: ManualDefinition = {
  definition: 'Displays the total number of performance ratings the PO received for each performance category for the week.',
  reference: 'FTO Manual, Weekly Performance Summary definition, p. 4.',
};

export const WEEKLY_ACTIVITY_SUMMARY_DEFINITION: ManualDefinition = {
  definition: 'The Excel Program will total the Daily Performance Summaries and record the total in the corresponding activity in numeric form.',
  reference: 'FTO Manual, Weekly Performance Summary instructions, p. 28.',
};

const noSeparateManualDefinition = (label: string): ManualDefinition => ({
  definition: `The FTO Manual does not provide a separate definition for “${label}” in the Daily Activity Summary.`,
  reference: 'FTO Manual, Daily Activity Summary definitions, pp. 32–35.',
});

export const SEG_MANUAL_DEFINITIONS: Record<Category, ManualDefinition> = {
  dutyReadiness: {
    definition: 'Appearance/Equipment — Evaluates ability to arrive for work in a prompt and timely fashion and in a neat and clean uniform and properly groomed. Reports to work properly equipped and physically and mentally fit to immediately assume duties.\n\nRoll Call/Cruiser Inspection — Evaluates ability to participate in roll calls, review Division issued material, and conduct proper inspection of equipment and cruiser in accordance with Patrol SOP.',
    reference: 'FTO Manual, SEG 1, pp. 18–19.',
  },
  communicationsUsage: {
    definition: 'Comprehension — Evaluates PO’s ability to communicate via radio (cruiser and portable), use Division computers and cruiser MPS.\n\nUsage Skills — Evaluates PO’s ability to select and use appropriate cruiser/portable radio channels, various features of the radio system and the Mobile Data Computer (MPS) functions (LEADS, OHLEG, CAD etc.).',
    reference: 'FTO Manual, SEG 2, pp. 19–20.',
  },
  publicPoliceInteraction: {
    definition: 'Public Interaction — Evaluates ability to effectively interact, communicate, and display a professional demeanor with the general public.\n\nPolice Interaction — Evaluates ability to effectively interact, communicate, and display a professional demeanor during contacts with peers, supervisors and civilian employees.\n\nVerbal Conflict — Evaluates ability to gain and maintain control of situations through verbal command and instruction.',
    reference: 'FTO Manual, SEG 3, pp. 20, 27.',
  },
  feedbackAcceptance: {
    definition: 'Evaluates the ability to accept feedback from FTO/supervisor. Demonstrates the ability to accept a critique of performance, knowledge or skills to further the learning process.',
    reference: 'FTO Manual, SEG 4, p. 20.',
  },
  precinctOrientation: {
    definition: 'Precinct Orientation — Evaluates the ability to familiarize themselves with the precinct, to remain alert to his/her present location, and to correctly use the city address numbering system.\n\nResponse Time/Map Skills — Evaluates ability to arrive at determined destinations within an acceptable period of time and to effectively orient themselves and locate runs using maps.',
    reference: 'FTO Manual, SEG 5, pp. 20–21.',
  },
  routineDriving: {
    definition: 'Evaluates skill in the safe operation of the police vehicle under routine driving conditions. Ability to perform police related functions (radio communication, observation of vehicular and pedestrian traffic, computer usage, use of spotlight, etc.) while operating under normal conditions.',
    reference: 'FTO Manual, SEG 6, p. 21.',
  },
  emergencyPursuit: {
    definition: 'Evaluates skills in emergency vehicle operations and in pursuit driving situations. Exercises due regard to other vehicles/citizens.',
    reference: 'FTO Manual, SEG 7, p. 21.',
  },
  policiesProcedures: {
    definition: 'Evaluates knowledge and application of Division Rules of Conduct, Directives, Patrol SOP, etc., to various police related tasks, including reports and forms.',
    reference: 'FTO Manual, SEG 8, p. 21.',
  },
  criminalTrafficCodes: {
    definition: 'Evaluates knowledge and application of the Ohio Revised Code, Columbus City Code, and State and City Traffic Codes. Capability of locating and selecting the proper enforcement code.',
    reference: 'FTO Manual, SEG 9, p. 21.',
  },
  arrestSearchSeizure: {
    definition: 'Evaluates knowledge of Arrest, Search & Seizure manual and legal updates. Application of legal training and knowledge to patrol related situations.',
    reference: 'FTO Manual, SEG 10, p. 22.',
  },
  informationGathering: {
    definition: 'Policies/Procedures — Evaluates knowledge and application of Division Rules of Conduct, Directives, Patrol SOP, etc., to various police related tasks, including reports and forms.',
    reference: 'FTO Manual, SEG 11, p. 21.',
  },
  resourceEquipmentUsage: {
    definition: 'Resource Usage — Evaluates ability to utilize various resources and manuals to complete police related tasks (Traffic Crash Manual, Field Report Manual, OHLEG, Records, Accurint and other Units/Bureaus etc.).\n\nProper Usage of Equipment — Evaluates ability to use and maintain Division issued property and personally assigned equipment (e.g., service weapon, intermediate weapons, shotgun, flashlight, cruiser, breaching kit, crime scene tape, flares, and other necessary equipment.)',
    reference: 'FTO Manual, SEG 12, pp. 22–23.',
  },
  formUsage: {
    definition: 'Evaluates ability to properly select and utilize departmental forms necessary for task accomplishment.',
    reference: 'FTO Manual, SEG 13, p. 23.',
  },
  grammarLegibility: {
    definition: 'Evaluates ability to use correct spelling, proper grammar (e.g. sentence structure, punctuation, etc.) and is able to neatly complete forms, using legible, easy-to-read block printing.',
    reference: 'FTO Manual, SEG 14, p. 23.',
  },
  contentAccuracy: {
    definition: 'Evaluates ability to complete reports that accurately reflect the incident being reported in a detailed, thorough, and organized manner.',
    reference: 'FTO Manual, SEG 15, p. 23.',
  },
  completionTime: {
    definition: 'Evaluates the amount of time taken to complete Division forms/reports relative to the nature and level of complexity of the incident. Other factors such as processing scenes, processing through ID Unit, arrival of detectives or wreckers, transports to hospitals, etc. shall be taken into consideration when determining completion time.',
    reference: 'FTO Manual, SEG 16, p. 23.',
  },
  responseToEnforcement: {
    definition: 'Criminal Violations — Evaluates ability to recognize criminal violations and intervene while on routine patrol and take appropriate enforcement action.\n\nTraffic Enforcement — Evaluates ability to recognize and take appropriate action on traffic violations.\n\nSuspicious Activity — Evaluates ability to recognize and take appropriate action in response to suspicious activity.',
    reference: 'FTO Manual, SEG 17, p. 24.',
  },
  threatAssessment: {
    definition: 'Unknown Threat Contacts — Evaluates ability to demonstrate accepted and trained officer safety techniques when initiating contact(s). Evaluates and assesses situation to determine if any possible threat exists.\n\nKnown Threat Contacts — Evaluates ability to recognize and respond to known threats when approaching locations, structures and others. Demonstrates accepted and trained officer safety techniques when responding to calls for service involving known threats.',
    reference: 'FTO Manual, SEG 18, pp. 24–25.',
  },
  initiatingArrests: {
    definition: 'Evaluates ability to maintain accepted and trained officer safety skills and techniques while initiating arrests.',
    reference: 'FTO Manual, SEG 19, p. 25.',
  },
  handlingPrisoners: {
    definition: 'Evaluates ability to transport prisoners in a safe, effective manner using trained officer safety skills.',
    reference: 'FTO Manual, SEG 20, p. 25.',
  },
  vehicleStops: {
    definition: 'Evaluates ability to conduct vehicle stops using trained officer safety standards, to include high risk stops.',
    reference: 'FTO Manual, SEG 21, p. 25.',
  },
  runApproach: {
    definition: 'Evaluates ability to approach the structure using proper/trained officer safety techniques. Evaluates ability to apply trained building search tactics and maintain an awareness of potential threats while inside the structure. (Includes building searches as well as calls for service involving officer safety in and/or around a structure)',
    reference: 'FTO Manual, SEG 22, p. 26.',
  },
  buildingSearch: {
    definition: 'Evaluates ability to approach the structure using proper/trained officer safety techniques. Evaluates ability to apply trained building search tactics and maintain an awareness of potential threats while inside the structure. (Includes building searches as well as calls for service involving officer safety in and/or around a structure)',
    reference: 'FTO Manual, SEG 23, p. 26.',
  },
  patDownSearches: {
    definition: 'Evaluates ability to safely and thoroughly perform pat down/ search.',
    reference: 'FTO Manual, SEG 24, p. 26.',
  },
  lowStressSituations: {
    definition: 'Evaluates ability to assess an incident and choose an appropriate course of action in routine, low-stress police activities. Capable of handling, managing, and resolving calls for service or self-initiated runs.',
    reference: 'FTO Manual, SEG 25, p. 26.',
  },
  stressSituations: {
    definition: 'Evaluates ability to choose an appropriate course of action in moderate and high-stress incidents. Capable of recognizing, controlling and resolving calls for service or self-initiated activities.',
    reference: 'FTO Manual, SEG 26, p. 26.',
  },
  arrestSituations: {
    definition: 'Evaluates decision-making ability and use of judgment when confronted with an arrest situation.',
    reference: 'FTO Manual, SEG 27, p. 27.',
  },
  problemSolving: {
    definition: 'Evaluates PO’s ability to perceive and form valid conclusions. Measures the PO’s ability to exercise sound judgment and make proper decisions.',
    reference: 'FTO Manual, SEG 28, p. 27.',
  },
  motivationalTraits: {
    definition: 'Evaluates ability to act independently of FTO, demonstrates assertiveness and determination while projecting a positive demeanor.',
    reference: 'FTO Manual, SEG 29, p. 27.',
  },
  taskManagement: {
    definition: 'Evaluates ability to safely and effectively perform multiple police-related tasks simultaneously.',
    reference: 'FTO Manual, SEG 30, p. 27.',
  },
};

export const ACTIVITY_MANUAL_DEFINITIONS: Record<ActivityKey, ManualDefinition> = {
  premierOneReports: {
    definition: 'The total number of incident reports taken during the shift. In this section, do not include Traffic Crash Reports, U-10.100s, or FI reports.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  fiReports: {
    definition: 'The total number of FI reports taken during the shift. Also, if a person is arrested, and the probationary officer transfers custody to another jurisdiction instead of slating, an FI report is generated rather than a PremierOne Report.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  accidentReports: {
    definition: 'The total number of Traffic Crash Reports completed during the shift. Do not count an accident as a PremierOne Report.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  impoundSlips: {
    definition: 'The total number of Impound Slips completed during a shift.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  pcAffidavits: {
    definition: 'The total number of PC Affidavits completed during a shift.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  propertySlips: {
    definition: 'The number of Property Slips completed during a shift. This does not include any other property room forms or requests. The FTO’s name and badge number should be placed on all Property Slips during Field Training.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  trafficStops: {
    definition: 'The number of Non-Traffic Crash stops conducted during the shift to include, motor vehicle, pedestrian and bicycle stops/offenses. Note that motor vehicle stops will be completed on a Traffic Stop form and Pedestrian Stops will be completed on a Self-Initiated Run/Training form.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  trafficCitations: {
    definition: 'The number of traffic citation forms completed, not the number of listed offenses. This includes citations issued for motor vehicle traffic stops, traffic crashes, pedestrian, and bicycle stops.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  solveCitationSummons: noSeparateManualDefinition('Solve Citation/Summons'),
  parkingCitations: {
    definition: 'The number of parking citations completed during a shift.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  firstResponderLetters: {
    definition: 'The total number of First Responder Letters completed during the shift, regardless of the format.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  u10100Reports: {
    definition: 'The number of Arrest Reports completed during the shift. This section does not include PremierOne Offense or Incident Reports.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  arrestProcessForms: {
    definition: 'The Arrest Process form lists tasks that are required to be performed whenever a person is placed under arrest and transported to Headquarters, The Clerk of Courts, a hospital, and/or slated by the FTO/PO.',
    reference: 'FTO Manual, Arrest Process form instructions, p. 103.',
  },
  criminalComplaints: {
    definition: 'The number of Criminal Complaint Forms completed during the shift. This includes Adult misdemeanor and felony, and Juvenile (JU5302/eJU5302) delinquent and unruly complaints.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 33.',
  },
  misdemeanorSummons: {
    definition: 'The number of misdemeanor citations or summonses issued during the shift. These are not counted as misdemeanor arrest since the person was released at scene. The number should represent the number of criminal complaints issued in which the person was provided a court date and not slated.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 34.',
  },
  misdemeanorArrests: {
    definition: 'The number of misdemeanor arrests for both on-view and warrants. Count one arrest for each person arrested, regardless of the number of charges/warrants filed.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 34.',
  },
  felonyPackets: {
    definition: 'The total number of felony packets or Direct Indictment packets completed by the Probationary Officer. Does not to include packets by Detectives.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 34.',
  },
  felonyArrests: {
    definition: 'The number of felony arrests for both on-view and warrant arrests. Includes felony warrants filed for an individual’s arrest. Count one arrest for each person arrested regardless of the number of charges/warrants filed.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 34.',
  },
  dvPackets: {
    definition: 'The number of DV Packets completed during the shift. Packets may be for warrants filed, or on-view arrests. One packet per arrestee.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 34.',
  },
  oviPackets: {
    definition: 'The number of OVI Packets completed during the shift.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 34.',
  },
  prisonersSlated: {
    definition: 'The number of persons arrested and slated. If the person is refused at the jail, it still counts toward the number of prisoners slated.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 34.',
  },
  completedPayouts: noSeparateManualDefinition('Completed Payouts'),
  summonsReissued: noSeparateManualDefinition('Summons Re-issued'),
  suspiciousPersonStops: {
    definition: 'The total number of investigatory stops or consensual encounters (non-traffic related) conducted by the Probationary Officer during the shift.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 35.',
  },
  prisonerSearches: {
    definition: 'The total number of searches of an individual’s person conducted by the Probationary Officer during the shift, to be differentiated from the execution of pat downs.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 35.',
  },
  patDowns: {
    definition: 'The total number of pat downs of an individual’s person conducted by the Probationary Officer during the shift, to be differentiated from the execution of a search.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 35.',
  },
  attemptedWarrantsServed: {
    definition: 'This section is used to count the number of individuals proactively sought out and/or arrested rather than the number of warrants served. This section counts arrests or attempted arrests stemming from dispatched calls for service or self-initiated activity related solely to searching for individuals with active arrest warrants (10-50/10-50A). It is not used to count individuals arrested stemming from other dispatched or self-initiated activities, such as traffic or suspicious person stops.',
    reference: 'FTO Manual, Daily Activity Summary definitions, p. 35.',
  },
  forceDisplays: {
    definition: 'Use of Force — Evaluates ability to apply and utilize trained Action-Response Levels of Control.',
    reference: 'FTO Manual, SEG 31, p. 26.',
  },
  vehicleExtractions: noSeparateManualDefinition('Vehicle Extractions'),
  evo: {
    definition: 'Emergency/Pursuit — Evaluates skills in emergency vehicle operations and in pursuit driving situations. Exercises due regard to other vehicles/citizens.',
    reference: 'FTO Manual, SEG 11, p. 21.',
  },
};
