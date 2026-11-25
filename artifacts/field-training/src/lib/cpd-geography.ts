// Shared validation is used by onboarding, imports, local records and the API.
export {
  CPD_GEOGRAPHY, TACTICAL_CALL_SIGNS, isTacticalCallSign,
  FTO_ASSIGNMENT_DISTRICT_CARDS, FTO_ASSIGNMENT_SIDES,
  FTO_ASSIGNMENT_COMPANIES, FTO_ASSIGNMENT_MIDWATCHES,
  UNIVERSAL_FTO_ASSIGNMENTS, isUniversalFtoAssignment,
  cpdPrecinctsForZone, cpdDistrictsForPrecinct, ftoAssignmentSuffixesForShift,
  ftoAssignmentsForPrecinct, canonicalFtoAssignmentsForPrecinct, CatalogFtoAssignmentSelectionSchema,
  ftoCruiserDistrictsForShift,
  cruiserDistrictForFtoAssignment, isValidFtoAssignment, isValidAssignment,
  assignmentFromPrecinctAndDistrict, PatrolAssignmentMetadataSchema,
  type PatrolAssignmentMetadata,
} from "@workspace/api-zod/patrol-assignment";

export const CPD_GEOGRAPHY_SOURCES = {
  annualReport: "https://www.columbus.gov/files/sharedassets/city/v/1/public-safety/police/reports/2025annualreport.pdf",
  cruiserDistricts: "https://opendata.columbus.gov/datasets/police-cruiser-districts/about",
  precincts: "https://opendata.columbus.gov/datasets/police-precincts/about",
  organization: "https://www.columbus.gov/Services/Public-Safety/Police/About-the-Columbus-Division-of-Police/Organizational-Structure",
  cruiserDistrictMap: "https://opendata.columbus.gov/datasets/police-cruiser-districts/explore",
} as const;
