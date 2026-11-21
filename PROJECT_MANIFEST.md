**Future AI assistants: Read this manifest before modifying the codebase. Preserve the documented API contracts, naming rules, and scope boundaries.**

# Project Manifest

## Current contents and boundaries

This workspace contains an Express API Server and a React/Vite Component Preview Server. The isolated `AdminLogsDashboard` mockup calls a development-only audit-log route; there are no connected product frontend views or data-backed application screens in this workspace. The `callbox\pv3` application exists on the internal server, but its source and runtime are outside this workspace.

The XML-to-JSON gateway is a planned architectural boundary only: a future backend router may receive raw XML or binary input from the Government System, normalize it, and expose clean JSON to the Visual Interface. A JSON records adapter exists, but it is unconfigured; no upstream connection or XML/binary normalization is active.

## Workspace footprint and portability

- Git currently tracks 162 files (verified 2026-11-21).
- The monorepo uses TypeScript project references and enables `noImplicitAny` and `strictNullChecks` across its API, component-preview, scripts, and shared-library checks.
- `pnpm-lock.yaml` is the sole package lockfile (lockfile version 9). Workspace catalogs and overrides centralize package resolution; deployment installs should use `pnpm install --frozen-lockfile`.
- The Express server uses `process.env.PORT || 3000` and binds to `0.0.0.0`.
- `TRUST_PROXY_HOPS` defaults to `1`, is validated as an integer from `1` through `16`, and is applied before security, request logging, and audit middleware.
- Startup fails closed for invalid port, proxy-hop, or `USE_REAL_API` settings. `AUDIT_ID_HMAC_KEY` must be present and at least 32 bytes; production live mode also requires `REAL_API_KEY` and `REAL_API_URL`.

## Completed resilience work

- The React component-preview application wraps its main view in a recoverable Error Boundary. Its “Try again” action clears the failure and remounts the protected view.
- Individual component previews show an accessible loading skeleton while their module imports resolve. Imports have a 15-second timeout; timeout and import failures display a retryable fallback with a “Try again” action that starts a new load attempt.
- The mock sign-in request and isolated `AdminLogsDashboard` request are abortable and bounded to 15 seconds. The dashboard also uses defensive normalization and a retry panel. These are not a connected product records view or a general API timeout layer.
- These resilience features cover the component-preview harness and this one mockup. They do not provide connected data-backed product views.

## Pending implementation: product frontend views

**Current Workspace Limitation:** This workspace features a component-preview harness and a hardened API server, but does not contain the connected data-backed product views. The audit dashboard is an isolated mockup driven only by the development sample endpoint. The internal-server `callbox\pv3` application is outside this source tree.

**CRITICAL FUTURE STEP:** When building out actual user-facing application screens, developers must explicitly connect the frontend views to the backend API using our centralized `API_BASE_URL`. Those views must use defensive parsing, 15-second request timeouts, loading states, and retryable server-error fallbacks. The mockup's timeout is a reference implementation, not a global client guarantee.

## Functional architecture and core user workflows

This workspace is a security-oriented, data-validated prototype foundation for sensitive-records management and administrative compliance workflows. It is not a production identity system or a certified compliance platform.

- **Component Preview Sandbox:** isolated React/Vite environment for visual testing and interface modeling.
- **Backend API Enterprise Gateway:** Express API with JSON validation, same-origin API routing, security middleware, and pseudonymized request auditing. The XML-to-JSON Government System gateway remains planned, not connected.
- **Secure Operator Sign-In:** `loginWithMockCredentials` posts to `POST /api/auth/mock-login` through the centralized API client. In development, the server returns the fixed `mock-jwt-string` demonstration value, which the client stores in memory and `customFetch` can attach as a Bearer header. Logout clears the in-memory token. This value is not a JWT or a real credential; there is no sign-in view or live identity provider, and the current secure-records route does not enforce the mock Bearer helper.
- **Defensive Records Querying:** `GET /api/v1/secure-records` returns schema-normalized records in the standard JSON envelope. `USE_REAL_API` defaults to `false`; live mode uses server-only `REAL_API_URL` and `REAL_API_KEY` and never forwards a browser Authorization header. A connected product records table has not been built. Future screens must use `API_BASE_URL`, defensive optional-chaining/fallback parsing, and a 15-second `AbortController` timeout. The current `AdminLogsDashboard` timeout applies to `/api/v1/audit-logs`, not to a secure-records view.
- **Forensic Audit Logging:** requests under `/api` pass through audit middleware. It emits JSON Lines to standard output with request context and HMAC-pseudonymized `client_ip_hash`; `user_id_hash` is included only for a verified principal. The mock token creates no verified identity. Raw IPs, request bodies, cookies, and Authorization headers are excluded. Standard output is not an immutable audit archive.
- **UI Component Catalog:** the workspace contains 55 reusable, modular UI components. They provide the visual foundation for future application views; the components themselves do not implement authentication, authorization, or data security.

## Folder map

