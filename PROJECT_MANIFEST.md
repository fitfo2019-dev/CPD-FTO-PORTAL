**Future AI assistants: Read this manifest before modifying the codebase. Preserve the documented API contracts, naming rules, security boundaries, and scope limitations.**

# Project Manifest

## Current contents and boundaries

This workspace contains three artifacts: an Express API Server, a React/Vite Component Preview Sandbox, and the Field Training Officer Portal. Division Patrol View runs on an internal Division server; its source and runtime are outside this workspace.

The Field Training Officer Portal has sign-in and workflow views; training records remain in an encrypted device-local vault by default. Agency packet API routes and encrypted sync hooks exist, gated off until an agency-managed PostgreSQL connection, verified signed identity claim mappings and trusted assignment roster are configured. Following sandbox preview and user approval, Daily Records includes explicit upload confirmation and read-only shared-record refresh controls. “Save Locally” does not upload. Neither connectivity nor choosing connection guidance starts an upload or grants authorization. The isolated `AdminLogsDashboard` mockup uses development sample data; it is not a production audit console.

Packet routes are `/api/v1/training-packets`, `/api/v1/training-packets/:id`,
`/api/v1/training-packets/sync`, and `/api/v1/training-packets/sync-readiness`.
Only a server-verified FTO with a matching agency roster assignment may upload.
Batch commits are transactional, exact retries are idempotent, and successful
client acknowledgements seal local packets. PO reads require server-controlled
release, whose workflow is still pending. The SQL migration is included in the
API-only distribution. See `HANDOVER_MANUAL.md` for all `AGENCY_*` configuration
keys, database grants and verification limits.

The run editor presents one sheet at a time, with back/next navigation, linked quick-add forms, per-sheet checklist review, and a Save run action followed by a separate New run action. FTO-initiated incident lookup matches the editable unit/cruiser assignment recorded at phase start. Each matching unit receives shared incident metrics plus its own dispatch/clear times; officer identity information is never imported. Prefill is limited to incident date/time, dispatched/cleared times, dispatched 10-code, structured location, zone, cruiser district, and clearance code when available. All returned values remain editable. Situation Found is blank by default. Existing unique code mappings suggest 17 → Domestic Incident and 4 → Traffic Crash; 6 is ambiguous and requires a form choice. Other codes use Call for Service unless the FTO changes the form. A 3V clearance attaches Arrest Process and the existing transport workflow; dispatch codes do not infer OVI or building-search actions. No live PatrolView JSON endpoint is configured; manual entry remains available.

The XML-to-JSON Government System gateway is a planned architectural boundary only. No XML or binary integration is active. The secure-records API has a mock pathway and a live adapter, but no approved upstream endpoint or access grant is configured in this workspace.

## Workspace footprint and portability

- Git tracks 375 files (verified 2026-11-21).
- Workspace packages use ECMAScript modules. Local TypeScript and TSX imports use explicit `.js` extensions, including `/index.js` for directory entrypoints, so emitted code resolves under strict Node ESM.
- The shared TypeScript configuration enables `strict`, `noImplicitAny`, and `strictNullChecks`; workspace type checks pass without suppressions.
- `pnpm-lock.yaml` is the sole lockfile. Workspace package resolution uses catalogs and overrides; install with `pnpm install --frozen-lockfile`.
- The supported Node.js range is `^20.19.0 || >=22.12.0 <25`.
- The entire workspace environment and its complete transitive dependency graph are 100% unified under the modern Zod 4 runtime engine. There are zero legacy Zod 3 footprints remaining in the active lockfile. The shared catalog is `^4.6.7`; Field Training forms also use `@hookform/resolvers` `7.0.7` and React Hook Form.
- The API build emits ESM JavaScript and linked source maps to `artifacts/api-server/dist/`. Third-party runtime dependencies are external, not copied from `node_modules`; the standalone package manifest lists them.
- The Vite artifacts have independent static build outputs. Their ports and base paths have local defaults and remain environment-configurable for workflows.
- The Express server reads `PORT`, defaults to `3000`, and binds to `0.0.0.0`.
- `TRUST_PROXY_HOPS` defaults to `1`, accepts integers from `1` through `16`, and is applied before security, request logging, and audit middleware. The verified agency ingress has two hops; use `TRUST_PROXY_HOPS=2` for that topology and re-verify if it changes.
- Express resolves the client address as `req.ip` using the configured trusted-hop count; the audit middleware applies the HMAC utility before recording `client_ip_hash`.
- `USE_REAL_API` is fail-secure and mock-by-default (`false`). Production startup fails if live mode is enabled without `REAL_API_URL` and `REAL_API_KEY`; upstream requests use only the server credential and fail closed without the authorization-grant adapter.
- `AUDIT_ID_HMAC_KEY` is required for API startup and must be at least 32 bytes. The audit utility uses it for HMAC-SHA-256 pseudonyms of verified user IDs and client IPs; raw identifiers are not written to audit records.

