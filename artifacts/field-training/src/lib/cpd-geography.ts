// Official City of Columbus public GIS cruiser-district snapshot, checked 2026-11-18.
// Zone/precinct grouping cross-checked against the 2025 Columbus Division of Police Annual Report.
export const CPD_GEOGRAPHY = [
  {
    "zone": "1",
    "precincts": [
      {
        "precinct": "1",
        "cruiserDistricts": [
          "10",
          "11",
          "12",
          "13",
          "14",
          "9010",
          "9011"
        ]
      },
      {
        "precinct": "6",
        "cruiserDistricts": [
          "60",
          "61",
          "62",
          "63",
          "64",
          "9060",
          "9061"
        ]
      },
      {
        "precinct": "18",
        "cruiserDistricts": [
          "180",
          "181",
          "182",
          "183",
          "184",
          "9180",
          "9181"
        ]
      }
    ]
  },
  {
    "zone": "2",
    "precincts": [
      {
        "precinct": "9",
        "cruiserDistricts": [
          "90",
          "91",
          "92",
          "93",
          "94",
          "9090",
          "9091"
        ]
      },
      {
        "precinct": "14",
        "cruiserDistricts": [
          "140",
          "141",
          "142",
          "143",
          "144",
          "9140",
          "9141"
        ]
      },
      {
        "precinct": "20",
        "cruiserDistricts": [
          "200",
          "201",
          "202",
          "203",
          "204",
          "9200",
          "9201",
          "9202"
        ]
      }
    ]
  },
  {
    "zone": "3",
    "precincts": [
      {
        "precinct": "8",
        "cruiserDistricts": [
          "80",
          "81",
          "82",
          "83",
          "84",
          "9080",
          "9081"
        ]
      },
      {
        "precinct": "10",
        "cruiserDistricts": [
          "100",
          "101",
          "102",
          "103",
          "104",
          "105",
          "9100",
          "9101",
          "9102"
        ]
      },
      {
        "precinct": "15",
        "cruiserDistricts": [
          "150",
          "151",
          "152",
          "153",
          "154",
          "9150",
          "9151"
        ]
      },
      {
        "precinct": "19",
        "cruiserDistricts": [
          "190",
          "191",
          "192",
          "193",
          "194",
          "9190",
          "9191"
        ]
      }
    ]
  },
  {
    "zone": "4",
    "precincts": [
      {
        "precinct": "3",
        "cruiserDistricts": [
          "30",
          "31",
          "32",
          "33",
          "34",
          "9030",
          "9031"
        ]
      },
      {
        "precinct": "4",
        "cruiserDistricts": [
          "40",
          "41",
          "42",
          "43",
          "44",
          "9040",
          "9041",
          "9042"
        ]
      },
      {
        "precinct": "17",
        "cruiserDistricts": [
          "170",
          "171",
          "172",
          "173",
          "174",
          "9170",
          "9171"
        ]
      }
    ]
  },
  {
    "zone": "5",
    "precincts": [
      {
        "precinct": "11",
        "cruiserDistricts": [
          "110",
          "111",
          "112",
          "113",
          "114",
          "9110",
          "9111"
        ]
      },
      {
        "precinct": "12",
        "cruiserDistricts": [
          "120",
          "121",
          "122",
          "123",
          "124",
          "9120",
          "9121",
          "9122"
        ]
      },
      {
        "precinct": "13",
        "cruiserDistricts": [
          "130",
          "131",
          "132",
          "133",
          "134",
          "9130"
        ]
      },
      {
        "precinct": "16",
        "cruiserDistricts": [
          "160",
          "161",
          "162",
          "163",
          "164",
          "165",
          "9160",
          "9161"
        ]
      }
    ]
  },
  {
    "zone": "6",
    "precincts": [
      {
        "precinct": "2",
        "cruiserDistricts": [
          "20",
          "21",
          "22",
          "23",
          "24",
          "9020",
          "9021"
        ]
      },
      {
        "precinct": "5",
        "cruiserDistricts": [
          "50",
          "51",
          "52",
          "53",
          "54",
          "9050",
          "9051"
        ]
      },
      {
        "precinct": "7",
        "cruiserDistricts": [
          "70",
          "71",
          "72",
          "73",
          "74",
          "9070",
          "9071"
        ]
      }
    ]
  }
] as const;

