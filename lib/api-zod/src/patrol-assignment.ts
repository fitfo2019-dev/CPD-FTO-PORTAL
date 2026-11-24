import { z } from "zod";

// Existing verified Columbus geography. Tactical identifiers never supply or
// override this hierarchy: in particular, 80C-* does not imply Precinct 8.
export const CPD_GEOGRAPHY = [
  { zone: "1", precincts: [
    { precinct: "1", cruiserDistricts: ["10","11","12","13","14","9010","9011"] },
    { precinct: "6", cruiserDistricts: ["60","61","62","63","64","9060","9061"] },
    { precinct: "18", cruiserDistricts: ["180","181","182","183","184","9180","9181"] },
  ] },
  { zone: "2", precincts: [
    { precinct: "9", cruiserDistricts: ["90","91","92","93","94","9090","9091"] },
    { precinct: "14", cruiserDistricts: ["140","141","142","143","144","9140","9141"] },
    { precinct: "20", cruiserDistricts: ["200","201","202","203","204","9200","9201","9202"] },
  ] },
  { zone: "3", precincts: [
    { precinct: "8", cruiserDistricts: ["80","81","82","83","84","9080","9081"] },
    { precinct: "10", cruiserDistricts: ["100","101","102","103","104","105","9100","9101","9102"] },
    { precinct: "15", cruiserDistricts: ["150","151","152","153","154","9150","9151"] },
    { precinct: "19", cruiserDistricts: ["190","191","192","193","194","9190","9191"] },
  ] },
  { zone: "4", precincts: [
    { precinct: "3", cruiserDistricts: ["30","31","32","33","34","9030","9031"] },
    { precinct: "4", cruiserDistricts: ["40","41","42","43","44","9040","9041","9042"] },
    { precinct: "17", cruiserDistricts: ["170","171","172","173","174","9170","9171"] },
  ] },
  { zone: "5", precincts: [
    { precinct: "11", cruiserDistricts: ["110","111","112","113","114","9110","9111"] },
    { precinct: "12", cruiserDistricts: ["120","121","122","123","124","9120","9121","9122"] },
    { precinct: "13", cruiserDistricts: ["130","131","132","133","134","9130"] },
    { precinct: "16", cruiserDistricts: ["160","161","162","163","164","165","9160","9161"] },
  ] },
  { zone: "6", precincts: [
    { precinct: "2", cruiserDistricts: ["20","21","22","23","24","9020","9021"] },
    { precinct: "5", cruiserDistricts: ["50","51","52","53","54","9050","9051"] },
    { precinct: "7", cruiserDistricts: ["70","71","72","73","74","9070","9071"] },
  ] },
] as const;

export const TACTICAL_CALL_SIGNS = ["80C-1", "80C-2"] as const;
export const isTacticalCallSign = (value: unknown): value is typeof TACTICAL_CALL_SIGNS[number] =>
  typeof value === "string" && TACTICAL_CALL_SIGNS.some(code => code === value);

type PrecinctEntry = { readonly precinct: string; readonly cruiserDistricts: readonly string[] };
export const cpdPrecinctsForZone = (zone: string): readonly PrecinctEntry[] =>
  CPD_GEOGRAPHY.find(item => item.zone === zone)?.precincts ?? [];
export const cpdDistrictsForPrecinct = (zone: string, precinct: string): readonly string[] =>
  cpdPrecinctsForZone(zone).find(item => item.precinct === precinct)?.cruiserDistricts ?? [];
const isMidwatch = (shift: string) => shift === "DMW" || shift === "EMW";
const isCompany = (shift: string) => ["A-Co","B-Co","C-Co"].includes(shift);
const precinctWagonNumber = (zone: string, precinct: string) =>
  cpdPrecinctsForZone(zone).some(item => item.precinct === precinct) ? `${precinct}8` : undefined;

export const ftoAssignmentSuffixesForShift = (shift: string): string[] =>
  ({ DMW:["D1","D2"], EMW:["E1","E2"], "A-Co":["A"], "B-Co":["B"], "C-Co":["C"] }[shift] ?? []);
const districtsForShift = (zone: string, precinct: string, shift: string) =>
  cpdDistrictsForPrecinct(zone, precinct).filter(district =>
    isMidwatch(shift) ? district.startsWith("9") : isCompany(shift) && !district.startsWith("9"));