- `artifacts/api-server/` — Express API service, security headers, CORS configuration, request logging, and routes.
- `artifacts/mockup-sandbox/` — React/Vite component preview sandbox and reusable UI component catalog.
- `HANDOVER_MANUAL.md` — functional overview, workflow status, and handover boundaries.
- `lib/api-spec/` — OpenAPI source contract and code generation configuration.
- `lib/api-client-react/` — Generated React Query API client, centralized API base configuration, request wrapper, and development-only mock auth state.
- `lib/api-zod/` — Generated Zod schemas and response validators.
- `lib/db/` — PostgreSQL and Drizzle schema foundation; not connected to active application routes.
- `database/migrations/` — Portable SQL schema and database constraints.
- `docs/` — retained security and project-structure notes; some descriptions refer to the internal-server `callbox\pv3` application. Its source/runtime is outside this workspace, so those documents do not prove that referenced code or routes exist here.
- `scripts/` — Workspace utility scripts for standalone production packaging, including the sample `hello` command.
- `attached_assets/` — User-provided source materials; do not remove as cleanup.
- `replit.md` — current collaborator guidance that points to this manifest.

## Services and configuration

- API Server: Express, listening on the workflow-provided `PORT`.
- Component Preview Server: Vite, using workflow-provided `PORT` and `BASE_PATH`.
- API server runtime: Node.js `^20.19.0 || >=22.12.0 <25`; `pnpm run build:api` builds the service and shared libraries, and `pnpm start` runs it.
- API listener: `PORT` environment value with a `3000` fallback, bound to `0.0.0.0`.
- `API_BASE_URL` is centralized in `lib/api-client-react/src/api-config.ts` and is fixed to the same-origin `/api` route; frontend calls cannot override it with an external origin.
- `AUDIT_ID_HMAC_KEY` is required by request audit logging and must remain in the server secret manager. Never print or log its value.
- `USE_REAL_API` defaults to `false`; mock records are returned unless explicitly enabled.
- `REAL_API_URL` must be an approved HTTPS origin before live records can be requested.
- `REAL_API_KEY` is a server-only secret for the live upstream request. Production initialization fails explicitly if either live setting is missing while `USE_REAL_API=true`.
- `TRUST_PROXY_HOPS` controls whether Express trusts `X-Forwarded-For`; the code defaults to `1` for the internal preview and the shared environment is set to `2` for the confirmed ingress. Valid values are `1` through `16`. Agency administrators must set the exact production proxy-chain length. Do not trust forwarded headers directly.
- CORS uses the explicit, generic `ALLOWED_ORIGINS` list. It does not use a wildcard.

## API contracts

Success responses use the envelope:

```json
{
  "status": "success",
  "metadata": {},
  "data": []
}
```

Error responses use:

```json
{
  "status": "error",
  "error_code": "ERROR_CODE",
  "message": "A safe error message."
}
```

Current routes:

- `GET /api/healthz` returns `{ "status": "success", "metadata": {}, "data": [{ "status": "ok" }] }`.
- `POST /api/auth/mock-login` is development-only. It accepts a username and password and returns a fixed demonstration token; the token is not a JWT and does not represent a real identity.
- `GET /api/v1/secure-records` returns validated mock records by default. The live branch uses `REAL_API_URL` and `REAL_API_KEY`, validates and normalizes upstream records, and never forwards a browser Authorization header.
- `GET /api/v1/audit-logs` returns three deterministic, pseudonymized development samples and returns 404 in production.
- Other API paths return the safe error envelope.
- Backend routers and services are stateless: they do not write local database state, uploads, sessions, or persistent logs. Request audit events and Pino diagnostics stream to standard output. Mock records are in-memory constants. The separate database helper requires `DATABASE_URL` and is not connected to API routes.
- The component preview dev plugin generates a local component registry only for the preview build; it does not store application data.

The OpenAPI source of truth is `lib/api-spec/openapi.yaml`; generated client and validation outputs must be regenerated from it when the contract changes.

## Security and integration limits

- Helmet applies a restrictive Content Security Policy and denies framing. The `X-Powered-By` response header is disabled.
- CORS uses explicit origins rather than a wildcard.
- Request audit events are JSON Lines written to standard output. Actor identifiers and client network addresses are pseudonymized with HMAC using `AUDIT_ID_HMAC_KEY`; request bodies, cookies, authorization headers, and raw client IPs are excluded.
- A role or actor hash is included only when a verified principal is available. The current mock token has no user identity or role claims.
- The live records branch uses only the independent server-level `REAL_API_KEY`; no browser credential is forwarded.
- Forwarded client IPs are trusted only through the configured two-hop ingress chain.
- Standard output is not a write-once or tamper-proof audit archive. No external immutable log collector or retention policy is configured.
- No live identity provider, database-backed application routes, or connected product frontend views exist yet. The database schema and authorization/audit helpers are foundations, not active application features.
- The separate database audit helper is not mounted to current routes. Its existing schema expects an IP address value and must be reviewed before it is connected to the application audit stream.
- Do not claim production readiness, regulatory compliance, or immutable audit retention from these foundations alone.

## Naming and rating rules

- Use only names supplied for the project; do not introduce alternate product terminology.
- Do not use numerical performance ratings.

## Development checks

- `pnpm run typecheck` — workspace TypeScript checks.
- `pnpm run build` — workspace type checks and package builds.
- `pnpm --filter @workspace/api-server run dev` — API Server development workflow.
- `pnpm --filter @workspace/mockup-sandbox run dev` — Component Preview Server workflow.
