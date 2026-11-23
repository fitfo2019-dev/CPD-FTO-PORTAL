import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

/**
 * Establishes only that Clerk authenticated a user. It does not grant a
 * FieldReady role, prove agency employment, verify MFA, or authorize access to
 * a report. Report and signature routes must add those checks before mounting.
 */
export const requireClerkAuthentication: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({
      status: "error",
      error_code: "AUTHENTICATION_REQUIRED",
      message: "Sign-in is required.",
    });
    return;
  }
  res.locals.clerkUserId = userId;
  next();
};
