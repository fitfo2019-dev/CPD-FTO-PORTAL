import { getAuth } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type RequestHandler } from "express";
import { isRealApiEnabled } from "../lib/config.js";
import { logger } from "../lib/logger";
import { GovApiIntegrationError, fetchGovSecureRecords } from "../services/govApiIntegration";
import { secureRecordAuditMiddleware } from "../security/secureRecordAudit";

const router: IRouter = Router();

const MOCK_RECORDS = [
  {
    recordId: "MOCK-2026-0001",
    recordType: "Daily evaluation",
    phase: 1,
    status: "draft",
    updatedAt: "2026-04-15T13:45:00.000Z",
    summary: "Synthetic sample record for table and dashboard layout.",
  },
  {
    recordId: "MOCK-2026-0002",
    recordType: "Weekly packet",
    phase: 2,
    status: "submitted",
    updatedAt: "2026-04-14T18:20:00.000Z",
    summary: "Synthetic sample record; no real person or case is represented.",
  },
  {
    recordId: "MOCK-2026-0003",
    recordType: "Substation orientation",
    phase: 1,
    status: "in_progress",
    updatedAt: "2026-04-12T15:05:00.000Z",
    summary: "Synthetic sample record for frontend prototyping.",
  },
] as const;

const captureVerifiedClerkIdentity: RequestHandler = (req, res, next) => {
  try {
    const auth = getAuth(req);
    res.locals.clerkUserId = auth.userId ?? null;
  } catch {
    // Mock preview is intentionally usable without an account. Live mode checks
    // authentication and authorization explicitly below.
    res.locals.clerkUserId = null;
  }
  next();
};

function sendError(
  res: Parameters<RequestHandler>[1],
  statusCode: number,
  code: string,
  message: string,
  requestId: string,
) {
  res.locals.secureRecordsErrorCode = code;
  return res.status(statusCode).json({
    status: "error",
    error: { code, message, requestId },
  });
}

router.get(
  "/v1/secure-records",
  captureVerifiedClerkIdentity,
  secureRecordAuditMiddleware,
  async (req, res) => {
    const audit = res.locals.secureRecordsAudit;
    if (!audit) {
      return sendError(
        res,
        503,
        "AUDIT_NOT_CONFIGURED",
        "Secure records access logging is unavailable.",
        randomUUID(),
      );
    }

    if (!isRealApiEnabled()) {
      return res.json({
        status: "ok",
        mode: "mock",
        requestId: audit.requestId,
        warning: "Synthetic demonstration records only. This response is not operational data.",
        records: MOCK_RECORDS,
      });
    }

    try {
      const userId = res.locals.clerkUserId;
      if (!userId) {
        return sendError(res, 401, "AUTHENTICATION_REQUIRED", "Sign-in is required.", audit.requestId);
      }

      // Clerk authentication alone is not department authorization. A future
      // approved server-side policy adapter must set this grant from the
      // verified role and record scope; request fields can never set the grant.
      const grant = res.locals.secureRecordsGrant;
      if (!grant || grant.userId !== userId || grant.permission !== "secure-records:read") {
        return sendError(
          res,
          503,
          "SECURE_RECORDS_AUTHORIZATION_NOT_CONFIGURED",
          "Department role and record-scope authorization is not configured.",
          audit.requestId,
        );
      }

      const authorizationHeader = req.get("authorization") ?? undefined;
      const records = await fetchGovSecureRecords({
        authorizationHeader,
        authenticatedUserId: userId,
      });
      return res.json({
        status: "ok",
        mode: "real",
        requestId: audit.requestId,
        records,
      });
    } catch (error) {
      if (error instanceof GovApiIntegrationError) {
        return sendError(res, error.statusCode, error.code, error.message, audit.requestId);
      }
      logger.error({ requestId: audit.requestId }, "Secure records request failed unexpectedly");
      return sendError(
        res,
        500,
        "SECURE_RECORDS_INTERNAL_ERROR",
        "The secure records request could not be completed.",
        audit.requestId,
      );
    }
  },
);

export default router;
