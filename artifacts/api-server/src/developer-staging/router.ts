import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  CreateStagingTrainingRecordBody, UpdateStagingTrainingRecordBody,
  AcknowledgeStagingTrainingRecordBody, GetStagingTrainingRecordParams,
  ListStagingTrainingRecordsResponse,
} from "@workspace/api-zod";
import { resolveClerkSession, stagingError, type SessionResolver } from "./access.js";
import { StagingFailure, StagingRepository, type StagingContext } from "./repository.js";

/**
 * Resolver injection exists only for tests. The mounted router ALWAYS uses
 * resolveClerkSession; no environment flag/header selects a mock identity.
 */
export function createStagingRouter(repository: StagingRepository, resolveSession: SessionResolver = resolveClerkSession): IRouter {
  const router = Router();
  const prefix = "/v1/staging/training-records";
  router.use(prefix, async (req, res, next): Promise<void> => {
    res.set("Cache-Control", "no-store");
    if (process.env.NODE_ENV === "production" || process.env.SYNTHETIC_STAGING_ENABLED !== "true") {
      stagingError(res, 404, "ROUTE_NOT_FOUND", "This endpoint is unavailable.");
      return;
    }
    try {
      const session = await resolveSession(req);
      if (!session || !session.recentMfa) {
        stagingError(res, 401, "AUTHENTICATION_REQUIRED", "An active sign-in with recent MFA is required.");
        return;
      }
      res.locals.stagingContext = {
        session, requestId: typeof req.id === "string" ? req.id : randomUUID(),
        clientIp: req.ip || req.socket.remoteAddress || "UNKNOWN",
      } satisfies StagingContext;
      next();
    } catch {
      stagingError(res, 401, "AUTHENTICATION_REQUIRED", "Sign-in could not be verified.");
    }
  });
  const context = (res: Parameters<typeof stagingError>[0]): StagingContext => {
    const ctx: StagingContext = res.locals.stagingContext;
    ctx.onPrincipal = (id, role) => {
      res.locals.principal = {
        id, role, mfaVerified: true, squad: "",
        authenticatedAt: Date.now(), lastActivityAt: Date.now(),
      };
    };
    return ctx;
  };
  const fail = (res: Parameters<typeof stagingError>[0], error: unknown): void => {
    if (error instanceof StagingFailure) {
      stagingError(res, error.status, error.code, "The synthetic record operation is not permitted or conflicts with current state.");
      return;
    }
    // No raw SQL errors, identifiers, paths or request bodies in logs/responses.
    stagingError(res, 503, "STAGING_UNAVAILABLE", "The synthetic staging service is unavailable.");
  };
  const safeNarrative = (value: string) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);
  const send = (res: Parameters<typeof stagingError>[0], data: unknown, status = 200): void => {
    res.status(status).json(ListStagingTrainingRecordsResponse.parse(data));
  };
  router.get(prefix, async (_req, res): Promise<void> => {
    try { send(res, await repository.list(context(res))); } catch (error) { fail(res, error); }
  });
  router.get(`${prefix}/:id`, async (req, res): Promise<void> => {
    const params = GetStagingTrainingRecordParams.strict().safeParse(req.params);
    if (!params.success) { stagingError(res, 400, "INVALID_RECORD_ID", "A valid record identifier is required."); return; }
    try { send(res, await repository.get(context(res), params.data.id)); } catch (error) { fail(res, error); }
  });
  router.post(prefix, async (req, res): Promise<void> => {
    const parsed = CreateStagingTrainingRecordBody.strict().safeParse(req.body);
    if (!parsed.success || !safeNarrative(parsed.data.narrative)
      || !validCalendarDate(parsed.data.record_date)) {
      stagingError(res, 422, "INVALID_RECORD", "A complete, valid synthetic record is required."); return;
    }
    try { send(res, await repository.create(context(res), parsed.data), 201); } catch (error) { fail(res, error); }
  });
  router.put(`${prefix}/:id`, async (req, res): Promise<void> => {
    const params = GetStagingTrainingRecordParams.strict().safeParse(req.params);
    const parsed = UpdateStagingTrainingRecordBody.strict().safeParse(req.body);
    if (!params.success || !parsed.success || !safeNarrative(parsed.data.narrative)) {
      stagingError(res, 422, "INVALID_RECORD", "A valid record and base version are required."); return;
    }
    try { send(res, await repository.update(context(res), params.data.id, parsed.data)); } catch (error) { fail(res, error); }
  });
  router.post(`${prefix}/:id/acknowledgement`, async (req, res): Promise<void> => {
    const params = GetStagingTrainingRecordParams.strict().safeParse(req.params);
    const parsed = AcknowledgeStagingTrainingRecordBody.strict().safeParse(req.body);
    if (!params.success || !parsed.success) {
      stagingError(res, 422, "INVALID_ACKNOWLEDGEMENT", "A record version and acknowledgement are required."); return;
    }
    try { send(res, await repository.acknowledge(context(res), params.data.id, parsed.data)); } catch (error) { fail(res, error); }
  });
  return router;
}

function validCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
