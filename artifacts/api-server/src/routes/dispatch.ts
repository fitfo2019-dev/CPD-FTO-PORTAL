import { getAuth } from "@clerk/express";
import { Router, type IRouter, type Response } from "express";
import { logger } from "../lib/logger.js";
import {
  fetchPatrolViewEvent,
  PatrolViewIntegrationError,
} from "../services/patrolViewIntegration.js";

const router: IRouter = Router();

function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
) {
  res.set("Cache-Control", "no-store");
  res.status(statusCode).json({ status: "error", error_code: code, message });
}

router.post("/v1/dispatch/event-ingress", async (req, res): Promise<void> => {
  let userId: string | null = null;
  try {
    userId = getAuth(req).userId ?? null;
  } catch {
    // A missing or invalid Clerk session never authorizes dispatch data access.
  }
  if (!userId) {
    sendError(res, 401, "AUTHENTICATION_REQUIRED", "Sign-in is required.");
    return;
  }

  const authorizedUserIds = (process.env.PATROLVIEW_ALLOWED_CLERK_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (authorizedUserIds.length === 0) {
    sendError(
      res,
      503,
      "DISPATCH_AUTHORIZATION_NOT_CONFIGURED",
      "Dispatch access is not configured for this agency.",
    );
    return;
  }
  if (!authorizedUserIds.includes(userId)) {
    sendError(res, 403, "DISPATCH_ACCESS_DENIED", "Dispatch access is not authorized.");
    return;
  }

  const eventId = typeof req.body?.eventId === "string" ? req.body.eventId.trim() : "";
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(eventId)) {
    sendError(res, 400, "INVALID_DISPATCH_EVENT_ID", "A valid dispatch event identifier is required.");
    return;
  }

  try {
    const data = await fetchPatrolViewEvent(eventId);
    res.set("Cache-Control", "no-store");
    const totalRecords = Object.keys(data).length > 0 ? 1 : 0;
    res.json({
      status: "success",
      metadata: { total_records: totalRecords },
      data: totalRecords ? [data] : [],
    });
  } catch (error) {
    if (error instanceof PatrolViewIntegrationError) {
      logger.warn({ errorCode: error.code }, "Dispatch event prefill request failed");
      sendError(
        res,
        error.statusCode,
        "DISPATCH_PREFILL_UNAVAILABLE",
        "Dispatch details are unavailable. Enter or correct the run details manually.",
      );
      return;
    }
    logger.error("Dispatch event prefill request failed unexpectedly");
    sendError(
      res,
      500,
      "DISPATCH_PREFILL_UNAVAILABLE",
      "Dispatch details are unavailable. Enter or correct the run details manually.",
    );
  }
});

export default router;
