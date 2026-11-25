export const SUBSTATION_ORIENTATION_SECTIONS=[
  {title:'Substation Orientation',description:'Complete each item during the first day only.',items:[
    ['building_orientation','Building orientation'],['locker_rooms','Locker rooms'],['restrooms','Restroom facilities'],['break_room','Break room'],
    ['vending','Vending machines, microwave, refrigerator'],['vehicle_status_board','Vehicle status board'],
    ['cruiser_keys','Location of cruiser keys'],['relief_car','Explained relief car'],['computer_access','Computer access'],
    ['daily_bulletin','Daily Bulletin'],['bwc_tower','BWC Tower'],['precinct_information','Precinct specific information'],
    ['division_email','Division email'],['paperwork_box','End of shift paperwork in box'],['outgoing_mail','Outgoing mail box'],
    ['subpoena_book','Subpoena sign-out book'],['traffic_citation_book','Acquisition of traffic citation book'],
    ['parking_citation_book','Acquisition of parking citation book'],['radar_laser','Radar and Laser units (location and sign out)'],
    ['taser_location','Location of Taser'],['taser_log','Taser sign-out log'],['taser_spark_test','Proper Taser testing (spark test)'],
    ['taser_belt','Location of Taser properly placed on gun belt'],['shotgun_locker','Location of shotgun locker'],
    ['clearing_barrel','Location of the clearing barrel'],['paperwork_supplies','Location of paperwork and supplies'],
    ['briefcase_clipboard','Briefcase/clipboard setup'],['copier_printer','Location of copier and printer'],
  ]},
  {title:'Inspectional Items',description:'Check the inspectional items listed on the form.',items:[
    ['riot_helmet','Riot helmet with face shield'],['riot_padding','Riot protective padding'],['rain_gear','Raincoat and pants'],
    ['traffic_vest','Traffic control vest'],['tychem','TYCHEM F protective suit (green)'],['tyvek','TYVEK protective suit (white)'],
    ['gas_mask','Gas mask'],['gas_mask_card','Gas mask inspection card'],['mask_filter','One filter for mask'],
    ['rubber_gloves','One pair protective rubber gloves'],['rubber_boots','One pair protective rubber boots'],
    ['chem_tape','One roll Chem tape'],['directives','Division Directives'],['complaint_manual','Criminal Complaint Manual'],
    ['aid_manual','Aid to Enforcement Manual'],
  ]},
  {title:'Cruiser Orientation',description:'Complete each cruiser orientation item.',items:[
    ['cruiser_inspection','Proper inspection of interior and exterior of cruiser'],
    ['prisoner_compartment','Proper inspection of prisoner compartment for contraband/weapons'],['cvs','CVS system'],
    ['shotgun_rack','Shotgun rack/release'],['pa_system','PA system'],['trunk_equipment','Equipment stored in trunk'],
    ['emergency_lights','Location/function of emergency lights/siren switches'],['personal_equipment','Placement of personal equipment'],
    ['seat_belt','Seat belt usage'],
  ]},
  {title:'Communications Orientation',description:'Complete each communications orientation item.',items:[
    ['car_radio','Use of car radio'],['computer','Use of computer'],['walkie','Use of walkie'],['radios','Function and use of radios'],
    ['emergency_banners','Location of emergency banners (cruiser radio, computer, walkie)'],
    ['police_fire','Police-Fire talkgroup'],['car_to_car','Car-to-car communication'],
    ['communications_failure','Emergency operations during communications failure'],['division_computer','Use of Division computer system'],
    ['internet','Internet usage'],['ohleg','OHLEG'],['leads','LEADS'],['courtview','Courtview'],['common_pleas','Common Pleas'],
    ['s_drive','Use of S: drive'],['powerdms','PowerDMS'],['daily_email','Check email daily'],
  ]},
  {title:'Precinct Orientation',description:'Complete each precinct orientation item.',items:[
    ['boundaries','Boundaries'],['cruiser_districts','Cruiser districts'],['directions','Directions'],
    ['major_roads','Major roads and intersections'],['one_way_streets','One-way streets'],['cfd_stations','CFD stations'],
    ['hospitals','Hospitals'],['landmarks','Landmarks'],['schools','Schools'],['adjacent_precincts','Adjacent precincts'],
    ['problem_areas','Known problem areas'],['other_areas','Other areas'],
  ]},
  {title:'Review of Division Directives, SOP, etc. (List)',description:'Complete the review and list the items reviewed.',items:[
    ['review_directives_sop','Review of Division Directives, SOP, etc. (List)'],
  ]},
] as const;

export type SubstationOrientationKey=typeof SUBSTATION_ORIENTATION_SECTIONS[number]['items'][number][0];
export const SUBSTATION_ORIENTATION_KEYS=SUBSTATION_ORIENTATION_SECTIONS.flatMap(section=>section.items.map(([key])=>key)) as SubstationOrientationKey[];
export const defaultSubstationOrientationChecklist=():Record<SubstationOrientationKey,boolean>=>
  Object.fromEntries(SUBSTATION_ORIENTATION_KEYS.map(key=>[key,true])) as Record<SubstationOrientationKey,boolean>;