export const CPD_GEOGRAPHY_SOURCES = {
  annualReport: "https://www.columbus.gov/files/sharedassets/city/v/1/public-safety/police/reports/2025annualreport.pdf",
  cruiserDistricts: "https://opendata.columbus.gov/datasets/police-cruiser-districts/about",
  precincts: "https://opendata.columbus.gov/datasets/police-precincts/about",
  organization: "https://www.columbus.gov/Services/Public-Safety/Police/About-the-Columbus-Division-of-Police/Organizational-Structure",
  cruiserDistrictMap: "https://opendata.columbus.gov/datasets/police-cruiser-districts/explore"
} as const;

type PrecinctEntry = { readonly precinct: string; readonly cruiserDistricts: readonly string[] };

export const cpdPrecinctsForZone = (zone: string): readonly PrecinctEntry[] => {
  const item = CPD_GEOGRAPHY.find((candidate) => candidate.zone === zone);
  return item ? item.precincts : [];
};

export const cpdDistrictsForPrecinct = (zone: string, precinct: string) =>
  cpdPrecinctsForZone(zone).find((item) => item.precinct === precinct)?.cruiserDistricts ?? [];

export const ftoAssignmentSuffixesForShift = (shift: string) => {
  if (shift === 'DMW') return ['D1', 'D2'];
  if (shift === 'EMW') return ['E1', 'E2'];
  if (shift === 'A-Co') return ['A'];
  if (shift === 'B-Co') return ['B'];
  if (shift === 'C-Co') return ['C'];
  return [];
};

const isMidwatch = (shift:string) => shift === 'DMW' || shift === 'EMW';
const precinctWagonNumber = (zone:string,precinct:string) =>
  cpdPrecinctsForZone(zone).some(item=>item.precinct===precinct) ? `${precinct}8` : undefined;

const ftoCruiserDistrictsForShift = (zone: string, precinct: string, shift: string) => {
  const districts = cpdDistrictsForPrecinct(zone, precinct);
  if (shift === 'DMW' || shift === 'EMW') return districts.filter(district => district.startsWith('9'));
  if (shift === 'A-Co' || shift === 'B-Co' || shift === 'C-Co') return districts.filter(district => !district.startsWith('9'));
  return [];
};

export const ftoAssignmentsForPrecinct = (zone: string, precinct: string, shift: string) => {
  const districts=ftoCruiserDistrictsForShift(zone, precinct, shift);
  if(isMidwatch(shift))return districts.flatMap(district=>ftoAssignmentSuffixesForShift(shift).map(suffix=>`${district}${suffix}`));
  const suffixes=ftoAssignmentSuffixesForShift(shift);
  const districtAssignments=districts.flatMap(district=>suffixes.map(suffix=>`${district}${suffix}`));
  const twoOfficerAssignments=districts.flatMap(district=>suffixes.flatMap(suffix=>[`${district}${suffix}1`,`${district}${suffix}2`]));
  const wagon=precinctWagonNumber(zone,precinct);
  if(!wagon)return [...districtAssignments,...twoOfficerAssignments];
  const wagonAssignments=suffixes.flatMap(suffix=>[1,2].map(seat=>`${wagon}${suffix}${seat}`));
  return [...districtAssignments,...twoOfficerAssignments,...wagonAssignments];
};

export const cruiserDistrictForFtoAssignment = (zone: string, precinct: string, assignment: string, shift: string) => {
  const district=ftoCruiserDistrictsForShift(zone, precinct, shift).find(district =>
    ftoAssignmentSuffixesForShift(shift).some(suffix =>
      isMidwatch(shift)
        ? `${district}${suffix}`===assignment
        : [`${district}${suffix}`,`${district}${suffix}1`,`${district}${suffix}2`].includes(assignment),
    ),
  );
  if(district)return district;
  const wagon=precinctWagonNumber(zone,precinct);
  if(!wagon||isMidwatch(shift))return undefined;
  return ftoAssignmentSuffixesForShift(shift).some(suffix=>[1,2].some(seat=>`${wagon}${suffix}${seat}`===assignment))
    ?wagon
    :undefined;
};

export const isValidAssignment = (zone: string, precinct: string, cruiserDistrict: string, shift?:string) =>
  cpdDistrictsForPrecinct(zone, precinct).some((district) => district === cruiserDistrict)
  ||((!shift||!isMidwatch(shift))&&precinctWagonNumber(zone,precinct)===cruiserDistrict);

export function assignmentFromPrecinctAndDistrict(precinct: string, cruiserDistrict: string) {
  for (const zone of CPD_GEOGRAPHY) {
    const match = zone.precincts.find((item) => item.precinct === precinct && item.cruiserDistricts.some((district) => district === cruiserDistrict));
    if (match) return { zone: zone.zone, precinct: match.precinct, cruiserDistrict };
  }
  return undefined;
}
