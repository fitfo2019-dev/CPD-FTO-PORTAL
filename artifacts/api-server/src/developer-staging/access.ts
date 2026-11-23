import { createHash, timingSafeEqual } from "node:crypto";
import { clerkClient, getAuth } from "@clerk/express";
import type { Request, RequestHandler, Response } from "express";

export type VerifiedStagingSession = { subject: string; sessionId: string; recentMfa: boolean };
export type SessionResolver = (req: Request) => Promise<VerifiedStagingSession | null>;

export function stagingError(res: Response, code: number, errorCode: string, message: string): void {
  res.status(code).json({ status: "error", error_code: errorCode, message });
}

/** No browser-provided role, user header, mock token or metadata grants access. */
export const resolveClerkSession: SessionResolver = async req => {
  const auth = getAuth(req);
  if (!auth.userId || !auth.sessionId) return null;
  // Online session check makes revocation effective on the next request.
  const session = await clerkClient.sessions.getSession(auth.sessionId);
  if (session.status !== "active" || session.userId !== auth.userId) return null;
  const factorAge: unknown = auth.sessionClaims?.fva;
  const recentMfa = Array.isArray(factorAge) && factorAge.length === 2
    && typeof factorAge[1] === "number" && factorAge[1] >= 0 && factorAge[1] < 15;
  return { subject: auth.userId, sessionId: auth.sessionId, recentMfa };
};

/** An additional developer perimeter; never an identity or agency-role substitute. */
export function developerPasswordGate(password: string): RequestHandler {
  if (password.length < 16 || password.length > 1024) {
    throw new Error("Developer staging requires a separate password of 16–1024 characters.");
  }
  const expected = createHash("sha256").update(password).digest();
  const attempts = new Map<string, { count: number; until: number }>();
  let globalWindow = { count: 0, until: Date.now() + 60_000 };
  return (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    const now = Date.now();
    if (globalWindow.until <= now) globalWindow = { count: 0, until: now + 60_000 };
    // Bounded, hashed keys. No IP/password is logged or persisted by this gate.
    const source = createHash("sha256").update(req.ip ?? "").digest("hex");
    const prior = attempts.get(source);
    const budget = prior && prior.until > now ? prior : { count: 0, until: now + 60_000 };
    if (globalWindow.count >= 200 || budget.count >= 10) {
      res.set("Retry-After", "60");
      stagingError(res, 429, "STAGING_RATE_LIMITED", "Developer staging access is temporarily limited.");
      return;
    }
    const supplied = req.get("X-Developer-Staging-Password") ?? "";
    const actual = createHash("sha256").update(supplied).digest();
    if (!supplied || supplied.length > 1024 || !timingSafeEqual(expected, actual)) {
      budget.count += 1;
      globalWindow.count += 1;
      if (attempts.size >= 1000 && !attempts.has(source)) attempts.clear();
      attempts.set(source, budget);
      stagingError(res, 401, "DEVELOPER_ACCESS_REQUIRED", "Developer staging access is required.");
      return;
    }
    next();
  };
}
