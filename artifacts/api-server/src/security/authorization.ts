import type { RequestHandler } from "express";

export type Role = "RECRUIT" | "FTO" | "SERGEANT" | "ADMIN";
export type Principal = {
  id: string;
  role: Role;
  squad: string;
  authenticatedAt: number;
  lastActivityAt: number;
  mfaVerified: boolean;
};
export type ReportScope = { recruitId: string; ftoId: string; squad: string };
export type Permission =
  "read" | "edit" | "comment" | "sign" | "lock" | "manage" | "exportAudit";
export const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;

/**
 * Principal must come from a verified SERVER-SIDE session, never a role header,
 * query parameter, request body, or the demonstration role selector.
 */
export function canAccess(
  principal: Principal,
  action: Permission,
  target?: ReportScope,
  activelyAssigned = false,
): boolean {
  if (action === "manage" || action === "exportAudit")
    return principal.role === "ADMIN";
  if (!target) return false;
  switch (principal.role) {
    case "RECRUIT":
      return (
        target.recruitId === principal.id &&
        ["read", "comment", "sign"].includes(action)
      );
    case "FTO":
      return (
        activelyAssigned &&
        target.ftoId === principal.id &&
        ["read", "edit", "sign"].includes(action)
      );
    case "SERGEANT":
      return (
        target.squad === principal.squad &&
        ["read", "sign", "lock"].includes(action)
      );
    case "ADMIN":
      return action === "read"; // Coordinators don't impersonate report signers.
  }
}

/** Fail-closed middleware ready for a verified session adapter. Not mounted
 * until identity setup and protected report routes are implemented. */
export function requireSession(
  resolve: (opaqueCookie: string | undefined) => Promise<Principal | null>,
): RequestHandler {
  return async (req, res, next) => {
    const principal = await resolve(req.cookies?.["fieldready_session"]);
    if (
      !principal ||
      !principal.mfaVerified ||
      Date.now() - principal.lastActivityAt >= INACTIVITY_LIMIT_MS
    ) {
      res.status(401).json({
        status: "error",
        error_code: "AUTH_FAILURE",
        message: "Re-authentication with MFA is required.",
      });
      return;
    }
    res.locals.principal = principal;
    next();
  };
}

export interface IdentityAdapter {
  readonly protocol: "oidc" | "saml" | "local-development";
  /** Adapter verifies state/nonce/PKCE or signed assertions and MFA assurance. */
  authenticate(input: unknown): Promise<Principal>;
  revokeSession(sessionId: string): Promise<void>;
}
