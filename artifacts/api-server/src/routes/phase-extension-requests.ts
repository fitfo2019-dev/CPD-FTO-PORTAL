import { clerkClient, getAuth } from "@clerk/express";
import {
  ListPhaseExtensionRequestsResponse,
  ReviewPhaseExtensionRequestBody,
  ReviewPhaseExtensionRequestParams,
  ReviewPhaseExtensionRequestResponse,
  SubmitPhaseExtensionRequestBody,
  SubmitPhaseExtensionRequestResponse,
  type PhaseExtensionRequestInput,
} from "@workspace/api-zod";
import pg from "pg";
import { Router, type IRouter, type Request } from "express";
import type { PhaseExtensionRequestStore } from "../lib/phase-extension-store.js";
import { createPhaseExtensionRequestStore } from "../lib/phase-extension-store.js";

type AgencyRole = "FTO" | "FTO_COORDINATOR";
type Caller = { userId: string; role: AgencyRole };
type CallerResolver = (req: Request) => Promise<{
  caller?: Caller;
  error?: { status: number; code: string; message: string };
}>;

export function getPhaseExtensionRoleFromPublicMetadata(
  metadata: unknown,
): AgencyRole | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const role = (metadata as Record<string, unknown>).fieldreadyRole;
  return role === "FTO" || role === "FTO_COORDINATOR" ? role : null;
}

let store: PhaseExtensionRequestStore | undefined;
let pool: pg.Pool | undefined;

function getStore(): PhaseExtensionRequestStore | null {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return null;
  pool ??= new pg.Pool({
    connectionString,
    max: 4,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10_000,
  });
  store ??= createPhaseExtensionRequestStore(pool);
  return store;
}

async function getVerifiedCaller(req: Request): Promise<{
  caller?: Caller;
  error?: { status: number; code: string; message: string };
}> {
  let userId: string | null = null;
  try {
    userId = getAuth(req).userId ?? null;
  } catch {
    // Clerk middleware did not establish a verified session.
  }
  if (!userId) {
    return {
      error: {
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
        message: "Sign in with an approved staff account.",
      },
    };
  }

  try {
    // publicMetadata is writable only by the Clerk backend. Never accept a
    // role from request data, headers, or the client-side role preview.
    const user = await clerkClient.users.getUser(userId);
    const role = getPhaseExtensionRoleFromPublicMetadata(user.publicMetadata);
    if (!role) {
      return {
        error: {
          status: 403,
          code: "PHASE_EXTENSION_ACCESS_DENIED",
          message: "This account does not have an approved FTO role.",
        },
      };
    }
    return { caller: { userId, role } };
  } catch {
    return {
      error: {
        status: 503,
        code: "ROLE_LOOKUP_UNAVAILABLE",
        message: "Staff role verification is temporarily unavailable.",
      },
    };
  }
}

function sendError(
  res: Parameters<import("express").RequestHandler>[1],
  status: number,
  code: string,
  message: string,
): void {
  res.setHeader("Cache-Control", "private, no-store");
  res.status(status).json({ status: "error", error_code: code, message });
}

