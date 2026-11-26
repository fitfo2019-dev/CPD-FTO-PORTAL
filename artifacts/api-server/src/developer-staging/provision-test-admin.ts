/**
 * Developer-run provisioning for the isolated synthetic test administrator.
 * Grants or revokes the TEST_ADMIN directory entry for an EXISTING Clerk
 * account that the owner created/invited through Clerk. It never creates an
 * account, never handles passwords, and refuses to run in production.
 *
 *   pnpm run staging:test-admin -- grant <clerk-user-id>
 *   pnpm run staging:test-admin -- revoke <clerk-user-id>
 */
import { randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/express";
import pg from "pg";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [action, userId] = process.argv.slice(2).filter(arg => arg !== "--");
if ((action !== "grant" && action !== "revoke") || !userId || !/^user_[A-Za-z0-9]{1,64}$/.test(userId)) {
  fail("Usage: staging:test-admin -- grant|revoke <clerk-user-id>");
}
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
  fail("Test administrators can only be provisioned in a non-production environment.");
}
for (const key of ["DATABASE_URL", "CLERK_SECRET_KEY", "AUDIT_ID_HMAC_KEY"]) {
  if (!process.env[key]?.trim()) fail(`${key} must be configured in this development environment.`);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const subjectHash = hashUserIdentifier(userId);
  if (action === "revoke") {
    const result = await pool.query(
      "UPDATE synthetic_training.members SET active=false WHERE subject_hash=$1 AND role='TEST_ADMIN'",
      [subjectHash],
    );
    console.log(result.rowCount ? "Test administrator access revoked." : "No test administrator entry matched.");
  } else {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const user = await clerk.users.getUser(userId).catch(() => null);
    if (!user || user.banned || user.locked) fail("The Clerk account was not found or is not usable.");
    if (!user.twoFactorEnabled) fail("The Clerk account must have a second factor enrolled before it can be a test administrator.");
    // Never convert an existing agency-role directory entry into test authority.
    const result = await pool.query(
      `INSERT INTO synthetic_training.members(id,subject_hash,role,active,agency_verified,terms_accepted)
       VALUES ($1,$2,'TEST_ADMIN',true,false,true)
       ON CONFLICT (subject_hash) DO UPDATE SET active=true
       WHERE synthetic_training.members.role='TEST_ADMIN'`,
      [randomUUID(), subjectHash],
    );
    if (!result.rowCount) fail("This account already holds a different synthetic role and was not changed.");
    console.log("Test administrator access granted for synthetic staging records only.");
  }
} finally {
  await pool.end();
}
