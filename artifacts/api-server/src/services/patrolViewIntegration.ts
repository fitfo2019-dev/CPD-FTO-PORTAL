export type PatrolViewConfig = {
  PATROLVIEW_EVENT_LOOKUP_URL?: string;
  PATROLVIEW_API_TOKEN?: string;
};

export type DispatchEventPrefill = {
  eventIngressAt?: string;
  incidentNumber?: string;
  location?: string;
  dispatchedCode?: string;
};

export type PatrolViewFailureCode =
  | "PATROLVIEW_NOT_CONFIGURED"
  | "PATROLVIEW_TIMEOUT"
  | "PATROLVIEW_UNAVAILABLE"
  | "PATROLVIEW_UPSTREAM_ERROR"
  | "PATROLVIEW_INVALID_RESPONSE";

export class PatrolViewIntegrationError extends Error {
  constructor(
    readonly code: PatrolViewFailureCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "PatrolViewIntegrationError";
  }
}

type FetchResponse = Pick<Response, "ok" | "status" | "headers" | "text">;
type FetchFunction = (input: URL, init: RequestInit) => Promise<FetchResponse>;

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 32_000;

function configuration(config: PatrolViewConfig): {
  endpointTemplate: string;
  apiToken: string;
} {
  const endpointTemplate = config.PATROLVIEW_EVENT_LOOKUP_URL?.trim();
  const apiToken = config.PATROLVIEW_API_TOKEN?.trim();
  if (!endpointTemplate || !apiToken) {
    throw new PatrolViewIntegrationError(
      "PATROLVIEW_NOT_CONFIGURED",
      503,
      "The approved dispatch adapter is not configured.",
    );
  }

  if ((endpointTemplate.match(/\{eventId\}/g) ?? []).length !== 1) {
    throw new PatrolViewIntegrationError(
      "PATROLVIEW_NOT_CONFIGURED",
      503,
      "The approved dispatch adapter endpoint is invalid.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(endpointTemplate.replace("{eventId}", "EVENT_ID"));
  } catch {
    throw new PatrolViewIntegrationError(
      "PATROLVIEW_NOT_CONFIGURED",
      503,
      "The approved dispatch adapter endpoint is invalid.",
    );
  }

  if (
    endpoint.protocol !== "https:"
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
    || !endpoint.pathname.includes("EVENT_ID")
  ) {
    throw new PatrolViewIntegrationError(
      "PATROLVIEW_NOT_CONFIGURED",
      503,
      "The approved dispatch adapter must use an HTTPS event URL.",
    );
  }
  return { endpointTemplate, apiToken };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function firstValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

function optionalText(
  source: Record<string, unknown>,
  keys: string[],
  maxLength: number,
  field: string,
): string | undefined {
  const value = firstValue(source, keys);
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new PatrolViewIntegrationError(
      "PATROLVIEW_INVALID_RESPONSE",
      502,
      `The approved dispatch adapter returned an invalid ${field}.`,
    );
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** Normalize the approved adapter's canonical or snake_case event fields. */
export function mapPatrolViewEvent(payload: unknown): DispatchEventPrefill {
  const root = record(payload);
  const data = record(root?.data) ?? record(root?.event) ?? root;
  if (!data) {
    throw new PatrolViewIntegrationError(
      "PATROLVIEW_INVALID_RESPONSE",
      502,
      "The approved dispatch adapter returned invalid event data.",
    );
  }

  const rawIngress = firstValue(data, [
    "eventIngressAt",
    "event_ingress_at",
    "eventIngressTime",
    "event_ingress_time",
    "ingressTime",
  ]);
  let eventIngressAt: string | undefined;
  if (rawIngress !== undefined) {
    if (typeof rawIngress !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(rawIngress)) {
      throw new PatrolViewIntegrationError(
        "PATROLVIEW_INVALID_RESPONSE",
        502,
        "The approved dispatch adapter returned an invalid event ingress time.",
      );
    }
    const timestamp = new Date(rawIngress);
    if (Number.isNaN(timestamp.getTime())) {
      throw new PatrolViewIntegrationError(
        "PATROLVIEW_INVALID_RESPONSE",
        502,
        "The approved dispatch adapter returned an invalid event ingress time.",
      );
    }
    eventIngressAt = timestamp.toISOString();
  }

  const incidentNumber = optionalText(
    data,
    ["incidentNumber", "incident_number"],
    120,
    "incident number",
  );
  const location = optionalText(
    data,
    ["location", "locationText", "location_text"],
    200,
    "location",
  );
  const rawCode = optionalText(
    data,
    ["dispatchedCode", "dispatched_code", "tenCode", "ten_code"],
    8,
    "10-code",
  );
  let dispatchedCode: string | undefined;
  if (rawCode) {
    const normalized = rawCode.replace(/^10[\s-]*/i, "").toUpperCase();
    if (!/^\d{1,3}[A-Z]?$/.test(normalized)) {
      throw new PatrolViewIntegrationError(
        "PATROLVIEW_INVALID_RESPONSE",
        502,
        "The approved dispatch adapter returned an invalid 10-code.",
      );
    }
    dispatchedCode = normalized;
  }

  return {
    ...(eventIngressAt ? { eventIngressAt } : {}),
    ...(incidentNumber ? { incidentNumber } : {}),
    ...(location ? { location } : {}),
    ...(dispatchedCode ? { dispatchedCode } : {}),
  };
}

export async function fetchPatrolViewEvent(
  eventId: string,
  config: PatrolViewConfig = process.env,
  fetchImpl: FetchFunction = fetch as FetchFunction,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
): Promise<DispatchEventPrefill> {
  const cleanEventId = eventId.trim();
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(cleanEventId)) {
    throw new PatrolViewIntegrationError(
      "PATROLVIEW_INVALID_RESPONSE",
      400,
      "The dispatch event identifier is invalid.",
    );
  }
  const { endpointTemplate, apiToken } = configuration(config);
  const endpoint = new URL(
    endpointTemplate.replace("{eventId}", encodeURIComponent(cleanEventId)),
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new PatrolViewIntegrationError(
        "PATROLVIEW_UPSTREAM_ERROR",
        502,
        "The approved dispatch adapter returned an unsuccessful response.",
      );
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (
      (contentLengthHeader && !/^\d+$/.test(contentLengthHeader))
      || Number(contentLengthHeader ?? "0") > MAX_RESPONSE_BYTES
    ) {
      throw new PatrolViewIntegrationError(
        "PATROLVIEW_INVALID_RESPONSE",
        502,
        "The approved dispatch adapter returned invalid response metadata.",
      );
    }
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
      throw new PatrolViewIntegrationError(
        "PATROLVIEW_INVALID_RESPONSE",
        502,
        "The approved dispatch adapter response exceeded the allowed size.",
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new PatrolViewIntegrationError(
        "PATROLVIEW_INVALID_RESPONSE",
        502,
        "The approved dispatch adapter returned invalid JSON.",
      );
    }
    return mapPatrolViewEvent(parsed);
  } catch (error) {
    if (error instanceof PatrolViewIntegrationError) throw error;
    if (controller.signal.aborted) {
      throw new PatrolViewIntegrationError(
        "PATROLVIEW_TIMEOUT",
        504,
        "The approved dispatch adapter did not respond before the timeout.",
      );
    }
    throw new PatrolViewIntegrationError(
      "PATROLVIEW_UNAVAILABLE",
      502,
      "The approved dispatch adapter is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