function response(requests: unknown[], role: AgencyRole) {
  return {
    status: "success" as const,
    metadata: { total_records: requests.length, role },
    data: requests,
  };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function createPhaseExtensionRequestsRouter(dependencies?: {
  resolveCaller?: CallerResolver;
  getStore?: () => PhaseExtensionRequestStore | null;
}): IRouter {
  const router: IRouter = Router();
  const resolveCaller = dependencies?.resolveCaller ?? getVerifiedCaller;
  const provideStore = dependencies?.getStore ?? getStore;

router.get("/v1/phase-extension-requests", async (req, res): Promise<void> => {
  const verified = await resolveCaller(req);
  if (!verified.caller) {
    const error = verified.error!;
    sendError(res, error.status, error.code, error.message);
    return;
  }
  const repository = provideStore();
  if (!repository) {
    sendError(res, 503, "REQUEST_STORAGE_UNAVAILABLE", "Shared request storage is not configured.");
    return;
  }

  try {
    const requests = verified.caller.role === "FTO"
      ? await repository.listForFto(verified.caller.userId)
      : await repository.listPending();
    res.setHeader("Cache-Control", "private, no-store");
    res.json(ListPhaseExtensionRequestsResponse.parse(response(requests, verified.caller.role)));
  } catch {
    req.log.error({ operation: "list_phase_extension_requests" }, "Shared phase extension request lookup failed");
    sendError(res, 503, "REQUEST_STORAGE_UNAVAILABLE", "Shared requests are temporarily unavailable.");
  }
});

router.post("/v1/phase-extension-requests", async (req, res): Promise<void> => {
  const verified = await resolveCaller(req);
  if (!verified.caller) {
    const error = verified.error!;
    sendError(res, error.status, error.code, error.message);
    return;
  }
  if (verified.caller.role !== "FTO") {
    sendError(res, 403, "PHASE_EXTENSION_ACCESS_DENIED", "Only an FTO can submit a phase extension request.");
    return;
  }
  const input = SubmitPhaseExtensionRequestBody.strict().safeParse(req.body);
  if (!input.success || !input.data.justification.trim() ||
    !isCalendarDate(input.data.phaseStartDate)) {
    sendError(res, 400, "INVALID_PHASE_EXTENSION_REQUEST", "The phase extension request is incomplete or invalid.");
    return;
  }
  const repository = provideStore();
  if (!repository) {
    sendError(res, 503, "REQUEST_STORAGE_UNAVAILABLE", "Shared request storage is not configured.");
    return;
  }

  try {
    const result = await repository.create(
      verified.caller.userId,
      input.data as PhaseExtensionRequestInput,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.status(result.created ? 201 : 200).json(
      SubmitPhaseExtensionRequestResponse.parse(response([result.request], verified.caller.role)),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "PHASE_EXTENSION_ID_CONFLICT") {
      sendError(res, 409, "REQUEST_ID_CONFLICT", "This request identifier is already in use.");
      return;
    }
    req.log.error({ operation: "create_phase_extension_request" }, "Shared phase extension request save failed");
    sendError(res, 503, "REQUEST_STORAGE_UNAVAILABLE", "The request could not be saved to shared storage.");
  }
});

router.post("/v1/phase-extension-requests/:id/review", async (req, res): Promise<void> => {
  const verified = await resolveCaller(req);
  if (!verified.caller) {
    const error = verified.error!;
    sendError(res, error.status, error.code, error.message);
    return;
  }
  if (verified.caller.role !== "FTO_COORDINATOR") {
    sendError(res, 403, "PHASE_EXTENSION_ACCESS_DENIED", "Only an FTO Coordinator can review requests.");
    return;
  }
  const params = ReviewPhaseExtensionRequestParams.safeParse(req.params);
  const input = ReviewPhaseExtensionRequestBody.strict().safeParse(req.body);
  if (!params.success || !input.success) {
    sendError(res, 400, "INVALID_PHASE_EXTENSION_REVIEW", "Choose approve or deny for a valid request.");
    return;
  }
  const repository = provideStore();
  if (!repository) {
    sendError(res, 503, "REQUEST_STORAGE_UNAVAILABLE", "Shared request storage is not configured.");
    return;
  }

  try {
    const result = await repository.review(
      params.data.id,
      verified.caller.userId,
      input.data.decision,
    );
    if (!result.request) {
      sendError(res, 404, "PHASE_EXTENSION_NOT_FOUND", "The phase extension request is no longer available.");
      return;
    }
    if (result.alreadyResolved) {
      sendError(res, 409, "PHASE_EXTENSION_ALREADY_REVIEWED", "This request has already been reviewed.");
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.json(ReviewPhaseExtensionRequestResponse.parse(response([result.request], verified.caller.role)));
  } catch {
    req.log.error({ operation: "review_phase_extension_request" }, "Shared phase extension review failed");
    sendError(res, 503, "REQUEST_STORAGE_UNAVAILABLE", "The review could not be saved to shared storage.");
  }
});

  return router;
}

export default createPhaseExtensionRequestsRouter();
