const MAX_RESPONSE_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 10_000;
const UPSTREAM_PATH = "/api/v1/secure-records";

export class GovApiError extends Error {
  constructor(readonly statusCode: 502 | 503 | 504) {
    super("UPSTREAM_SERVICE_FAILURE");
    this.name = "GovApiError";
  }
}

function getRealApiUrl(): URL {
  const configuredUrl = process.env.REAL_API_URL;
  if (!configuredUrl) {
    throw new GovApiError(503);
  }

  try {
    const baseUrl = new URL(configuredUrl);
    if (
      baseUrl.protocol !== "https:" ||
      baseUrl.username ||
      baseUrl.password ||
      baseUrl.pathname !== "/" ||
      baseUrl.search ||
      baseUrl.hash
    ) {
      throw new Error("Invalid upstream base URL.");
    }
    return new URL(UPSTREAM_PATH, baseUrl);
  } catch {
    throw new GovApiError(503);
  }
}

async function readJsonWithinLimit(response: Response): Promise<unknown> {
  const contentType = response.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (
    contentType !== "application/json" &&
    !(contentType?.startsWith("application/") && contentType.endsWith("+json"))
  ) {
    throw new GovApiError(502);
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new GovApiError(502);
  }

  if (!response.body) {
    throw new GovApiError(502);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new GovApiError(502);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof GovApiError) throw error;
    throw new GovApiError(502);
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new GovApiError(502);
  }
}

/**
 * Uses only the server-level credential. Never accept or forward a browser
 * Authorization header or the demonstration mock token upstream.
 *
 * Add only documented upstream headers here. If the provider requires a
 * client certificate, provision it through an approved secret/certificate
 * mechanism; never commit certificates or credential material.
 */
export async function fetchRealGovernmentData(): Promise<unknown> {
  const apiKey = process.env.REAL_API_KEY?.trim();
  if (!apiKey || apiKey.length > 8192 || /[\r\n]/.test(apiKey)) {
    throw new GovApiError(503);
  }
  const url = getRealApiUrl();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // Do not forward credentials across an upstream redirect.
      redirect: "manual",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new GovApiError(504);
    }
    throw new GovApiError(502);
  }

  if (!response.ok) {
    throw new GovApiError(502);
  }
  return readJsonWithinLimit(response);
}
