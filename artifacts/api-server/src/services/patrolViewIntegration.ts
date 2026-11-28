import { OperationalCadUnit, operationalIdentityFromCad, type OperationalIdentity } from "@workspace/api-zod/operational-profile";

export type PatrolViewConfig = {
  PATROLVIEW_EVENT_LOOKUP_URL?: string;
  PATROLVIEW_INCIDENT_LOOKUP_URL?: string;
  PATROLVIEW_API_TOKEN?: string;
};

export type DispatchEventPrefill = {
  cadIdentity?: OperationalIdentity;
  eventDate?: string;
  eventIngressAt?: string;
  incidentNumber?: string;
  location?: string;
  locationAddress?: string;
  locationCity?: string;
  locationState?: string;
  locationZip?: string;
  zone?: string;
  cruiserDistrict?: string;
  dispatchedCode?: string;
  situationFoundCode?: string;
  clearanceCode?: "" | "1V" | "2V" | "3V" | "4V";
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

  const rawDate = optionalText(data, ["eventDate", "event_date", "incidentDate", "incident_date", "date"], 32, "incident date");
  let eventDate: string | undefined;
  if (rawDate) {
    const parsedDate = new Date(`${rawDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== rawDate) {
      throw new PatrolViewIntegrationError("PATROLVIEW_INVALID_RESPONSE", 502, "The approved dispatch adapter returned an invalid incident date.");
    }
    eventDate = rawDate;
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
  const locationAddress = optionalText(data, ["locationAddress", "location_address", "streetAddress", "street_address", "address"], 200, "street address");
  const locationCity = optionalText(data, ["locationCity", "location_city", "city"], 80, "city");
  const rawState = optionalText(data, ["locationState", "location_state", "state"], 8, "state");
  const locationState = rawState?.toUpperCase();
  if (locationState && !/^[A-Z]{2}$/.test(locationState)) {
    throw new PatrolViewIntegrationError("PATROLVIEW_INVALID_RESPONSE", 502, "The approved dispatch adapter returned an invalid state.");
  }
  const locationZip = optionalText(data, ["locationZip", "location_zip", "zipCode", "zip_code", "zip"], 10, "ZIP code");
  if (locationZip && !/^\d{5}(?:-\d{4})?$/.test(locationZip)) {
    throw new PatrolViewIntegrationError("PATROLVIEW_INVALID_RESPONSE", 502, "The approved dispatch adapter returned an invalid ZIP code.");
  }
  const zone = optionalText(data, ["zone", "zoneName", "zone_name"], 40, "zone");
  const cruiserDistrict = optionalText(data, ["cruiserDistrict", "cruiser_district"], 40, "cruiser district");
  const rawCode = optionalText(
    data,
    ["dispatchedCode", "dispatched_code", "tenCode", "ten_code"],
    8,
    "10-code",
  );
  let dispatchedCode: string | undefined;
  if (rawCode) {
    const normalized = rawCode.replace(/^10[\s-]*/i, "").toUpperCase();
    if (!/^\d{1,3}[A-Z]{0,2}$/.test(normalized)) {
      throw new PatrolViewIntegrationError(
        "PATROLVIEW_INVALID_RESPONSE",
        502,
        "The approved dispatch adapter returned an invalid 10-code.",
      );
    }
    dispatchedCode = normalized;
  }

  // Situation found is the 10-code the officer enters in CAD's situation found field when clearing.
  const rawSituation = optionalText(data, ["situationFoundCode", "situation_found_code", "situationFound", "situation_found"], 8, "situation found code");
  const situationFoundCode = rawSituation?.replace(/^10[\s-]*/i, "").toUpperCase();
  if (situationFoundCode && !/^\d{1,3}[A-Z]{0,2}$/.test(situationFoundCode)) {
    throw new PatrolViewIntegrationError("PATROLVIEW_INVALID_RESPONSE", 502, "The approved dispatch adapter returned an invalid situation found code.");
  }

  const rawClearance = optionalText(data, ["clearanceCode", "clearance_code"], 8, "clearance code");
  const clearanceCode = rawClearance?.toUpperCase();
  if (clearanceCode && !["1V", "2V", "3V", "4V"].includes(clearanceCode)) {
    throw new PatrolViewIntegrationError("PATROLVIEW_INVALID_RESPONSE", 502, "The approved dispatch adapter returned an unsupported clearance code.");
  }

  return {
    ...(eventDate ? { eventDate } : {}),
    ...(eventIngressAt ? { eventIngressAt } : {}),
    ...(incidentNumber ? { incidentNumber } : {}),
    ...(location ? { location } : {}),
    ...(locationAddress ? { locationAddress } : {}),
    ...(locationCity ? { locationCity } : {}),
    ...(locationState ? { locationState } : {}),
    ...(locationZip ? { locationZip } : {}),
    ...(zone ? { zone } : {}),
    ...(cruiserDistrict ? { cruiserDistrict } : {}),
    ...(dispatchedCode ? { dispatchedCode } : {}),
    ...(situationFoundCode ? { situationFoundCode } : {}),
    ...(clearanceCode ? { clearanceCode: clearanceCode as DispatchEventPrefill["clearanceCode"] } : {}),
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
  return mapPatrolViewEvent(await fetchPatrolViewJson(endpoint,apiToken,fetchImpl,requestTimeoutMs));
}

/** Operational event ingress must positively identify the exact CAD unit.
 * The older generic mapper remains available for offline/import compatibility. */
export async function fetchPatrolViewUnitEvent(
  eventId: string, cadUnit: string, config: PatrolViewConfig = process.env,
  fetchImpl: FetchFunction = fetch as FetchFunction,
): Promise<DispatchEventPrefill> {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(eventId) || !OperationalCadUnit.safeParse(cadUnit).success) {
    throw new PatrolViewIntegrationError("PATROLVIEW_INVALID_RESPONSE", 400, "Invalid event or CAD unit.");
  }
  const { endpointTemplate, apiToken } = configuration(config);
  const payload = await fetchPatrolViewJson(new URL(endpointTemplate.replace("{eventId}", encodeURIComponent(eventId))), apiToken, fetchImpl);
  const root = record(payload);
  const event = record(root?.data) ?? record(root?.event) ?? root;
  const cadIdentity = event ? operationalIdentityFromCad(event) : undefined;
  if (!cadIdentity || cadIdentity.cadUnit !== cadUnit) return {};
  return { ...mapPatrolViewEvent(event), cadIdentity };
}

/** Shared bounded machine-to-machine transport; never accepts browser headers. */
export async function fetchPatrolViewJson(
  endpoint: URL,
  apiToken: string,
  fetchImpl: FetchFunction = fetch as FetchFunction,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
): Promise<unknown> {
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
    return parsed;
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
