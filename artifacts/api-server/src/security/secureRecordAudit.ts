import { createHmac, randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { logger } from "../lib/logger.js";

export type SecureRecordsAuditContext = {
  requestId: string;
  timestamp: string;
  actor: { user_id_hash: string } | "ANONYMOUS";
  hashedClientIp: string;
};

declare global {
  namespace Express {
    interface Locals {
      clerkUserId?: string | null;
      secureRecordsAudit?: SecureRecordsAuditContext;
      secureRecordsGrant?: {
        userId: string;
        permission: "secure-records:read";
      };
      secureRecordsErrorCode?: string;
    }
  }
}

function hmacIdentity(key: string, domain: "user" | "ip", value: string): string {
  return createHmac("sha256", key).update(`${domain}:${value}`).digest("hex");
}

function errorPayload(code: string, message: string) {
  return { status: "error", error_code: code, message };
}

/**
 * Application-log audit middleware for the prototype route. Only keyed hashes
 * of the server-resolved actor and socket peer are logged; raw identifiers and
 * bearer tokens are never included. Durable/WORM retention is not configured.
 */
export const secureRecordAuditMiddleware: RequestHandler = (req, res, next) => {
  const requestId = typeof req.id === "string" ? req.id : randomUUID();
  const timestamp = new Date().toISOString();
  const key = process.env.AUDIT_ID_HMAC_KEY;
  if (!key || Buffer.byteLength(key, "utf8") < 32) {
    logger.warn({
      secureRecordsAudit: {
        requestId,
        timestamp,
        action: "READ",
        resource: "secure-records",
        result: "denied",
        errorCode: "AUDIT_NOT_CONFIGURED",
      },
    }, "Secure records access denied");
    res.status(503).json(errorPayload(
      "AUDIT_NOT_CONFIGURED",
      "Secure records access logging is unavailable.",
    ));
    return;
  }

  const userId = res.locals.clerkUserId;
  // Express uses the socket peer unless an operator explicitly configures
  // trusted proxy hops, in which case req.ip resolves the verified client hop.
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const audit: SecureRecordsAuditContext = {
    requestId,
    timestamp,
    actor: userId
      ? { user_id_hash: hmacIdentity(key, "user", userId) }
      : "ANONYMOUS",
    hashedClientIp: hmacIdentity(key, "ip", clientIp),
  };
  res.locals.secureRecordsAudit = audit;
  res.on("finish", () => {
    logger.info({
      secureRecordsAudit: {
        ...audit,
        action: "READ",
        resource: "secure-records",
        mode:
          process.env.USE_REAL_API?.trim().toLowerCase() === "true"
            ? "real"
            : "mock",
        statusCode: res.statusCode,
        result: res.statusCode >= 400 ? "denied_or_failed" : "success",
        errorCode: res.locals.secureRecordsErrorCode,
      },
    }, "Secure records access");
  });
  next();
};