export function isValidAssignment(zone: string, precinct: string, district: string, shift?: string): boolean {
  if (cpdDistrictsForPrecinct(zone, precinct).includes(district)) {
    if (shift && (isMidwatch(shift) || isCompany(shift))) return district.startsWith("9") === isMidwatch(shift);
    return true; // Historical records without a mapped modern shift remain readable.
  }
  return (!shift || isCompany(shift)) && precinctWagonNumber(zone, precinct) === district;
}

export function cruiserDistrictForFtoAssignment(
  zone: string, precinct: string, assignment: string, shift: string, explicitDistrict?: string,
): string | undefined {
  if (isTacticalCallSign(assignment)) {
    // Tactical call-sign and official cruiser district are separate data.
    return shift === "C-Co" && explicitDistrict &&
      cpdDistrictsForPrecinct(zone, precinct).includes(explicitDistrict) &&
      !explicitDistrict.startsWith("9") ? explicitDistrict : undefined;
  }
  const district = districtsForShift(zone, precinct, shift).find(value =>
    ftoAssignmentSuffixesForShift(shift).some(suffix => (isMidwatch(shift)
      ? [`${value}${suffix}`]
      : [`${value}${suffix}`,`${value}${suffix}1`,`${value}${suffix}2`]).includes(assignment)));
  if (district) return district;
  const wagon = precinctWagonNumber(zone, precinct);
  return wagon && isCompany(shift) && ftoAssignmentSuffixesForShift(shift).some(suffix =>
    [1,2].some(seat => `${wagon}${suffix}${seat}` === assignment)) ? wagon : undefined;
}

export function ftoAssignmentsForPrecinct(zone: string, precinct: string, shift: string, explicitDistrict?: string): string[] {
  const districts = districtsForShift(zone, precinct, shift);
  const suffixes = ftoAssignmentSuffixesForShift(shift);
  if (isMidwatch(shift)) return districts.flatMap(district => suffixes.map(suffix => `${district}${suffix}`));
  const base = districts.flatMap(district => suffixes.map(suffix => `${district}${suffix}`));
  const seats = districts.flatMap(district => suffixes.flatMap(suffix => [`${district}${suffix}1`,`${district}${suffix}2`]));
  const wagon = precinctWagonNumber(zone, precinct);
  const wagons = wagon ? suffixes.flatMap(suffix => [1,2].map(seat => `${wagon}${suffix}${seat}`)) : [];
  const tactical = TACTICAL_CALL_SIGNS.filter(code => cruiserDistrictForFtoAssignment(zone, precinct, code, shift, explicitDistrict));
  return [...base, ...seats, ...wagons, ...tactical];
}

export function assignmentFromPrecinctAndDistrict(precinct: string, cruiserDistrict: string) {
  const zone = CPD_GEOGRAPHY.find(item => item.precincts.some(entry =>
    entry.precinct === precinct && entry.cruiserDistricts.some(district => district === cruiserDistrict)));
  return zone ? { zone: zone.zone, precinct, cruiserDistrict } : undefined;
}

export const PatrolAssignmentMetadataSchema = z.object({
  zone: z.string().min(1),
  precinct: z.string().min(1),
  cruiserDistrict: z.string().min(1),
  shift: z.enum(["A-Co","B-Co","C-Co","DMW","EMW"]),
  ftoAssignment: z.string().min(1).optional(),
}).superRefine((value, context) => {
  if (!isValidAssignment(value.zone, value.precinct, value.cruiserDistrict, value.shift)) {
    context.addIssue({ code:"custom", path:["cruiserDistrict"], message:"Cruiser district must match the selected zone, precinct, and shift." });
  }
  if (value.ftoAssignment && cruiserDistrictForFtoAssignment(value.zone, value.precinct,
    value.ftoAssignment, value.shift, value.cruiserDistrict) !== value.cruiserDistrict) {
    context.addIssue({ code:"custom", path:["ftoAssignment"], message:"Call-sign must match the separately recorded patrol geography and shift." });
  }
});
export type PatrolAssignmentMetadata = z.infer<typeof PatrolAssignmentMetadataSchema>;
