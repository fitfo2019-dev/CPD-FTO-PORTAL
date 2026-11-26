import { clerkClient, getAuth } from "@clerk/express";
import type { Request, Response } from "express";
import { hasAgencyVerifiedClaim } from "../security/agencyIdentity.js";
import { TEST_ADMIN_SWITCH } from "../security/testAuthority.js";

export type VerifiedStagingSession = {
  subject: string; sessionId: string; recentMfa: boolean;
  /** Derived from signed session claims only; agency accounts can never hold test authority. */
  agencyVerified: boolean;
};
export type SessionResolver = (req: Request) => Promise<VerifiedStagingSession | null>;

export function stagingError(res: Response, code: number, errorCode: string, message: string): void {
  res.status(code).json({ status: "error", error_code: errorCode, message });
}

/**
 * Test-administrator authority requires every server-side condition at once:
 * a non-production process, the staging switch, the separate test-admin
 * switch, recent MFA, and a session WITHOUT an agency-verified claim. The
 * directory row (provisioned by a developer) is checked separately in SQL.
 */
export function testAdminAuthorityAvailable(
  session: VerifiedStagingSession, env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV !== "production"
    && env.SYNTHETIC_STAGING_ENABLED === "true"
    && env[TEST_ADMIN_SWITCH] === "true"
    && session.recentMfa
    && !session.agencyVerified;
}

/** No browser-provided role, user header, mock token or metadata grants access. */
export const resolveClerkSession: SessionResolver = async req => {
  const auth = getAuth(req);
  if (!auth.userId || !auth.sessionId) return null;
  // Online session check makes revocation effective on the next request.
  const session = await clerkClient.sessions.getSession(auth.sessionId);
  if (session.status !== "active" || session.userId !== auth.userId) return null;
  const factorAge: unknown = auth.sessionClaims?.fva;
  const recentMfa = Array.isArray(factorAge) && factorAge.length === 2
    && typeof factorAge[1] === "number" && factorAge[1] >= 0 && factorAge[1] < 15;
  return { subject: auth.userId, sessionId: auth.sessionId, recentMfa,
    agencyVerified: hasAgencyVerifiedClaim(auth.sessionClaims) };
};
