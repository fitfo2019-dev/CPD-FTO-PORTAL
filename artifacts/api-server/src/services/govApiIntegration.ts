export type GovApiConfig = {
  REAL_API_URL?: string;
  REAL_API_KEY?: string;
};

export type GovApiFailureCode =
  | "REAL_API_NOT_CONFIGURED"
  | "REAL_API_TIMEOUT"
  | "REAL_API_UNAVAILABLE"
  | "REAL_API_UPSTREAM_ERROR"
  | "REAL_API_INVALID_RESPONSE";

export class GovApiIntegrationError extends Error {
  constructor(
    readonly code: GovApiFailureCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "GovApiIntegrationError";
  }
}

type FetchResponse = Pick<Response, "ok" | "status" | "headers" | "text">;
type FetchFunction = (input: URL, init: RequestInit) => Promise<FetchResponse>;

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_RECORDS = 500;

function resolveConfiguration(
  config: GovApiConfig,
): { endpoint: URL; apiKey: string } {
  const rawUrl = config.REAL_API_URL?.trim();
  const apiKey = config.REAL_API_KEY?.trim();
  if (!rawUrl || !apiKey) {
    throw new GovApiIntegrationError(
      "REAL_API_NOT_CONFIGURED",
      503,
      "The secure records service is not configured.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(rawUrl);
  } catch {
    throw new GovApiIntegrationError(
      "REAL_API_NOT_CONFIGURED",
      503,
      "The secure records service endpoint is invalid.",
    );
  }

  if (
    endpoint.protocol !== "https:"
    || endpoint.username
    || endpoint.password
    || endpoint.hash
  ) {
    throw new GovApiIntegrationError(
      "REAL_API_NOT_CONFIGURED",
      503,
      "The secure records service must use an approved HTTPS URL.",
    );
  }
  return { endpoint, apiKey };
}

export async function fetchGovSecureRecords(
  config: GovApiConfig = process.env,
  fetchImpl: FetchFunction = fetch as FetchFunction,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
): Promise<unknown> {
  const { endpoint, apiKey } = resolveConfiguration(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new GovApiIntegrationError(
        "REAL_API_UPSTREAM_ERROR",
        502,
        "The secure records service returned an unsuccessful response.",
      );
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader && !/^\d+$/.test(contentLengthHeader)) {
      throw new GovApiIntegrationError(
        "REAL_API_INVALID_RESPONSE",
        502,
        "The secure records service returned invalid response metadata.",
      );
    }
    const contentLength = Number(contentLengthHeader ?? "0");
    if (contentLength > MAX_RESPONSE_BYTES) {
      throw new GovApiIntegrationError(
        "REAL_API_INVALID_RESPONSE",
        502,
        "The secure records service response exceeded the allowed size.",
      );
    }

    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
      throw new GovApiIntegrationError(
        "REAL_API_INVALID_RESPONSE",
        502,
        "The secure records service response exceeded the allowed size.",
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new GovApiIntegrationError(
        "REAL_API_INVALID_RESPONSE",
        502,
        "The secure records service returned invalid JSON.",
      );
    }
    const records = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed) &&
          "data" in parsed &&
          Array.isArray(parsed.data)
        ? parsed.data
        : undefined;
    if (!records || records.length > MAX_RECORDS) {
      throw new GovApiIntegrationError(
        "REAL_API_INVALID_RESPONSE",
        502,
        "The secure records service response did not contain a valid records array.",
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof GovApiIntegrationError) throw error;
    if (controller.signal.aborted) {
      throw new GovApiIntegrationError(
        "REAL_API_TIMEOUT",
        504,
        "The secure records service did not respond before the timeout.",
      );
    }
    throw new GovApiIntegrationError(
      "REAL_API_UNAVAILABLE",
      502,
      "The secure records service is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
