import { getAuth } from "@clerk/express";
import { Router, type IRouter, type RequestHandler } from "express";
import { isRealApiEnabled } from "../lib/config.js";
import { normalizeSecureRecords } from "../lib/secure-records.js";
import { logger } from "../lib/logger.js";
import {
  GovApiIntegrationError,
  fetchGovSecureRecords,
} from "../services/govApiIntegration.js";
import { secureRecordAuditMiddleware } from "../security/secureRecordAudit.js";

const router: IRouter = Router();

const MOCK_RECORDS = [
  {
    id: "MOCK-2026-0001",
    status: "draft",
    updated_at: "2026-04-15",
  },
  {
    id: "MOCK-2026-0002",
    status: "submitted",
    updated_at: "2026-04-14",
  },
  {
    id: "MOCK-2026-0003",
    status: "in_progress",
    updated_at: "2026-04-12",
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
) {
  res.locals.secureRecordsErrorCode = code;
  return res.status(statusCode).json({
    status: "error",
    error_code: code,
    message,
  });
}

router.get(
  "/v1/secure-records",
  captureVerifiedClerkIdentity,
  secureRecordAuditMiddleware,
  async (_req, res) => {
    const audit = res.locals.secureRecordsAudit;
    if (!audit) {
      return sendError(
        res,
        503,
        "AUDIT_NOT_CONFIGURED",
        "Secure records access logging is unavailable.",
      );
    }

    if (!isRealApiEnabled()) {
      return res.json(normalizeSecureRecords(MOCK_RECORDS));
    }

    try {
      const userId = res.locals.clerkUserId;
      if (!userId) {
        return sendError(
          res,
          401,
          "AUTHENTICATION_REQUIRED",
          "Sign-in is required.",
        );
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
        );
      }

      // The browser session establishes the caller's identity. The upstream
      // request uses only the server-level REAL_API_KEY credential.
      const upstreamPayload = await fetchGovSecureRecords();
      try {
        return res.json(normalizeSecureRecords(upstreamPayload));
      } catch {
        throw new GovApiIntegrationError(
          "REAL_API_INVALID_RESPONSE",
          502,
          "The secure records service returned invalid data.",
        );
      }
    } catch (error) {
      if (error instanceof GovApiIntegrationError) {
        logger.warn(
          { requestId: audit.requestId, errorCode: error.code },
          "Secure records upstream request failed",
        );
        return sendError(
          res,
          error.statusCode,
          "UPSTREAM_SERVICE_FAILURE",
          "The secure records service is temporarily unavailable.",
        );
      }
      logger.error({ requestId: audit.requestId }, "Secure records request failed unexpectedly");
      return sendError(
        res,
        500,
        "SECURE_RECORDS_INTERNAL_ERROR",
        "The secure records request could not be completed.",
      );
    }
  },
);

export default router;
