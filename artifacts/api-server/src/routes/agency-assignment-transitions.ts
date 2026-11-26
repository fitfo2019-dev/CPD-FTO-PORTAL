import {
  CreateSuccessorAssignmentBody,
  CreateSuccessorAssignmentResponse,
  GetAssignmentTransitionHistoryQueryParams,
  GetAssignmentTransitionHistoryResponse,
  GetAssignmentTransitionContextResponse,
} from "@workspace/api-zod";
import { Router, type RequestHandler } from "express";
import { getAgencyAssignmentTransitionStore, type AgencyAssignmentTransitionStore } from "../lib/agency-assignment-transition-store.js";
import { PacketError } from "../lib/packet-errors.js";
import { requireAgencyIdentity, type AgencyIdentity } from "../security/agencyIdentity.js";

export function createAgencyAssignmentTransitionsRouter(
  authenticate: RequestHandler = requireAgencyIdentity,
  resolveStore: () => AgencyAssignmentTransitionStore | null = getAgencyAssignmentTransitionStore,
) {
  const router = Router();
  router.use("/v1/agency/assignment-transitions", authenticate);

  router.get("/v1/agency/assignment-transitions/context", async (_req, res): Promise<void> => {
    const identity = res.locals.agencyIdentity as AgencyIdentity;
    if (identity.role !== "FTO_COORDINATOR") {
      sendTransitionError(res, new PacketError(403, "ASSIGNMENT_TRANSITION_FORBIDDEN"));
      return;
    }
    try {
      const store = resolveStore();
      if (!store) throw new PacketError(503, "AGENCY_STORAGE_UNAVAILABLE");
      const context = await store.context(identity);
      res.setHeader("Cache-Control", "private, no-store");
      res.json(GetAssignmentTransitionContextResponse.parse(context));
    } catch (error) {
      sendTransitionError(res, error);
    }
  });

  router.get("/v1/agency/assignment-transitions/history", async (req, res): Promise<void> => {
    const identity = res.locals.agencyIdentity as AgencyIdentity;
    if (identity.role !== "FTO_COORDINATOR") {
      sendTransitionError(res, new PacketError(403, "ASSIGNMENT_TRANSITION_FORBIDDEN"));
      return;
    }
    const params = GetAssignmentTransitionHistoryQueryParams.safeParse(req.query);
    if (!params.success) {
      sendTransitionError(res, new PacketError(400, "INVALID_ASSIGNMENT_HISTORY_REQUEST"));
      return;
    }
    try {
      const store = resolveStore();
      if (!store) throw new PacketError(503, "AGENCY_STORAGE_UNAVAILABLE");
      const page = await store.history(
        identity,
        params.data.assignmentId,
        params.data.cursor,
        params.data.limit,
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.json(GetAssignmentTransitionHistoryResponse.parse(page));
    } catch (error) {
      sendTransitionError(res, error);
    }
  });

  router.post("/v1/agency/assignment-transitions", async (req, res): Promise<void> => {
    const identity = res.locals.agencyIdentity as AgencyIdentity;
    if (identity.role !== "FTO_COORDINATOR") {
      sendTransitionError(res, new PacketError(403, "ASSIGNMENT_TRANSITION_FORBIDDEN"));
      return;
    }
    const input = CreateSuccessorAssignmentBody.strict().safeParse(req.body);
    if (!input.success ||
      !isCalendarDate(input.data?.starts_on) ||
      !isCalendarDate(input.data?.ends_on) ||
      input.data.starts_on > input.data.ends_on) {
      sendTransitionError(res, new PacketError(400, "INVALID_SUCCESSOR_ASSIGNMENT"));
      return;
    }
    try {
      const store = resolveStore();
      if (!store) throw new PacketError(503, "AGENCY_STORAGE_UNAVAILABLE");
      const result = await store.create(identity, input.data);
      const response = CreateSuccessorAssignmentResponse.parse({
        status: "success",
        metadata: { total_records: 1, role: identity.role },
        data: [result.transition],
      });
      res.setHeader("Cache-Control", "private, no-store");
      res.status(result.created ? 201 : 200).json(response);
    } catch (error) {
      sendTransitionError(res, error);
    }
  });

  return router;
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function sendTransitionError(res: import("express").Response, error: unknown): void {
  const status = error instanceof PacketError ? error.status : 503;
  const code = error instanceof PacketError ? error.code : "AGENCY_STORAGE_UNAVAILABLE";
  res.setHeader("Cache-Control", "private, no-store");
  res.status(status).json({
    status: "error",
    error_code: code,
    message: status === 503
      ? "The assignment change could not be completed. No packet was changed."
      : "The assignment change was not completed. No packet was changed.",
  });
}

export default createAgencyAssignmentTransitionsRouter();