## Completed resilience work

- The React component-preview application wraps its main view in a recoverable Error Boundary. Its “Try again” action clears the failure and remounts the protected view.
- Individual component previews show an accessible loading skeleton while module imports resolve. Imports have a 15-second timeout; timeout and import failures display a retryable fallback.
- The isolated `AdminLogsDashboard` request and mock sign-in request use abortable 15-second timeouts. These behaviors are not a global API-client guarantee.
- These resilience features cover the component-preview harness and explicitly bounded requests; they do not make offline portal storage synchronize with the API.

## Pending implementation: connected portal services

**Current Workspace Limitation:** The Field Training Officer Portal contains user-facing workflow views and Clerk sign-in, but its drafts are stored only in encrypted device-local IndexedDB. It does not yet have a connected training-record API, server-side synchronization, or a department role/record-scope authorization adapter. The API's secure-records mock is separate from the portal views.

**CRITICAL FUTURE STEP:** When adding data-backed application screens, connect frontend views only through the centralized `API_BASE_URL`. Use defensive response parsing, loading skeletons, a 15-second network timeout, and retryable error fallbacks. Do not treat local drafts or the isolated audit-log mockup as a live server-backed workflow.

## Functional architecture and core user workflows

This is a security-oriented prototype foundation for sensitive-records management and administrative compliance workflows. Its current capabilities are not a production identity policy or a certified compliance platform.

- **Component Preview Sandbox:** Isolated React/Vite environment for visual testing and interface modeling, including a catalog of 55 reusable UI components.
- **Field Training Officer Portal:** React/Vite workflow views with Clerk sign-in. Offline drafts are encrypted in IndexedDB with AES-GCM; the key is derived from a passphrase using PBKDF2 and held in memory while unlocked. The portal does not upload or synchronize these drafts.
- **Backend API Enterprise Gateway:** Express API with Helmet, explicit CORS origins, request validation, Clerk middleware, pseudonymized request auditing, and same-origin routing. The XML-to-JSON Government System gateway remains planned.
- **Secure Operator Sign-In:** The Field Training Officer Portal uses Clerk's browser session and same-origin cookie flow. The separate `POST /api/auth/mock-login` endpoint is development-only and returns a fixed demonstration token; it is not a JWT, not a real identity, and not the portal's sign-in mechanism.
- **Defensive Records Querying:** `GET /api/v1/secure-records` returns validated synthetic records in the standard JSON envelope by default. Live mode is off unless `USE_REAL_API=true`; it requires a signed-in Clerk user, a server-side authorization grant, and `REAL_API_URL`/`REAL_API_KEY`. Upstream calls use only the server credential; browser authorization headers are not forwarded. The grant adapter is not implemented, so live access fails closed until an approved policy is connected.
- **Forensic Audit Logging:** Requests under `/api` emit JSON Lines to stdout with request IDs, response outcomes, and keyed pseudonyms for available verified identities and client IPs. Raw request bodies, cookies, authorization headers, and raw client IPs are excluded from the general request audit event. Stdout is not an immutable archive.
- **UI Component Catalog:** The workspace contains 55 reusable, modular UI components. They are a design foundation; the catalog does not provide backend authorization or data protection by itself.

## Folder map

- `artifacts/api-server/` — Express API service, Clerk proxy, security headers, CORS, request logging, validation, and routes.
- `artifacts/mockup-sandbox/` — React/Vite component preview sandbox and UI component catalog.
- `artifacts/field-training/` — Field Training Officer Portal and encrypted offline-storage wrapper.
- `lib/api-spec/` — OpenAPI source contract.
- `lib/api-client-react/` — Generated React Query API client, centralized API base configuration, request wrapper, and development-only mock auth state.
- `lib/api-zod/` — Generated Zod schemas and response validators.
- `lib/db/` — PostgreSQL and Drizzle schema foundation; not connected to current API routes.
- `database/migrations/` — Portable SQL schema and database constraints.
- `scripts/` — Workspace utility scripts, including standalone API packaging and the retained `hello.ts` command.
- `attached_assets/` — User-provided source materials; do not remove as cleanup.
- `HANDOVER_MANUAL.md` — Functional overview and handover boundaries.
- `replit.md` — Collaborator guidance that points to this manifest.

