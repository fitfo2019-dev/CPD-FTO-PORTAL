import { z } from "zod/v4";

/** CAD district/shift identity is not a physical fleet number or roster authority. */
export const OperationalAssignmentToken = z.string().regex(/^[0-9]{4}[A-Z](?:-[12])?$/,
  "Use four district digits, an uppercase shift letter, and optional side -1 or -2.");
export const OperationalCadUnit = z.string().regex(/^[0-9]{4}[A-Z]$/,
  "CAD identifiers do not include a division-internal side.");
export function parseOperationalIdentity(value: unknown) {
  const assignmentToken = OperationalAssignmentToken.parse(value);
  return {
    assignmentToken, districtToken: assignmentToken.slice(0, 4),
    cadUnit: assignmentToken.slice(0, 5), company: assignmentToken[4]!,
    ...(assignmentToken.length === 7 ? { side: assignmentToken[6] as "1" | "2" } : {}),
  };
}
export const OperationalIdentitySnapshot = z.object({
  assignmentToken: OperationalAssignmentToken,
  districtToken: z.string().optional(),
  // Retained only to read historical snapshots without rewriting their JSON.
  cruiserNumber: z.string().optional(),
  cadUnit: z.string(), company: z.string(), side: z.enum(["1", "2"]).optional(),
}).strict().superRefine((value, ctx) => {
  const expected = parseOperationalIdentity(value.assignmentToken);
  const legacy = value.districtToken === undefined && value.assignmentToken.length === 7
    && value.cruiserNumber === expected.districtToken && value.cadUnit === value.assignmentToken.slice(0, 5);
  // Former full-unit CAD derivations remain readable in frozen packet JSON.
  const formerFullUnit = value.districtToken === expected.districtToken
    && value.cruiserNumber === undefined && value.cadUnit === value.assignmentToken;
  for (const key of ["districtToken", "cadUnit", "company", "side"] as const) {
    const wanted = formerFullUnit && key === "cadUnit" ? value.assignmentToken
      : legacy && key === "cadUnit" ? value.assignmentToken.slice(0, 5)
      : legacy && key === "districtToken" ? undefined : expected[key];
    if (value[key] !== wanted) ctx.addIssue({ code: "custom", path: [key], message: "Identity derivation does not match the assignment token." });
  }
  if (!legacy && value.cruiserNumber !== undefined)
    ctx.addIssue({ code: "custom", path: ["cruiserNumber"], message: "CAD district digits are not a physical fleet number." });
});
export type OperationalIdentity = z.infer<typeof OperationalIdentitySnapshot>;

/** Multiple adapter aliases must agree; a malformed/conflicting unit is not guessed. */
export function operationalIdentityFromCad(source: Record<string, unknown>) {
  const units = ["unitNumber", "unit_number", "cadUnit"].flatMap(key =>
    source[key] == null ? [] : [source[key]]);
  if (!units.length || units.some(unit => typeof unit !== "string")) return undefined;
  const normalized = (units as string[]).map(unit => unit.trim().toUpperCase());
  if (normalized.some(unit => unit !== normalized[0]) || !OperationalCadUnit.safeParse(normalized[0]).success)
    return undefined;
  return parseOperationalIdentity(normalized[0]);
}
