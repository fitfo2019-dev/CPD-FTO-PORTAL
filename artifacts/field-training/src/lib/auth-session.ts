export type ClerkSessionIdentity = {
  accountId: string;
  sessionId: string;
};

export type ValidateClerkSession = (expected: ClerkSessionIdentity) => Promise<void>;

export const AUTHENTICATION_REQUIRED_MESSAGE = "Sign in again to access agency packets.";

export class AuthenticationRequiredError extends Error {
  readonly status = 401;

  constructor() {
    super(AUTHENTICATION_REQUIRED_MESSAGE);
    this.name = "AuthenticationRequiredError";
  }
}

export function isAuthenticationRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: unknown; statusCode?: unknown; code?: unknown; error_code?: unknown };
  return value.status === 401 || value.statusCode === 401 ||
    value.code === "UNAUTHENTICATED" || value.code === "AUTHENTICATION_REQUIRED" ||
    value.error_code === "UNAUTHENTICATED" || value.error_code === "AUTHENTICATION_REQUIRED";
}

export async function validateClerkSession(
  validate: ValidateClerkSession | undefined,
  expected: ClerkSessionIdentity | undefined,
): Promise<void> {
  if (!validate || !expected?.accountId || !expected.sessionId) throw new AuthenticationRequiredError();
  try {
    await validate(expected);
  } catch {
    throw new AuthenticationRequiredError();
  }
}
