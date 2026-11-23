export { setBaseUrl, setAuthTokenGetter, setMemoryAuthToken } from "./custom-fetch.js";
export type { AuthTokenGetter } from "./custom-fetch.js";
export { API_BASE_URL, apiEndpoint } from "./api-config.js";
export { loginWithMockCredentials, getMockToken, clearMockToken } from "./auth.js";
export type { ApiEnvelope } from "./auth.js";
export * from './generated/api.schemas';
export * from './generated/api';
