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

const app: Express = express();

app.disable("x-powered-by");
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
  parseInt(process.env.TRUST_PROXY_HOPS ?? "", 10) || 1,
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

app.use("/api", router);

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
