import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  CPD_GEOGRAPHY, CatalogFtoAssignmentSelectionSchema,
  FTO_ASSIGNMENT_COMPANIES, FTO_ASSIGNMENT_DISTRICT_CARDS,
  FTO_ASSIGNMENT_MIDWATCHES, FTO_ASSIGNMENT_SIDES,
  TACTICAL_CALL_SIGNS, canonicalFtoAssignmentsForPrecinct,
  cruiserDistrictForFtoAssignment, isValidFtoAssignment,
} from "./cpd-geography.js";
import { parseRosterFile, parseRosterRows } from "./assignment-import.js";
import { OperationalAssignmentToken } from "@workspace/api-zod/operational-profile";

const confirmedZoneMap: Record<string, string[]> = {
  "1": ["1", "6", "18"],
  "2": ["9", "14", "20"],
  "3": ["8", "10", "15", "19"],
  "4": ["3", "4", "17"],
  "5": ["11", "12", "13", "16"],
  "6": ["2", "5", "7"],
};

test("catalog source retains the confirmed six-zone, twenty-precinct mapping", () => {
  assert.deepEqual(Object.fromEntries(CPD_GEOGRAPHY.map(zone =>
    [zone.zone, zone.precincts.map(item => item.precinct)])), confirmedZoneMap);
  assert.deepEqual(FTO_ASSIGNMENT_DISTRICT_CARDS, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(FTO_ASSIGNMENT_SIDES, ["-1", "-2"]);
});

test("catalog generates exact unique options for every precinct and watch", () => {
  for (const [zone, precincts] of Object.entries(confirmedZoneMap)) {
    for (const precinct of precincts) {
      for (const { shift, code } of FTO_ASSIGNMENT_COMPANIES) {
        const options = canonicalFtoAssignmentsForPrecinct(zone, precinct, shift);
        const canonical = options.filter(item => !TACTICAL_CALL_SIGNS.includes(item as typeof TACTICAL_CALL_SIGNS[number]));
        assert.equal(new Set(options).size, options.length, `${zone}/${precinct}/${shift} has no duplicates`);
        assert.equal(canonical.length, 14 - (precinct === "8" && code === "C" ? 2 : 0),
          `${zone}/${precinct}/${shift} includes six cards and one PTV`);
        for (let card = 0; card <= 5; card++) {
          for (const side of FTO_ASSIGNMENT_SIDES) {
            assert.ok(options.includes(`${precinct}${card}${code}${side}`));
          }
        }
        for (const side of FTO_ASSIGNMENT_SIDES) assert.ok(options.includes(`${precinct}8${code}${side}`));
        for (const universal of TACTICAL_CALL_SIGNS) assert.ok(options.includes(universal));
      }
      for (const { shift, code } of FTO_ASSIGNMENT_MIDWATCHES) {
        const options = canonicalFtoAssignmentsForPrecinct(zone, precinct, shift);
        const canonical = options.filter(item => !TACTICAL_CALL_SIGNS.includes(item as typeof TACTICAL_CALL_SIGNS[number]));
        assert.equal(new Set(options).size, options.length, `${zone}/${precinct}/${shift} has no duplicates`);
        assert.equal(canonical.length, 12);
        for (let card = 0; card <= 5; card++) {
          const district = `9${`${precinct}${card}`.padStart(3, "0")}`;
          for (const side of FTO_ASSIGNMENT_SIDES) {
            assert.ok(options.includes(`${district}${code}${side}`));
          }
        }
        assert.ok(options.every(value => !value.startsWith(`${precinct}8`)), "midwatch never includes a PTV");
        for (const universal of TACTICAL_CALL_SIGNS) assert.ok(options.includes(universal));
      }
    }
  }
  assert.deepEqual(canonicalFtoAssignmentsForPrecinct("6", "5", "A-Co").slice(0, 12),
    ["50A-1", "50A-2", "51A-1", "51A-2", "52A-1", "52A-2", "53A-1", "53A-2", "54A-1", "54A-2", "55A-1", "55A-2"]);
  assert.ok(canonicalFtoAssignmentsForPrecinct("6", "5", "A-Co").includes("58A-1"));
  assert.ok(canonicalFtoAssignmentsForPrecinct("6", "5", "DMW").includes("9050D-1"));
  assert.ok(canonicalFtoAssignmentsForPrecinct("6", "5", "DMW").includes("9055D-2"));
  assert.ok(canonicalFtoAssignmentsForPrecinct("5", "12", "DMW").includes("9120D-1"));
  assert.ok(canonicalFtoAssignmentsForPrecinct("5", "12", "DMW").includes("9125D-2"));
  assert.ok(!canonicalFtoAssignmentsForPrecinct("5", "12", "DMW").some(value => value.startsWith("9512")));
  assert.ok(canonicalFtoAssignmentsForPrecinct("2", "20", "EMW").includes("9200E-1"));
  assert.ok(canonicalFtoAssignmentsForPrecinct("2", "20", "EMW").includes("9205E-2"));
});

test("contextual Zod validation rejects malformed, wrong-area, wrong-watch, and wrong-side values", () => {
  const valid = { zone: "6", precinct: "5", shift: "DMW" as const, ftoAssignment: "9055D-2" };
  assert.equal(CatalogFtoAssignmentSelectionSchema.safeParse(valid).success, true);
  assert.equal(CatalogFtoAssignmentSelectionSchema.safeParse({ ...valid, ftoAssignment: "9050D-1" }).success, true);
  for (const ftoAssignment of ["9055D-3", "9055D", "9055A-1", "9055E-1", "9555D-1", "58D-1"]) {
    assert.equal(CatalogFtoAssignmentSelectionSchema.safeParse({ ...valid, ftoAssignment }).success, false, ftoAssignment);
  }
  assert.equal(CatalogFtoAssignmentSelectionSchema.safeParse({ ...valid, precinct: "7" }).success, false);
  assert.equal(CatalogFtoAssignmentSelectionSchema.safeParse({ ...valid, zone: "2", precinct: "5" }).success, false);
  assert.equal(CatalogFtoAssignmentSelectionSchema.safeParse({ ...valid, shift: "A-Co", ftoAssignment: "9055D-2" }).success, false);
  assert.equal(canonicalFtoAssignmentsForPrecinct("6", "99", "A-Co").length, 0);
  assert.equal(canonicalFtoAssignmentsForPrecinct("6", "5", "unknown").length, 0);
});

test("shared metadata and roster import accept catalog choices without rewriting legacy codes", () => {
  const rows = (assignment: string, shift: string, zone: string, precinct: string, district: string) => [
    ["Class", "PO Name", "PO Badge", "FTO Name", "FTO Badge", "Start Date", "Shift", "Days Off", "Zone", "Precinct", "Cruiser District", "FTO Assignment"],
    ["Class 27-A", "Officer Example", "0071", "Trainer Example", "0020", "03/09/2027", shift, shift === "DMW" || shift === "EMW" ? "Sunday;Monday;Tuesday" : "Sunday;Saturday", zone, precinct, district, assignment],
  ];
  for (const [assignment, shift, zone, precinct, district] of [
    ["55A-1", "A-Co", "6", "5", "55"],
    ["58C-2", "C-Co", "6", "5", "58"],
    ["9125D-1", "DMW", "5", "12", "9125"],
    ["9200E-2", "EMW", "2", "20", "9200"],
  ]) {
    assert.equal(isValidFtoAssignment(zone, precinct, assignment, shift, district), true);
    assert.equal(cruiserDistrictForFtoAssignment(zone, precinct, assignment, shift), district);
    const parsed = parseRosterRows(rows(assignment, shift, zone, precinct, district));
    assert.deepEqual(parsed.errors, [], assignment);
    assert.equal(parsed.assignments[0]?.ftoAssignment, assignment);
    assert.equal(parsed.assignments[0]?.cruiserDistrict, district);
  }
  assert.equal(isValidFtoAssignment("6", "5", "55A-1", "B-Co", "55"), false);
  assert.equal(isValidFtoAssignment("6", "5", "55A-3", "A-Co", "55"), false);

  const old = parseRosterRows(rows("50A1", "A-Co", "6", "5", "50"));
  assert.deepEqual(old.errors, []);
  assert.equal(old.assignments[0]?.ftoAssignment, "50A1");
});

test("Excel roster-file validation accepts catalog values and rejects wrong precincts", async () => {
  const headers = ["Class", "PO Name", "PO Badge", "FTO Name", "FTO Badge", "Start Date", "Shift", "Days Off", "Zone", "Precinct", "Cruiser District", "FTO Assignment"];
  const row = ["Class 27-A", "Officer Example", "0071", "Trainer Example", "0020", "03/09/2027", "EMW", "Sunday;Monday;Tuesday", "2", "20", "9205", "9205E-2"];
  const toFile = (assignment: string) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, [...row.slice(0, -1), assignment]]), "Roster");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    return new File([bytes], "roster.xlsx");
  };

  const valid = await parseRosterFile(toFile("9205E-2"));
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.assignments[0]?.ftoAssignment, "9205E-2");

  const invalid = await parseRosterFile(toFile("9206E-2"));
  assert.equal(invalid.assignments.length, 0);
  assert.ok(invalid.errors.some(error => error.includes("FTO assignment must match")));
});

test("operational profile validation remains a separate consumer from roster import", () => {
  assert.equal(OperationalAssignmentToken.safeParse("9150E-1").success, true);
  assert.equal(OperationalAssignmentToken.safeParse("50A-1").success, false);
  const roster = parseRosterRows([
    ["Class", "PO Name", "PO Badge", "FTO Name", "FTO Badge", "Start Date", "Shift", "Days Off", "Zone", "Precinct", "Cruiser District", "FTO Assignment", "FTO Operational Assignment"],
    ["Class 27-A", "Officer Example", "0071", "Trainer Example", "0020", "03/09/2027", "EMW", "Sunday;Monday;Tuesday", "3", "15", "9150", "9150E-1", "9150E-1"],
  ]);
  assert.deepEqual(roster.errors, []);
  assert.equal(roster.assignments[0]?.ftoAssignment, "9150E-1");
  assert.equal(roster.assignments[0]?.poOperationalAssignmentToken, undefined);
  assert.equal(roster.ftos[0]?.operationalAssignmentToken, "9150E-1");
});
