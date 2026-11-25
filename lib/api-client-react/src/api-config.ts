/** Browser requests stay on the same-origin internal API mount. */
export const API_BASE_URL = "/api";

/** Build an internal API path; absolute and protocol-relative URLs are rejected. */
export function apiEndpoint(path: string): string {
  const normalized = path.trim();
  if (
    !normalized ||
    normalized.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(normalized)
  ) {
    throw new TypeError("API endpoints must be same-origin internal paths.");
  }

  const apiPath =
    normalized === "/api" || normalized.startsWith("/api/")
      ? normalized
      : `/api/${normalized.replace(/^\/+/, "")}`;
  const parsed = new URL(apiPath, "http://api.local");
  if (
    parsed.origin !== "http://api.local" ||
    !parsed.pathname.startsWith("/api")
  ) {
    throw new TypeError(
      "API endpoints must remain under the internal /api route.",
    );
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
