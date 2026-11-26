import assert from "node:assert/strict";
import test from "node:test";
import { agencyIdentityFromClaims } from "../src/security/agencyIdentity.js";
import { assertNoTestAuthorityInProduction, isReservedTestRole } from "../src/security/testAuthority.js";
import { testAdminAuthorityAvailable } from "../src/developer-staging/access.js";

const session = { subject: "fixture-test-admin", sessionId: "s", recentMfa: true, agencyVerified: false };
const enabled = { NODE_ENV: "development", SYNTHETIC_STAGING_ENABLED: "true", PORTAL_TEST_ADMIN_ENABLED: "true" };

test("production refuses to start with any test-administrator configuration", () => {
  for (const value of ["true", "false", ""]) {
    assert.throws(() => assertNoTestAuthorityInProduction({ NODE_ENV: "production", PORTAL_TEST_ADMIN_ENABLED: value }));
  }
  assert.doesNotThrow(() => assertNoTestAuthorityInProduction({ NODE_ENV: "production" }));
  assert.doesNotThrow(() => assertNoTestAuthorityInProduction(enabled));
});

test("test authority needs every non-production switch, recent MFA and no agency verification", () => {
  assert.equal(testAdminAuthorityAvailable(session, enabled), true);
  assert.equal(testAdminAuthorityAvailable(session, { ...enabled, NODE_ENV: "production" }), false);
  assert.equal(testAdminAuthorityAvailable(session, { ...enabled, SYNTHETIC_STAGING_ENABLED: undefined }), false);
  assert.equal(testAdminAuthorityAvailable(session, { ...enabled, PORTAL_TEST_ADMIN_ENABLED: "1" }), false);
  assert.equal(testAdminAuthorityAvailable({ ...session, recentMfa: false }, enabled), false);
  assert.equal(testAdminAuthorityAvailable({ ...session, agencyVerified: true }, enabled), false);
});

test("verified agency claims can never carry test-administrator authority", () => {
  const before = { role: process.env.AGENCY_ROLE_CLAIM_PATH, badge: process.env.AGENCY_BADGE_CLAIM_PATH,
    verified: process.env.AGENCY_VERIFIED_CLAIM_PATH };
  process.env.AGENCY_ROLE_CLAIM_PATH = "agency.role";
  process.env.AGENCY_BADGE_CLAIM_PATH = "agency.badge";
  process.env.AGENCY_VERIFIED_CLAIM_PATH = "agency.verified";
  try {
    for (const role of ["TEST_ADMIN", "test_admin", "Test-Admin", "TESTADMIN"]) {
      assert.equal(isReservedTestRole(role), true);
      assert.equal(agencyIdentityFromClaims("x", { agency: { role, badge: "1234", verified: true } }), null);
    }
    // Existing agency roles are unchanged.
    assert.deepEqual(agencyIdentityFromClaims("x", { agency: { role: "FTO_COORDINATOR", badge: "1234", verified: true } }),
      { id: "x", badge: "1234", role: "FTO_COORDINATOR" });
  } finally {
    for (const [key, value] of Object.entries({
      AGENCY_ROLE_CLAIM_PATH: before.role, AGENCY_BADGE_CLAIM_PATH: before.badge,
      AGENCY_VERIFIED_CLAIM_PATH: before.verified,
    })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
