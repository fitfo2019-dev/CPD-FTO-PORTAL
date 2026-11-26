export interface CpdSubstation {
  id: string;
  address: string;
  city: string;
  zip: string;
  phone: string;
  precincts: number[];
  midwatchZones: number[];
}

// Midwatch zones follow the Field Training Office substation address sheet.
export const CPD_SUBSTATIONS: CpdSubstation[] = [
  { id:'1', address:'8118 Sancus Blvd.', city:'Westerville, OH', zip:'43081', phone:'(614) 645-4317', precincts:[1], midwatchZones:[1] },
  { id:'2', address:'2077 Parkwood Ave.', city:'Columbus, OH', zip:'43219', phone:'(614) 724-0927', precincts:[2], midwatchZones:[] },
  { id:'3', address:'5400 Olentangy River Rd.', city:'Columbus, OH', zip:'43235', phone:'(614) 645-6922', precincts:[3,17], midwatchZones:[] },
  { id:'4', address:'248 E. 11th Ave.', city:'Columbus, OH', zip:'43201', phone:'(614) 645-4921', precincts:[4], midwatchZones:[] },
  { id:'5', address:'1371 Cleveland Ave.', city:'Columbus, OH', zip:'43211', phone:'(614) 645-4837', precincts:[5], midwatchZones:[6] },
  { id:'6', address:'5030 Ulry Rd.', city:'Westerville, OH', zip:'43081', phone:'(614) 645-4924', precincts:[6], midwatchZones:[] },
  { id:'7', address:'1475 Granville St.', city:'Columbus, OH', zip:'43203', phone:'(614) 645-4534', precincts:[7], midwatchZones:[] },
  { id:'8', address:'333 W. Town St.', city:'Columbus, OH', zip:'43215', phone:'(614) 645-2570', precincts:[8,16], midwatchZones:[] },
  { id:'9', address:'3022 Winchester Pk.', city:'Columbus, OH', zip:'43232', phone:'(614) 645-4834', precincts:[9], midwatchZones:[2] },
  { id:'10', address:'4215 Clime Rd.', city:'Columbus, OH', zip:'43228', phone:'(614) 645-4561', precincts:[10], midwatchZones:[3] },
  { id:'11', address:'950 E. Main St.', city:'Columbus, OH', zip:'43205', phone:'(614) 645-4224', precincts:[11,12], midwatchZones:[] },
  { id:'12', address:'950 E. Main St.', city:'Columbus, OH', zip:'43205', phone:'(614) 645-4839', precincts:[11,12], midwatchZones:[] },
  { id:'13', address:'544 Woodrow Ave.', city:'Columbus, OH', zip:'43207', phone:'(614) 645-4500', precincts:[13], midwatchZones:[5] },
  { id:'14', address:'2500 Park Crescent Dr.', city:'Columbus, OH', zip:'43232', phone:'(614) 645-0914', precincts:[14,20], midwatchZones:[] },
  { id:'15', address:'1000 N. Hague Ave.', city:'Columbus, OH', zip:'43204', phone:'(614) 645-4715', precincts:[15], midwatchZones:[] },
  { id:'16', address:'333 W. Town St.', city:'Columbus, OH', zip:'43215', phone:'(614) 645-2570', precincts:[8,16], midwatchZones:[] },
  { id:'17', address:'5400 Olentangy River Rd.', city:'Columbus, OH', zip:'43235', phone:'(614) 645-6922', precincts:[3,17], midwatchZones:[] },
  { id:'18', address:'1120 Morse Rd.', city:'Columbus, OH', zip:'43229', phone:'(614) 645-4510', precincts:[18], midwatchZones:[] },
  { id:'19', address:'2070 Sullivant Ave.', city:'Columbus, OH', zip:'43223', phone:'(614) 645-4597', precincts:[19], midwatchZones:[] },
  { id:'20', address:'2500 Park Crescent Dr.', city:'Columbus, OH', zip:'43232', phone:'(614) 645-0914', precincts:[14,20], midwatchZones:[] },
  { id:'Z4MW', address:'743 W. 3rd Ave.', city:'Columbus, OH', zip:'43212', phone:'', precincts:[], midwatchZones:[4] },
];

export const CPD_SUBSTATION_DIRECTORY_URL = 'https://www.columbus.gov/Services/Public-Safety/Police/Find-a-Police-Substation-Location';
export const CPD_SUBSTATION_COVERAGE_URL = 'https://maps2.columbus.gov/arcgis/rest/services/Applications/Neighborhood/MapServer/9';

export function defaultSubstationForAssignment(input: { shift?: string; zone?: string; precinct?: string }) {
  if (input.shift === 'DMW' || input.shift === 'EMW') {
    const zone = Number(input.zone);
    return CPD_SUBSTATIONS.find(station => station.midwatchZones.includes(zone))?.id ?? '';
  }
  const precinct = Number(input.precinct);
  return CPD_SUBSTATIONS.find(station => station.id === String(precinct) && station.precincts.includes(precinct))?.id ?? '';
}

export function getSubstation(id: string) {
  const text = String(id).trim();
  if (/^(?:z(?:one)?\s*4\s*(?:mw|midwatch))$/i.test(text)) return CPD_SUBSTATIONS.find(station => station.id === 'Z4MW');
  const normalized = text.match(/^(?:substation\s*)?(\d{1,2})$/i)?.[1];
  return normalized ? CPD_SUBSTATIONS.find(station => station.id === normalized) : undefined;
}

export function substationName(station: CpdSubstation) {
  return station.id === 'Z4MW' ? 'Zone 4 Midwatch' : `Substation ${station.id}`;
}

export function substationDisplay(id: string, options: { phone?: boolean } = {}) {
  const station = getSubstation(id);
  return station
    ? [substationName(station), `${station.address}, ${station.city} ${station.zip}`, options.phone === false ? '' : station.phone].filter(Boolean).join(' · ')
    : id || 'Not recorded';
}
