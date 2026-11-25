import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";
import type { Principal } from "./authorization.js";

export type AgencyRole = "PO" | "FTO" | "FTO_COORDINATOR";
export type AgencyIdentity = { id: string; badge: string; role: AgencyRole };

function claimAt(claims: unknown, path: string | undefined): unknown {
  if (!path || !/^[A-Za-z0-9_.]+$/.test(path)) return undefined;
  return path.split(".").reduce<unknown>((value, key) => {
    if (["__proto__", "prototype", "constructor"].includes(key)) return undefined;
    return typeof value === "object" && value !== null &&
      Object.hasOwn(value, key) ? (value as Record<string, unknown>)[key] : undefined;
  }, claims);
}

/** Only cryptographically verified session claims enter here. Assignments are
 * deliberately NOT read from claims; the database remains their authority. */
export function agencyIdentityFromClaims(id: string, claims: unknown): AgencyIdentity | null {
  if (claimAt(claims, process.env.AGENCY_VERIFIED_CLAIM_PATH) !== true) return null;
  const role = claimAt(claims, process.env.AGENCY_ROLE_CLAIM_PATH);
  const badge = claimAt(claims, process.env.AGENCY_BADGE_CLAIM_PATH);
  if (typeof role !== "string" || !["PO", "FTO", "FTO_COORDINATOR"].includes(role) ||
    typeof badge !== "string" || !/^[A-Za-z0-9-]{1,40}$/.test(badge) ||
    !id || id.length > 256) return null;
  return { id, badge, role: role as AgencyRole };
}

export function resolveAgencyIdentity(req: Request): AgencyIdentity | null {
  const auth = getAuth(req);
  return auth.userId ? agencyIdentityFromClaims(auth.userId, auth.sessionClaims) : null;
}

export const requireAgencyIdentity: RequestHandler = (req, res, next) => {
  let identity: AgencyIdentity | null = null;
  let signedIn = false;
  try { signedIn = Boolean(getAuth(req).userId); identity = resolveAgencyIdentity(req); } catch { /* fail closed */ }
  if (!identity) {
    res.status(signedIn ? 403 : 401).json({ status: "error", error_code: "AGENCY_IDENTITY_REQUIRED",
      message: "A verified agency identity is required." });
    return;
  }
  res.locals.agencyIdentity = identity;
  // Supplies only verified identity to the existing pseudonymized audit stream.
  const now = Date.now();
  const principal: Principal = { id: identity.id, role: identity.role, squad: "",
    authenticatedAt: now, lastActivityAt: now, mfaVerified: false };
  res.locals.principal = principal;
  next();
};
