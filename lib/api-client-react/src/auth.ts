import { apiEndpoint } from "./api-config.js";
import { customFetch, setMemoryAuthToken } from "./custom-fetch.js";

let token: string | null = null;
let authEpoch = 0;
let pendingLogin: AbortController | null = null;

export function getMockToken(): string | null {
  return token;
}

export function clearMockToken(): void {
  authEpoch++;
  pendingLogin?.abort();
  pendingLogin = null;
  token = null;
  setMemoryAuthToken(null);
}

export type ApiEnvelope<T> = {
  status: "success";
  metadata: Record<string, unknown>;
  data: T[];
};

export async function loginWithMockCredentials(
  username: string,
  password: string,
  signal?: AbortSignal,
): Promise<void> {
  // A new sign-in attempt invalidates prior credentials and any older pending
  // login response, preventing stale responses from restoring a logged-out user.
  const attempt = ++authEpoch;
  pendingLogin?.abort();
  const controller = new AbortController();
  pendingLogin = controller;
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  token = null;
  setMemoryAuthToken(null);
  try {
  const payload = await customFetch<ApiEnvelope<{ token: string }>>(
    apiEndpoint("/auth/mock-login"),
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    },
  );
    if (attempt !== authEpoch) throw new Error("Sign-in was superseded.");
  const newToken = payload.data[0]?.token;
  if (payload.status !== "success" ||
      typeof newToken !== "string" ||
      newToken.length === 0) {
    throw new Error("The sign-in response was incomplete.");
    }
    // Memory only: this token is a development mock, not a credential.
  token = newToken;
    setMemoryAuthToken(token);
  } finally {
    signal?.removeEventListener("abort", abortFromCaller);
    if (pendingLogin === controller) pendingLogin = null;
  }
}
