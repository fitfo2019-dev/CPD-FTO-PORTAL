/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - Only active in production (Clerk proxying doesn't work for dev instances)
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware.js";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import { ServerResponse, type IncomingMessage } from "node:http";
import { isIP } from "node:net";
import type { Request, RequestHandler } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const CLERK_FAPI = 'https://frontend-api.clerk.dev';
export const CLERK_PROXY_PATH = '/api/__clerk';

function normalizeProxyHost(hostname: string | undefined): string | undefined {
  const candidate = hostname?.trim();
  if (!candidate || /[\u0000-\u0020/@?#\\]/u.test(candidate)) return undefined;

  try {
    const parsed = new URL(`https://${candidate}`);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return undefined;
    }
    return parsed.host;
  } catch {
    return undefined;
  }
}

/**
 * Express resolves hostname using its validated trust-proxy configuration.
 * Do not parse X-Forwarded-Host directly here: callers must use the same
 * trusted-hop policy as the request logger and rate-limiting middleware.
 */
export function getClerkProxyHost(
  req: Pick<Request, "hostname">,
): string | undefined {
  return normalizeProxyHost(req.hostname);
}

function expressRequestFromProxyRequest(
  req: IncomingMessage,
): Pick<Request, "hostname" | "ip"> {
  return req as IncomingMessage & Pick<Request, "hostname" | "ip">;
}

export function clerkProxyMiddleware(): RequestHandler {
  // Only run proxy in production — Clerk proxying doesn't work for dev instances
  if (process.env.NODE_ENV !== 'production') {
    return (_req, _res, next) => next();
  }

  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required for the production Clerk proxy.");
  }

  const proxy = createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    timeout: 10_000,
    proxyTimeout: 10_000,
    // Take over the response so it can be re-sent with a Content-Length (see
    // proxyRes); the deployment edge rejects chunked proxied responses.
    selfHandleResponse: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ''),
    on: {
      proxyReq: (proxyReq, req) => {
        const trustedRequest = expressRequestFromProxyRequest(req);
        const host = getClerkProxyHost(trustedRequest);
        if (!host) {
          proxyReq.destroy(new Error("A valid trusted proxy host is required."));
          return;
        }

        // Discard client-supplied forwarding headers and replace the address
        // with Express's client IP after applying the configured trusted hops.
        for (const header of [
          "forwarded",
          "x-forwarded-for",
          "x-forwarded-host",
          "x-forwarded-port",
          "x-forwarded-proto",
          "clerk-secret-key",
        ]) {
          proxyReq.removeHeader(header);
        }
        proxyReq.setHeader(
          "Clerk-Proxy-Url",
          new URL(CLERK_PROXY_PATH, `https://${host}`).toString(),
        );
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);
        const clientIp = trustedRequest.ip;
        if (clientIp && isIP(clientIp)) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }
      },
      // Clerk's dynamic Frontend API responses (/v1/environment, /v1/client,
      // JWKS, ...) arrive without a Content-Length, so relaying them would use
      // Transfer-Encoding: chunked — which the deployment edge (Cloud Run)
      // rejects, turning the app's 200 into a 500. Buffer only those so they can
      // be re-sent with a Content-Length; the body is forwarded untouched so
      // Content-Encoding is preserved. Length-known responses (e.g. /npm/*
      // assets) and body-less responses stream through without buffering.
      proxyRes: (proxyRes, req, res) => {
        const headers = { ...proxyRes.headers };
        // Transfer-Encoding/Connection are hop-by-hop (RFC 7230 §6.1).
        delete headers['transfer-encoding'];
        delete headers['connection'];
        delete headers['keep-alive'];

        const status = proxyRes.statusCode ?? 502;
        // Content-Length is forbidden on 1xx/204; HEAD/304 may keep theirs.
        if (status < 200 || status === 204) {
          delete headers['content-length'];
        }

        const bodyless =
          req.method === 'HEAD' ||
          status < 200 ||
          status === 204 ||
          status === 304;
        if (headers['content-length'] !== undefined || bodyless) {
          res.writeHead(status, headers);
          // Headers are already sent, so abort the response if the upstream
          // stream errors mid-pipe (e.g. ECONNRESET) rather than leaving an
          // unhandled 'error' or a hung client.
          proxyRes.on('error', () => res.destroy());
          proxyRes.pipe(res);
          return;
        }

        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
        proxyRes.on('end', () => {
          const body = Buffer.concat(chunks);
          headers['content-length'] = String(body.length);
          res.writeHead(status, headers);
          res.end(body);
        });
        proxyRes.on('error', () => {
          if (!res.headersSent) {
            // Set a length so the empty 502 isn't sent chunked (which the
            // deployment edge would reject just like the original response).
            res.writeHead(502, { 'content-length': '0' });
          }
          res.end();
        });
      },
      error: (_error, _req, response) => {
        if (!(response instanceof ServerResponse)) {
          response.destroy();
          return;
        }
        if (response.headersSent) {
          response.destroy();
          return;
        }
        response.writeHead(502, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        });
        response.end(JSON.stringify({
          status: "error",
          error_code: "CLERK_PROXY_UNAVAILABLE",
          message: "The sign-in service is temporarily unavailable.",
        }));
      },
    },
  });

  return (req, res, next) => {
    if (!getClerkProxyHost(req)) {
      res.status(400).json({
        status: "error",
        error_code: "INVALID_PROXY_HOST",
        message: "The sign-in request host could not be validated.",
      });
      return;
    }
    proxy(req, res, next);
  };
}
