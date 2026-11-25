import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Request, RequestHandler, Response } from "express";
import type { Principal, Role } from "../security/authorization.js";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";
const payloadSizes = new WeakMap<IncomingMessage, number>();
const roles: readonly Role[] = [
  "PO",
  "FTO",
  "FTO_SGT",
  "FTO_COORDINATOR",
  "FTO_COC",
  "POLICENET",
  "POLICENET_ADMIN_SGT",
];

export function recordPayloadSize(
  req: IncomingMessage,
  byteLength: number,
): void {
  if (Number.isSafeInteger(byteLength) && byteLength >= 0) {
    payloadSizes.set(req, byteLength);
  }
}

function payloadSize(req: Request): number {
  const observed = payloadSizes.get(req);
  if (observed !== undefined) return observed;

  const contentLength = req.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    const parsed = Number(contentLength);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return 0;
}

function endpointTemplate(req: Request): string {
  const routePath = req.route?.path;
  if (typeof routePath !== "string") return "/api/<unmatched>";
  return `/api${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}

function verifiedPrincipal(res: Response): Principal | null {
  const principal = (res.locals as { principal?: unknown }).principal;
  if (typeof principal !== "object" || principal === null) return null;

  const candidate = principal as Partial<Principal>;
  if (
    typeof candidate.id !== "string" ||
    candidate.id.length === 0 ||
    !roles.includes(candidate.role as Role)
  ) {
    return null;
  }
  return candidate as Principal;
}

function browserUserAgent(value: string | undefined): string | null {
  if (!value) return null;
  const browsers: Array<[RegExp, string]> = [
    [/\bEdg(?:A|iOS)?\/(\d+)/i, "Edge"],
    [/\bOPR\/(\d+)/i, "Opera"],
    [/\bFirefox\/(\d+)/i, "Firefox"],
    [/\bChrome\/(\d+)/i, "Chrome"],
    [/\bVersion\/(\d+).*Safari/i, "Safari"],
  ];
  for (const [pattern, name] of browsers) {
    const match = pattern.exec(value);
    if (match) return `${name}/${match[1]}`;
  }
  return "Other";
}

function writeAuditEvent(
  req: Request,
  res: Response,
  responseCompleted: boolean,
): void {
  const principal = verifiedPrincipal(res);
  const clientIp = req.ip || req.socket.remoteAddress || "";
  const requestId =
    typeof req.id === "string" && req.id.length > 0 ? req.id : randomUUID();
  const statusCode = res.statusCode;
  const success = responseCompleted && statusCode >= 200 && statusCode < 400;

  const event = {
    timestamp: new Date().toISOString(),
    request_id: requestId,
    actor: principal
      ? {
          user_id_hash: hashUserIdentifier(principal.id),
          assigned_role: principal.role,
        }
      : "ANONYMOUS",
    network: {
      client_ip_hash: clientIp ? hashUserIdentifier(clientIp) : null,
      user_agent: browserUserAgent(req.get("user-agent")),
    },
    event: {
      http_method: req.method,
      endpoint: endpointTemplate(req),
      payload_bytes: payloadSize(req),
      status_code: statusCode,
      success,
      disposition: success ? "SUCCESS" : "FAILURE",
    },
  };

  // Emit one JSON object per line. Raw IPs, request bodies, cookies and
  // authorization headers are deliberately excluded from this event.
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

export const auditRequestMiddleware: RequestHandler = (req, res, next) => {
  let written = false;
  const finalize = (responseCompleted: boolean) => {
    if (written) return;
    written = true;
    writeAuditEvent(req, res, responseCompleted);
  };

  res.once("finish", () => finalize(true));
  res.once("close", () => finalize(res.writableFinished));
  next();
};
