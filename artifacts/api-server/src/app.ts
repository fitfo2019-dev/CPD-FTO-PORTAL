import express, { type Express } from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import router from "./routes/index.js";
import { corsOptions } from "./lib/cors.js";
import { logger } from "./lib/logger.js";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware.js";
import {
  auditRequestMiddleware,
  recordPayloadSize,
} from "./middlewares/audit-request.js";

declare const __INCLUDE_SYNTHETIC_STAGING__: boolean;

const app: Express = express();

app.disable("x-powered-by");
if (
  process.env.NODE_ENV === "production" &&
  !process.env.CLERK_PUBLISHABLE_KEY?.trim()
) {
  throw new Error(
    "CLERK_PUBLISHABLE_KEY is required for production authentication.",
  );
}
const rawProxyHops = process.env.TRUST_PROXY_HOPS;
const trustProxyHops =
  rawProxyHops === undefined ? 1 : Number.parseInt(rawProxyHops, 10);
if (
  (rawProxyHops !== undefined && !/^\d+$/.test(rawProxyHops.trim())) ||
  !Number.isInteger(trustProxyHops) ||
  trustProxyHops < 1 ||
  trustProxyHops > 16
) {
  throw new Error("TRUST_PROXY_HOPS must be an integer between 1 and 16.");
}
// Express consults X-Forwarded-For only for the configured trusted proxy hops.
// The default supports the internal preview; production must set its exact count.
app.set(
  "trust proxy",
  trustProxyHops,
);
app.use(
  helmet({
    frameguard: { action: "deny" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        frameSrc: ["'none'"],
        childSrc: ["'none'"],
        mediaSrc: ["'none'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
app.use(
  pinoHttp({
    logger,
    genReqId: () => randomUUID(),
    autoLogging: false,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cookieParser());
app.use("/api", auditRequestMiddleware);
app.use(cors(corsOptions));
// Clerk's Frontend API proxy must run before any request-body parser.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
// This API currently accepts only small, uncompressed JSON requests. Disabling
// decompression avoids body-parser's compressed-stream denial-of-service path.
app.use(
  express.json({
    limit: "16kb",
    inflate: false,
    // Packet routes install their own authenticated, bounded 2MB parser.
    type: (req) => !req.url?.split("?")[0]?.startsWith("/api/v1/training-packets") &&
      Boolean(req.headers["content-type"]?.split(";")[0] === "application/json"),
    verify(req, _res, buffer) {
      recordPayloadSize(req, buffer.byteLength);
    },
  }),
);

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Development-only public entry point for fictional approval previews. The
// /api path is intentionally excluded by the portal's old service worker,
// which may otherwise replace every navigation with its cached sign-in shell.
app.get("/api/preview", (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ status: "error", error_code: "NOT_FOUND",
      message: "The requested endpoint is unavailable." });
    return;
  }
  if (req.query.component !== "PacketReviewPreview") { next(); return; }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Agency packet review preview</title>
<script type="module">import { injectIntoGlobalHook } from "/__mockup/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;</script>
<script type="module" src="/__mockup/@vite/client"></script>
</head><body style="margin:0"><div id="root"></div><script type="module" src="/__mockup/src/main.tsx"></script></body></html>`);
});

app.use("/api", router);

// The agency-release compiler removes this branch and its entire dependency
// graph. The normal sign-in and agency-scope checks cannot be bypassed.
if (typeof __INCLUDE_SYNTHETIC_STAGING__ !== "undefined" && __INCLUDE_SYNTHETIC_STAGING__
  && process.env.SYNTHETIC_STAGING_ENABLED === "true") {
  const { default: stagingRouter } = await import("./developer-staging/index.js");
  app.use("/api", stagingRouter);
}

app.use((_req, res) => {
  res.status(404).json({
    status: "error",
    error_code: "NOT_FOUND",
    message: "The requested endpoint is unavailable.",
  });
});

// Body-parser errors are converted to a safe envelope without reflecting input.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? Number((err as { status?: unknown }).status)
        : 500;
    const isClientError = status === 400 || status === 413 || status === 415;
    res.status(isClientError ? status : 500).json({
      status: "error",
      error_code:
        status === 413
          ? "PAYLOAD_TOO_LARGE"
          : status === 415
            ? "UNSUPPORTED_CONTENT_ENCODING"
            : isClientError
              ? "INVALID_JSON"
              : "INTERNAL_ERROR",
      message:
        status === 413
          ? "Request body is too large."
          : status === 415
            ? "Compressed request bodies are not accepted."
            : isClientError
              ? "Request body must contain valid JSON."
              : "The request could not be completed.",
    });
  },
);

export default app;