## Services and configuration

- **API Server:** Express on the workflow-provided port; standalone output uses `PORT` or `3000` and binds to `0.0.0.0`.
- **Component Preview Server:** Vite on the workflow-provided port and base path; local defaults allow command-line builds without workflow variables.
- **Field Training Officer Portal:** Vite static build at `artifacts/field-training/dist/public`; requires `VITE_CLERK_PUBLISHABLE_KEY` at build time.
- `API_BASE_URL` is centralized in `lib/api-client-react/src/api-config.ts` and uses same-origin `/api`; frontend code must not call the external records service directly.
- `AUDIT_ID_HMAC_KEY` is required by the audit pseudonymization utility. Keep it in the server secret manager and never log its value.
- `USE_REAL_API` defaults to `false`. If set to `true` in production, `REAL_API_URL` and `REAL_API_KEY` are required; startup fails if either is missing.
- `TRUST_PROXY_HOPS` is validated and applied before middleware that reads the client IP. Production operators must set it to the exact verified proxy-chain length; do not infer it from untrusted headers.
- Clerk proxying is production-only at `/api/__clerk`. It uses the configured trusted-proxy host and resolved client IP, strips incoming forwarded headers before forwarding, and requires server-side Clerk configuration in production.
- `ALLOWED_ORIGINS` is a comma-separated exact-origin CORS allowlist; wildcard origins are rejected.
- `DATABASE_URL` is consumed only by the separate database helper; current API routes are stateless.

## Agency-managed production startup

The monorepo build produces the API and the static artifacts. The root start command launches only the API; it does not serve the Field Training Officer Portal's static files.

