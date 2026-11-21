import type { RequestHandler } from "express";

export type Role =
  | "PO"
  | "FTO"
  | "FTO_SGT"
  | "FTO_COORDINATOR"
  | "FTO_COC"
  | "POLICENET"
  | "POLICENET_ADMIN_SGT";
export type Principal = {
  id: string;
  role: Role;
  /** Verified directory rank for a POLICENET admin account; never client supplied. */
  technicalRank?: "SGT" | "LT";
  squad: string;
  authenticatedAt: number;
  lastActivityAt: number;
  mfaVerified: boolean;
};
export type TrainingDeletionApproval = {
  requestId: string;
  trainingRecordId: string;
  approver: Pick<Principal, "id" | "role" | "technicalRank">;
};
export type ReportScope = {
  recruitId: string;
  ftoId: string;
  coordinatorId?: string;
  squad: string;
  completedSubmitted: boolean;
  classActivated?: boolean;
  phaseActivated?: boolean;
};
export type Permission = "read" | "edit" | "comment" | "sign" | "lock" | "exportPacket" | "exportReport" | "viewAudit" | "exportAudit";
export type ClassPermission = "readRoster" | "manageRoster" | "manageAssignments" | "activatePhaseI" | "report" | "exportClassWorkbook";
export type ClassScope = {
  classId: string;
  coordinatorId: string;
  rosterComplete: boolean;
  initialAssignmentsConfirmed: boolean;
  phaseIActive: boolean;
};
export type FtoAssignmentScope = {
  classId: string;
  poClassId: string;
  poActive: boolean;
  phase: number;
  coordinatorId: string;
  /** Each list is resolved from server-side class authorization records. */
  authorizedFtoSgtIds: string[];
  authorizedFtoCocIds: string[];
  ftoId: string;
  ftoRole: Role | null;
  ftoActive: boolean;
  ftoProvisioned: boolean;
};
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
  // Class management and audit export are separate protected operations, not
  // report privileges. No report role gets a broad manage/export-audit bypass.
  if (action === "exportAudit") return false;
  if (!target) return false;
  switch (principal.role) {
    case "PO":
      return target.recruitId === principal.id && target.classActivated === true &&
        target.phaseActivated === true && ["read", "comment", "sign"].includes(action);
    case "FTO":
      return activelyAssigned && target.ftoId === principal.id &&
        ["read", "edit", "sign", "exportPacket"].includes(action);
    case "FTO_SGT":
      return false;
    case "FTO_COORDINATOR":
      return target.coordinatorId === principal.id && ["read", "exportPacket"].includes(action);
    case "FTO_COC":
      return target.completedSubmitted && target.squad === principal.squad &&
        ["read", "comment", "exportPacket"].includes(action);
    case "POLICENET":
    case "POLICENET_ADMIN_SGT":
      return false;
  }
}

/** Role/scope gate only; the not-yet-mounted activation API must additionally
 * atomically write the required class-activation audit record. */
export function canManageClass(principal: Principal, action: ClassPermission, target: ClassScope): boolean {
  if (principal.role !== "FTO_COORDINATOR" || target.coordinatorId !== principal.id) {
    return false;
  }
  if (action === "activatePhaseI") {
    return target.rosterComplete && target.initialAssignmentsConfirmed && !target.phaseIActive;
  }
  return true;
}

/** Assignment authority is class-scoped and never grants report or roster access. */
export function canAssignFto(principal: Principal, target: FtoAssignmentScope): boolean {
  if (
    !target.classId ||
    target.classId !== target.poClassId ||
    !target.poActive ||
    !Number.isInteger(target.phase) ||
    target.phase < 1 ||
    target.phase > 4 ||
    !target.ftoId ||
    target.ftoRole !== "FTO" ||
    !target.ftoActive ||
    !target.ftoProvisioned
  ) return false;

  switch (principal.role) {
    case "FTO_COORDINATOR":
      return target.coordinatorId === principal.id;
    case "FTO_SGT":
      return target.authorizedFtoSgtIds.includes(principal.id);
    case "FTO_COC":
      return target.authorizedFtoCocIds.includes(principal.id);
    default:
      return false;
  }
}

/**
 * Training-record deletion is the sole operation requiring both POLICENET
 * admin ranks. Call only with approvals assembled from verified server-side
 * identities; this preview currently has no deletion route.
 */
export function canDeleteTrainingRecord(
  principal: Principal,
  requestId: string,
  trainingRecordId: string,
  approvals: TrainingDeletionApproval[],
): boolean {
  if (principal.role !== "POLICENET_ADMIN_SGT") return false;
  const matching = approvals.filter(approval =>
    approval.requestId === requestId &&
    approval.trainingRecordId === trainingRecordId &&
    approval.approver.role === "POLICENET_ADMIN_SGT",
  );
  const sgt = matching.find(approval => approval.approver.technicalRank === "SGT");
  const lieutenant = matching.find(approval =>
    approval.approver.technicalRank === "LT" &&
    approval.approver.id !== sgt?.approver.id,
  );
  return Boolean(sgt && lieutenant);
}

/** Fail-closed middleware ready for a verified session adapter. Not mounted
 * until identity setup is implemented; no public Daily Performance Log API exists in this build. */
export function requireSession(
  resolve: (opaqueCookie: string | undefined) => Promise<Principal | null>,
): RequestHandler {
  return async (req, res, next) => {
    const principal = await resolve(req.cookies?.["fieldready_session"]);
    if (!principal || !principal.mfaVerified ||
      Date.now() - principal.lastActivityAt >= INACTIVITY_LIMIT_MS) {
      res.status(401).json({ error: "Re-authentication with MFA required." });
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
