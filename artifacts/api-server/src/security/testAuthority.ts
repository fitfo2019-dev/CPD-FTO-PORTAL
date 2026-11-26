/**
 * Test-administrator authority exists only inside the isolated synthetic
 * staging boundary. It is never an agency role, never comes from a browser,
 * and production refuses to start if any test-authority switch is present.
 */
export const TEST_ADMIN_ROLE = "TEST_ADMIN" as const;
export const TEST_ADMIN_SWITCH = "PORTAL_TEST_ADMIN_ENABLED" as const;

/** Role names reserved for test identities; agency claims carrying them are refused. */
export function isReservedTestRole(value: unknown): boolean {
  return typeof value === "string" && /^test[_-]?admin/i.test(value.trim());
}

export function assertNoTestAuthorityInProduction(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production" && env[TEST_ADMIN_SWITCH] !== undefined) {
    throw new Error("Test administrator configuration is not permitted in production.");
  }
}