/** Approved Example B display groups; original persisted task keys are unchanged. */
const COMBINED_ORIENTATION_ROWS = [
  {categoryName:'Building and Facilities',keys:['building_orientation','locker_rooms','restrooms','break_room','vending']},
  {categoryName:'Vehicle Assignment and Keys',keys:['vehicle_status_board','cruiser_keys','relief_car']},
  {categoryName:'Computer Access and Daily Information',keys:['computer_access','daily_bulletin','division_email']},
  {categoryName:'Paperwork, Mail, and Subpoenas',keys:['paperwork_box','outgoing_mail','subpoena_book']},
  {categoryName:'Citation Books',keys:['traffic_citation_book','parking_citation_book']},
  {categoryName:'Paperwork Supplies and Setup',keys:['paperwork_supplies','briefcase_clipboard','copier_printer']},
  {categoryName:'Riot Protection',keys:['riot_helmet','riot_padding']},
  {categoryName:'Rain and Traffic Gear',keys:['rain_gear','traffic_vest']},
  {categoryName:'Protective Suits',keys:['tychem','tyvek']},
  {categoryName:'Chemical Protective Accessories',keys:['rubber_gloves','rubber_boots','chem_tape']},
  {categoryName:'Manuals and Directives',keys:['directives','complaint_manual','aid_manual']},
  {categoryName:'Cruiser Video and PA Systems',keys:['cvs','pa_system']},
  {categoryName:'Cruiser Equipment Storage',keys:['trunk_equipment','personal_equipment']},
  {categoryName:'Radio Communications',keys:['car_radio','walkie','radios','car_to_car']},
  {categoryName:'Computer Systems',keys:['computer','division_computer']},
  {categoryName:'Records Database Access',keys:['ohleg','leads','courtview','common_pleas']},
  {categoryName:'Digital Resources and Email',keys:['internet','s_drive','powerdms','daily_email']},
  {categoryName:'Precinct Boundaries and Districts',keys:['boundaries','cruiser_districts','adjacent_precincts']},
  {categoryName:'Roads and Navigation',keys:['directions','major_roads','one_way_streets']},
  {categoryName:'Community Facilities and Landmarks',keys:['cfd_stations','hospitals','landmarks','schools']},
] as const satisfies readonly {categoryName:string;keys:readonly SubstationOrientationKey[]}[];

export const SUBSTATION_ORIENTATION_GROUPED_SECTIONS = SUBSTATION_ORIENTATION_SECTIONS.map(section => {
  const remaining = new Set<SubstationOrientationKey>(section.items.map(([key]) => key));
  const labels = new Map<SubstationOrientationKey,string>(section.items.map(([key,label]) => [key,label]));
  const rows: {id:string; keys:readonly SubstationOrientationKey[]; label:string; categoryName:string|undefined}[] = [];
  for (const [key] of section.items) {
    if (!remaining.has(key)) continue;
    const group = COMBINED_ORIENTATION_ROWS.find(group => group.keys.some(item => item === key));
    const keys: readonly SubstationOrientationKey[] = group?.keys ?? [key];
    if (keys.some(item => !remaining.has(item))) throw new Error('Orientation groups must partition each section.');
    rows.push({id:key,keys,label:keys.map(item => labels.get(item)).join('; '),categoryName:group?.categoryName});
    keys.forEach(item => remaining.delete(item));
  }
  return {...section,rows};
});

// Screen-only consolidation requested by the user. Keep the original 43 print rows above.
const CATEGORY_ADDITIONAL_TASKS:Partial<Record<SubstationOrientationKey,readonly SubstationOrientationKey[]>>={
  vehicle_status_board:['cruiser_inspection','prisoner_compartment','seat_belt'],
  computer_access:['bwc_tower'],
  riot_helmet:['taser_location','taser_log','taser_spark_test','taser_belt'],
  rubber_gloves:['gas_mask','gas_mask_card','mask_filter'],
  directives:['review_directives_sop'],
  cvs:['emergency_lights'],
  trunk_equipment:['radar_laser','shotgun_locker','clearing_barrel','shotgun_rack'],
  car_radio:['emergency_banners','police_fire','communications_failure'],
  boundaries:['precinct_information','problem_areas','other_areas'],
};
const CATEGORY_DISPLAY_NAMES:Partial<Record<SubstationOrientationKey,string>>={
  vehicle_status_board:'Vehicle Assignment, Keys, and Safety',
  riot_helmet:'Riot Protection and Taser',
  cvs:'Cruiser Video, PA, and Emergency Controls',
};
const originalTaskLabels=new Map<SubstationOrientationKey,string>(
  SUBSTATION_ORIENTATION_SECTIONS.flatMap(section=>section.items.map(([key,label])=>[key,label] as const)),
);

export const SUBSTATION_ORIENTATION_CATEGORIES=COMBINED_ORIENTATION_ROWS.map(group=>{
  const id=group.keys[0];
  const keys:readonly SubstationOrientationKey[]=[...group.keys,...(CATEGORY_ADDITIONAL_TASKS[id]??[])];
  return {id,categoryName:CATEGORY_DISPLAY_NAMES[id]??group.categoryName,keys,label:keys.map(key=>originalTaskLabels.get(key)).join('; ')};
});

export function orientationGroupState(checklist:Readonly<Record<string,boolean>>, keys:readonly SubstationOrientationKey[]) {
  const count = keys.filter(key => checklist[key] !== false).length;
  return {checked:count === keys.length, indeterminate:count > 0 && count < keys.length};
}

export function setOrientationGroup(checklist:Readonly<Record<string,boolean>>, keys:readonly SubstationOrientationKey[], checked:boolean):Record<string,boolean> {
  const next = {...checklist};
  keys.forEach(key => { next[key] = checked; });
  return next;
}
