# Handover Manual

**Before modifying this workspace, read `PROJECT_MANIFEST.md` and preserve its API contracts, naming rules, and scope boundaries.**

## Functional Architecture & Core User Workflows

### Functional Overview

This workspace is a security-oriented, data-validated prototype foundation for sensitive-records management and administrative compliance workflows. It separates visual interface modeling, local Field Training Officer workflows, and backend API responsibilities:

- **Component Preview Sandbox:** an isolated React/Vite environment for visual testing and interface modeling.
- **Field Training Officer Portal:** a React/Vite portal with Clerk sign-in and encrypted, device-local drafts. It does not synchronize those drafts with the API.
- **Backend API Enterprise Gateway:** an Express service that exposes same-origin JSON routes, validates and normalizes data, applies security middleware, and pseudonymizes request audit fields.

These are separate workspace artifacts, not a connected production records application. The `callbox\pv3` application exists on the internal server, but its source and runtime are outside this workspace. The XML-to-JSON Government System gateway is a planned architectural boundary; no Government System connection or XML/binary normalization is active.

Clerk sign-in is present, but no agency identity mapping, department role policy, database-backed training-record service, or certified compliance controls are configured. Mock data and demonstration credentials must not be treated as production records or access controls.

### Workflow 1: Secure Operator Sign-In

The shared frontend client provides a development-only demonstration flow:

1. `loginWithMockCredentials` sends username and password to `POST /api/auth/mock-login` through the centralized `API_BASE_URL`. The request is abortable and stops after 15 seconds with a retryable error.
2. The endpoint validates the request shape and, in development, returns the standard success envelope containing the fixed value `mock-jwt-string`.
3. The client stores the value in JavaScript memory only. It does not use `localStorage`; `clearMockToken()` clears it on logout.
4. Subsequent requests made through `customFetch` can receive an `Authorization: Bearer <token>` header.

**Important limit:** `mock-jwt-string` is not a JWT, a real credential, or proof of a verified identity. The endpoint is disabled in production. It is separate from the Field Training Officer Portal's Clerk cookie session and does not provide production authorization.

### Workflow 2: Defensive Records Querying

The backend provides `GET /api/v1/secure-records`. It returns validated records in the standard JSON envelope. `USE_REAL_API` defaults to `false`, so requests use deterministic in-memory mock records. If live mode is explicitly enabled, the server requires a verified Clerk session and server-side authorization grant, uses `REAL_API_URL` and the server-only `REAL_API_KEY`, normalizes the upstream response, and never forwards a browser Authorization header. Production startup fails if required live configuration is missing. The department authorization grant is not currently configured, so the live route fails closed.

**Current frontend status:** the Field Training Officer Portal has workflow views, but no connected product records table calls `/api/v1/secure-records`. A future records view should use the centralized `API_BASE_URL`, validate and normalize response fields, use optional chaining and fallback values for incomplete data, and enforce a 15-second `AbortController` timeout with a retryable error state.

The `AdminLogsDashboard` component is an isolated mockup that calls the development-only `GET /api/v1/audit-logs` endpoint. That mockup includes defensive parsing, cancellation, a 15-second timeout, and a retry action. Its timeout is not a global client guarantee and does not mean a secure-records product view exists.

### Workflow 3: Forensic Audit Logging (Under the Hood)

The Express application applies audit middleware to requests under `/api`. After each response, the middleware emits a JSON Lines event to standard output containing timestamp, request ID, actor, network, method, route, payload size, and response disposition.

- The client IP is converted to `client_ip_hash` with HMAC-SHA256 using `AUDIT_ID_HMAC_KEY`.
- The general request audit event emits a `user_id_hash` only when a verified principal is present. The mock token has no identity claims, so it is not logged as a verified operator.
- Raw client IPs, request bodies, cookies, Authorization headers, and the HMAC key are not written to the audit event.
- Pino diagnostics also stream to standard output; there are no persistent local audit-log writes in the API router/service paths.

These logs are pseudonymized JSON Lines, not a tamper-proof archive. No external SIEM collector, immutable retention store, or compliance retention policy is configured.

### UI Component Catalog

The Component Preview Sandbox contains **55 reusable, modular UI components**. They provide the visual and component foundation for future application views. The catalog is a presentation layer; it does not itself provide authentication, authorization, data validation, or security controls.

## Current Boundaries and Operating Rules

- The secure-records API is mock-first. Live access requires explicitly configured server-side credentials and an approved upstream URL.
- The audit-log endpoint returns deterministic development samples and responds with 404 in production.
- Clerk session authentication is present, but agency role and record-scope authorization is not configured.
- The Field Training Officer Portal stores unsent drafts in encrypted IndexedDB; it does not sync training records to a backend.
- There is no database-backed training-record route or connected portal records view.
- The database schema and audit helper are foundations only; they are not mounted to current application routes.
- The XML-to-JSON gateway is planned, not implemented.
- Do not describe the current workspace as production-ready, regulator-certified, or backed by immutable audit retention.
- Keep `AUDIT_ID_HMAC_KEY`, `REAL_API_KEY`, `SESSION_SECRET`, and other credentials in the environment secret manager; never print their values.

## Workspace Checks

- `pnpm run typecheck` — TypeScript checks across workspace packages.
- `pnpm run build` — type checks and builds all workspace artifacts using their local default ports and paths.
- `pnpm run bundle:production` — builds the API and creates a clean standalone `dist-production.zip`.
- `pnpm --filter @workspace/api-server run dev` — starts the API Server workflow.
- `pnpm --filter @workspace/mockup-sandbox run dev` — starts the Component Preview Server workflow.
- `pnpm --filter @workspace/field-training run dev` — starts the Field Training Officer Portal workflow.
