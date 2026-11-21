import { verifyToken } from "@clerk/backend";

export type GovApiConfig = {
  GOV_API_SECURE_RECORDS_URL?: string;
  GOV_API_ALLOWED_HOSTS?: string;
  GOV_API_AUDIENCE?: string;
  GOV_API_AUTHORIZED_PARTIES?: string;
  CLERK_SECRET_KEY?: string;
};

export type GovApiFailureCode =
  | "GOV_API_NOT_CONFIGURED"
  | "GOV_API_BEARER_INVALID"
  | "GOV_API_BEARER_REQUIRED"
  | "GOV_API_TIMEOUT"
  | "GOV_API_UNAVAILABLE"
  | "GOV_API_UPSTREAM_ERROR"
  | "GOV_API_INVALID_RESPONSE";

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
type TokenVerifier = (
  token: string,
  options: { secretKey: string; audience: string; authorizedParties: string[] },
) => Promise<{ sub?: string }>;

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_RECORDS = 500;

function resolveApprovedEndpoint(config: GovApiConfig): URL {
  if (
    !config.GOV_API_SECURE_RECORDS_URL
    || !config.GOV_API_AUDIENCE
    || !config.GOV_API_ALLOWED_HOSTS
    || !config.GOV_API_AUTHORIZED_PARTIES
    || !config.CLERK_SECRET_KEY
  ) {
    throw new GovApiIntegrationError(
      "GOV_API_NOT_CONFIGURED",
      503,
      "The approved government API connection is not configured.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(config.GOV_API_SECURE_RECORDS_URL);
  } catch {
    throw new GovApiIntegrationError(
      "GOV_API_NOT_CONFIGURED",
      503,
      "The approved government API endpoint is invalid.",
    );
  }

  const approvedHosts = new Set(
    config.GOV_API_ALLOWED_HOSTS.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
  );
  if (
    endpoint.protocol !== "https:"
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
    || !approvedHosts.has(endpoint.hostname.toLowerCase())
  ) {
    throw new GovApiIntegrationError(
      "GOV_API_NOT_CONFIGURED",
      503,
      "The government API endpoint is not on the approved HTTPS host list.",
    );
  }
  return endpoint;
}

/**
 * Forwards only the original bearer header, only to a configured HTTPS host,
 * and only when Clerk-validated session claims contain the approved audience.
 * The client token is never logged or returned to the caller.
 */
export async function fetchGovSecureRecords(
  input: {
    authorizationHeader: string | undefined;
    authenticatedUserId: string;
  },
  config: GovApiConfig = process.env,
  fetchImpl: FetchFunction = fetch as FetchFunction,
  tokenVerifier: TokenVerifier = (token, options) => verifyToken(token, options),
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
): Promise<unknown[]> {
  const endpoint = resolveApprovedEndpoint(config);
  const bearerMatch = input.authorizationHeader?.match(/^Bearer ([A-Za-z0-9._~+/-]+=*)$/);
  if (!bearerMatch) {
    throw new GovApiIntegrationError(
      "GOV_API_BEARER_REQUIRED",
      401,
      "A validated bearer token is required for the live connection.",
    );
  }

  const authorizedParties = config.GOV_API_AUTHORIZED_PARTIES!
    .split(",")
    .map((party) => party.trim())
    .filter(Boolean);
  if (!authorizedParties.length) {
    throw new GovApiIntegrationError(
      "GOV_API_NOT_CONFIGURED",
      503,
      "The approved government API connection is not configured.",
    );
  }

  let verifiedClaims: { sub?: string };
  try {
    verifiedClaims = await tokenVerifier(bearerMatch[1], {
      secretKey: config.CLERK_SECRET_KEY!,
      audience: config.GOV_API_AUDIENCE!,
      authorizedParties,
    });
  } catch {
    throw new GovApiIntegrationError(
      "GOV_API_BEARER_INVALID",
      401,
      "The bearer token could not be validated for the approved API.",
    );
  }
  if (!verifiedClaims.sub || verifiedClaims.sub !== input.authenticatedUserId) {
    throw new GovApiIntegrationError(
      "GOV_API_BEARER_INVALID",
      401,
      "The bearer token identity did not match the authenticated account.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: input.authorizationHeader,
      },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new GovApiIntegrationError(
        "GOV_API_UPSTREAM_ERROR",
        502,
        "The approved government API returned an unsuccessful response.",
      );
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_RESPONSE_BYTES) {
      throw new GovApiIntegrationError(
        "GOV_API_INVALID_RESPONSE",
        502,
        "The government API response exceeded the allowed size.",
      );
    }

    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
      throw new GovApiIntegrationError(
        "GOV_API_INVALID_RESPONSE",
        502,
        "The government API response exceeded the allowed size.",
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new GovApiIntegrationError(
        "GOV_API_INVALID_RESPONSE",
        502,
        "The government API returned invalid JSON.",
      );
    }
    if (!Array.isArray(parsed) || parsed.length > MAX_RECORDS) {
      throw new GovApiIntegrationError(
        "GOV_API_INVALID_RESPONSE",
        502,
        "The government API response did not match the expected records array.",
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof GovApiIntegrationError) throw error;
    if (controller.signal.aborted) {
      throw new GovApiIntegrationError(
        "GOV_API_TIMEOUT",
        504,
        "The approved government API did not respond before the timeout.",
      );
    }
    throw new GovApiIntegrationError(
      "GOV_API_UNAVAILABLE",
      502,
      "The approved government API is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