From the repository root, with `VITE_CLERK_PUBLISHABLE_KEY` and other required public build-time values supplied by the deployment environment:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm run build
```

Inject `AUDIT_ID_HMAC_KEY`, `CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` from the agency's secret manager, then start the API:

```sh
NODE_ENV=production PORT=3000 TRUST_PROXY_HOPS=2 USE_REAL_API=false pnpm start
```

The verified agency ingress has exactly two trusted proxy hops, so use `TRUST_PROXY_HOPS=2` for that route. If the infrastructure changes, set the verified count instead. Express applies this count before Helmet, request logging, and audit middleware. The edge proxy must overwrite client-supplied forwarding headers and preserve `/api` when forwarding to Express. Clerk proxy requests use Express-resolved `req.hostname` and `req.ip`, discard incoming forwarding headers, and set sanitized upstream headers.

Serve `artifacts/field-training/dist/public` through the agency's static web server, with history fallback to `/index.html`. Forward `/api/*` to the Express service without stripping the prefix. `API_BASE_URL` remains the centralized same-origin `/api` path.

For the standalone API-only distribution, run `pnpm run bundle:production` and transfer `dist-production.zip`. Inject the required secrets and runtime settings through the agency service manager, then run:

```sh
unzip dist-production.zip
cd dist-production
npm install --production
npm start
```

This archive does not contain the Field Training Officer Portal static build.

### Operational page-index alignment

The portal's workspace provider exposes a shift-local operational packet
projection shared with printing and class workbook indexes. First-workday
orientation occupies one checklist sheet at Page 1, then Reporting for Duty P2
and runs P3 onward. Every routine day retains duty P1 followed by runs P2 onward.
Orientation Example B has 43 combined rows retaining all 82 original task keys,
including mixed saved task states. It is a walkthrough, not a performance evaluation.
Chronological runs, required supplements and continuations precede orientation
note U-10.192 attachments, which preserve overflow text, then
the daily summary and its continuations. There is no fixed application page cap.
Missing phase-start orientation prevents packet review and print-all completion.
Saved source-reference text is retained but its review confirmation is cleared
after the packet-index version 2 migration or subsequent source/schedule changes.

Cleared applicable tasks on new or explicitly edited duty/run checklists route to
named SEG categories and project UA immediately. The grouped articulation editor
is available only after the FTO confirms checklist review. Weekly counts and the
category A ceiling use reviewed, non-Limbo daily summaries only. This is
user-directed prototype automation, not a certified manual crosswalk. Historical
manual numbers are not current worksheet ordinals. All 30 named categories
remain intact. Not Applicable and Limbo restrictions still apply, and training
time is never inferred.

Monthly exports contain exactly four consecutive Sunday–Saturday weekly tabs,
each with a 30-category grid above Weekly Activity Summary totals. Exports stop
with an explicit error if a month or phase schedule needs more than four ranges,
or a saved record lies outside them; source weeks are never combined or silently
omitted. New, reviewed run records use versioned clearance multipliers; legacy
records retain manual accounting. A transported arrest requires its actual
destination type (Jail, HQ, or Clerks) and actual destination on a new versioned
run. Selecting Arrest Made or 3V preselects transport; if no transport occurred,
the FTO can clear it and the arrest run is recorded as 1V. Changing the shift
date keeps a valid entered run time aligned and never fills a missing time with
a fabricated default. Cruiser ID and the required Y/N Shotgun Training flag are
saved in the existing encrypted workspace. Shotgun Training `N` marks
Resource/Equipment Usage as not applicable outside the rating values and
excludes it from weekly rating counts unless a recorded deficiency exists.
`3V` charge payloads are local drafts, not filed or completed legal forms. See
`HANDOVER_MANUAL.md`, section 12.
The 15-week calendar uses phase lengths 4/4/4/3 and Limbo timing of one full
Phase I week, two Phase II workdays, then one Phase III/IV workday. Limbo allows
checklists and activity capture but no SEG ratings. Week 15 release/termination
recommendation and automatic phase-assignment creation are not implemented.
`artifacts/field-training/src/config/phaseConfiguration.ts` is the authoritative
phase-length/Limbo registry; program-week starts are derived from its ordered
entries. Phase IV remains three weeks until formal approval.
Officer Safety deficiencies latch UA for their named category for the rest of
that daily report, even if the source task is rechecked; Limbo ratings stay
suppressed.

## API contracts

Success responses use:

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

- `GET /api/healthz` returns the schema-validated health envelope.
- `POST /api/auth/mock-login` is development-only and returns a non-JWT demonstration value.
- `GET /api/v1/secure-records` returns mock records unless the live switch is explicitly enabled. Both pathways normalize data through the shared Zod response schema; upstream failures return a safe error envelope.
- `GET /api/v1/audit-logs` returns deterministic pseudonymized development samples and returns 404 in production.
- Other API paths return a safe error envelope.
- API routes do not write persistent application data or logs to local files. Audit and diagnostic logs stream to stdout. Mock records are in-memory constants.
- The component-preview dev plugin generates a component registry for local previews only.

The OpenAPI source of truth is `lib/api-spec/openapi.yaml`. Regenerate the client and validation outputs from that contract when response schemas change.

## Security and integration limits

- Helmet applies a restrictive Content Security Policy and denies framing. The `X-Powered-By` response header is disabled.
- CSP directives restrict default, script, and connection sources to the same origin, block objects, and deny framing with `frame-ancestors 'none'`.
- CORS uses explicit origins rather than a wildcard.
- The Clerk browser session is cookie-based. The browser's bearer headers are not passed to the secure-records upstream; the server uses only `REAL_API_KEY`.
- The live route fails closed unless a verified Clerk session, a server-side department authorization grant, and required upstream configuration are present. The department grant is not currently populated.
- Offline portal drafts are encrypted at rest in IndexedDB. This does not provide server-side backup, device-management enforcement, agency authorization, or a CJIS compliance guarantee.
- Audit events use HMAC pseudonyms for available identity and network identifiers. Standard output is not a write-once or tamper-proof audit archive; no external immutable log collector or retention policy is configured here.
- No live Government System integration, XML/binary normalization, database-backed portal routes, or training-record synchronization is active.
- Do not claim production readiness, regulatory compliance, or immutable audit retention from these foundations alone.

## Naming and rating rules

- Use only names supplied for the project; do not introduce alternate product terminology.
- Do not use numerical performance ratings.

## Build and verification commands

- `pnpm install --frozen-lockfile` — install the workspace from its lockfile.
- `pnpm typecheck` — strict TypeScript checks across shared libraries, artifacts, and scripts.
- `pnpm run build` — type-check and build all workspace packages.
- `pnpm run bundle:production` — rebuild and type-check the API, then create a clean `dist-production/` folder and `dist-production.zip`.
- `pnpm --filter @workspace/api-server run dev` — API Server development workflow.
- `pnpm --filter @workspace/mockup-sandbox run dev` — Component Preview Server workflow.
- `pnpm --filter @workspace/field-training run dev` — Field Training Officer Portal workflow.
