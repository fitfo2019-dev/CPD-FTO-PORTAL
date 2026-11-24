import { z } from "zod/v4";

/** Vehicle identity is not a roster, shift, precinct or access assignment. */
export const OperationalAssignmentToken = z.string().regex(/^[0-9]{4}[A-Z]-[12]$/,
  "Use four cruiser digits, an uppercase company letter, and side -1 or -2.");
export function parseOperationalIdentity(value: unknown) {
  const assignmentToken = OperationalAssignmentToken.parse(value);
  return {
    assignmentToken, cruiserNumber: assignmentToken.slice(0, 4),
    cadUnit: assignmentToken.slice(0, 5), company: assignmentToken[4]!,
    side: assignmentToken.slice(-1) as "1" | "2",
  };
}
export type OperationalIdentity = ReturnType<typeof parseOperationalIdentity>;
export const OperationalIdentitySnapshot = z.object({
  assignmentToken: OperationalAssignmentToken,
  cruiserNumber: z.string(), cadUnit: z.string(), company: z.string(), side: z.enum(["1", "2"]),
}).strict().superRefine((value, ctx) => {
  const expected = parseOperationalIdentity(value.assignmentToken);
  for (const key of ["cruiserNumber", "cadUnit", "company", "side"] as const) {
    if (value[key] !== expected[key]) ctx.addIssue({ code: "custom", path: [key], message: "Identity derivation does not match the assignment token." });
  }
});
