import type { CorsOptions } from "cors";

const isProduction = process.env.NODE_ENV === "production";

function normalizeConfiguredOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && url.hostname === "localhost"))
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(normalizeConfiguredOrigin)
  .filter((origin): origin is string => origin !== null);
const allowedOrigins = new Set([
  ...configuredOrigins,
]);

function isLocalDevelopmentOrigin(origin: string): boolean {
  if (isProduction) return false;
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      url.hostname === "localhost" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header are same-origin or non-browser clients.
    // They do not need CORS response headers.
    callback(
      null,
      typeof origin === "string" &&
        (allowedOrigins.has(origin) || isLocalDevelopmentOrigin(origin)),
    );
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
  optionsSuccessStatus: 204,
};
