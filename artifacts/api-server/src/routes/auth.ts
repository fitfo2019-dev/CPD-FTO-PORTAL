import { Router, type IRouter } from "express";
import type { RequestHandler, Response } from "express";

const router: IRouter = Router();
export const requireMockBearer: RequestHandler = (req, res, next) => {
  const accepted = process.env.NODE_ENV !== "production" &&
    req.get("authorization") === "Bearer mock-jwt-string";
  if (!accepted) {
    res.status(401).json({
      status: "error",
      error_code: "AUTH_FAILURE",
      message: "The system could not validate the provided credentials.",
    });
    return;
  }
  next();
};

function error(res: Response, statusCode: number, code: string, message: string) {
  return res.status(statusCode).json({ status: "error", error_code: code, message });
}

router.post("/auth/mock-login", (req, res) => {
  const body: unknown = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    error(res, 400, "INVALID_REQUEST", "A JSON object with username and password is required.");
    return;
  }
  const input = body as Record<string, unknown>;
  const username = input.username;
  const password = input.password;
  const allowedKeys = Object.keys(input).every((key) => key === "username" || key === "password");
  if (!allowedKeys || typeof username !== "string" || typeof password !== "string" ||
      username.trim().length < 1 || username.trim().length > 64 ||
      !/^[\p{L}\p{N}._@-]+$/u.test(username.trim()) ||
      password.length < 8 || password.length > 256) {
    error(res, 400, "INVALID_REQUEST", "Username or password does not meet the mock login requirements.");
    return;
  }
  if (process.env.NODE_ENV === "production") {
    error(res, 404, "NOT_FOUND", "The requested endpoint is unavailable.");
    return;
  }

  // Intentionally fixed, non-JWT demonstration value. It grants no server
  // access and is never accepted as a production credential.
  res.status(200).json({
    status: "success",
    metadata: {},
    data: [{ token: "mock-jwt-string" }],
  });
});

export default router;
