import type {
  PhaseExtensionRequest as ApiPhaseExtensionRequest,
  PhaseExtensionRequestInput,
} from "@workspace/api-client-react";
import type { PhaseExtensionRequest } from "./model.js";

type WirePhaseExtensionRequest = Omit<
  ApiPhaseExtensionRequest,
  "createdAt" | "reviewedAt"
> & {
  createdAt: string;
  reviewedAt: string | null;
};

type RequestsEnvelope = {
  status: "success";
  metadata: { total_records: number; role: "FTO" | "FTO_COORDINATOR" };
  data: PhaseExtensionRequest[];
};

export class PhaseExtensionApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PhaseExtensionApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseEnvelope(value: unknown): RequestsEnvelope {
  if (!isRecord(value) || value.status !== "success" ||
    !isRecord(value.metadata) || !["FTO", "FTO_COORDINATOR"].includes(String(value.metadata.role)) ||
    !Array.isArray(value.data)) {
    throw new PhaseExtensionApiError("The shared request service returned an invalid response.");
  }
  const data = value.data.map((item): WirePhaseExtensionRequest => {
    if (!isRecord(item) || typeof item.id !== "string" ||
      typeof item.className !== "string" || typeof item.recruitName !== "string" ||
      typeof item.recruitBadge !== "string" || ![1, 2, 3, 4].includes(Number(item.phase)) ||
      typeof item.phaseStartDate !== "string" || typeof item.requestingFtoName !== "string" ||
      typeof item.requestingFtoBadge !== "string" ||
      !["training_weeks", "limbo_period"].includes(String(item.extensionType)) ||
      typeof item.requestedWeeks !== "number" || typeof item.justification !== "string" ||
      !["pending", "approved", "denied"].includes(String(item.status)) ||
      typeof item.createdAt !== "string" ||
      !(item.reviewedAt === null || typeof item.reviewedAt === "string")) {
      throw new PhaseExtensionApiError("The shared request service returned an invalid request.");
    }
    return item as unknown as WirePhaseExtensionRequest;
  });
  return {
    status: "success",
    metadata: {
      total_records: Number(value.metadata.total_records),
      role: value.metadata.role as "FTO" | "FTO_COORDINATOR",
    },
    data: data.map(toLocalRequest),
  };
}

function toLocalRequest(request: WirePhaseExtensionRequest): PhaseExtensionRequest {
  return {
    ...request,
    phase: request.phase as PhaseExtensionRequest["phase"],
    status: request.status,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt ?? undefined,
  };
}

async function send(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<RequestsEnvelope> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/phase-extension-requests${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new PhaseExtensionApiError("The shared request service is offline.");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = isRecord(body) ? body : {};
    throw new PhaseExtensionApiError(
      typeof error.message === "string" ? error.message : "The shared request could not be completed.",
      response.status,
      typeof error.error_code === "string" ? error.error_code : undefined,
    );
  }
  return parseEnvelope(body);
}

export async function listSharedPhaseExtensionRequests(token: string): Promise<{
  role: "FTO" | "FTO_COORDINATOR";
  requests: PhaseExtensionRequest[];
}> {
  const envelope=await send(token, "");
  return {role:envelope.metadata.role,requests:envelope.data};
}

export async function submitSharedPhaseExtensionRequest(
  token: string,
  request: PhaseExtensionRequest,
): Promise<PhaseExtensionRequest> {
  const input: PhaseExtensionRequestInput = {
    id: request.id,
    className: request.className,
    recruitName: request.recruitName,
    recruitBadge: request.recruitBadge,
    phase: request.phase,
    phaseStartDate: request.phaseStartDate,
    requestingFtoName: request.requestingFtoName,
    requestingFtoBadge: request.requestingFtoBadge,
    extensionType: request.extensionType,
    requestedWeeks: request.requestedWeeks,
    justification: request.justification,
  };
  const [saved] = (await send(token, "", {
    method: "POST",
    body: JSON.stringify(input),
  })).data;
  if (!saved) throw new PhaseExtensionApiError("The shared request service did not return the saved request.");
  return saved;
}

export async function reviewSharedPhaseExtensionRequest(
  token: string,
  id: string,
  approve: boolean,
): Promise<PhaseExtensionRequest> {
  const [reviewed] = (await send(token, `/${encodeURIComponent(id)}/review`, {
    method: "POST",
    body: JSON.stringify({ decision: approve ? "approve" : "deny" }),
  })).data;
  if (!reviewed) throw new PhaseExtensionApiError("The shared request service did not return the review.");
  return reviewed;
}
