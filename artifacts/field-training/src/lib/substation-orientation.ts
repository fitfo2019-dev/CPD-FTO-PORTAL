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
