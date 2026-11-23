# Project Setup and Agency Handover

## Synthetic access verification and recovery copies

The isolated, development-only PostgreSQL record API is documented in
`docs/SYNTHETIC_STAGING.md`. It uses normal verified sign-in, recent MFA and
server-managed assignment scopes—not an extra developer password. It does not
upload portal drafts or make the application approved for operational data.
`pnpm test:staging` exercises synthetic database transactions and access denials.
`pnpm run bundle:production` uses the agency-release compiler, which removes the
staging router and rejects staging markers in the resulting executable.

Use `pnpm snapshot:context` before editing protected context/configuration files,
or `pnpm context:write <allowlisted-target> <prepared-text-file>` for a write that
automatically snapshots first. Owner-only recovery copies are visible under
`local-history-snapshots/`, excluded from Git, deployments and delivery ZIPs.
They contain selected source files only—not secrets, browser drafts or database
data—and are not a full-site backup. Omit/purge them before transferring a full
workspace directory. No private developer access is retained in the IT handover.

This pnpm workspace contains the Express API Server, the React/Vite Component Preview Sandbox, and the Field Training Officer Portal. `callbox\pv3` is an internal-server application and is not included in this source tree.

## Current scope

- The Field Training Officer Portal includes Clerk sign-in and workflow screens. Its drafts are encrypted in device-local IndexedDB; no training-record synchronization or database-backed portal routes are connected.
- The New run dialog performs incident lookup only after the FTO enters an incident number and clicks Look up. It matches the editable Unit / cruiser assignment from Reporting for Duty; the server returns only that exact unit's record, so each PO can query the same incident independently without seeing another unit's row. Prefilled fields remain editable and require FTO review. Manual entry remains available. A live PatrolView JSON endpoint and credentials are not configured in this checkout; the uploaded screen image is not an API contract.
- The API's `/api/v1/secure-records` route serves validated synthetic records by default. `USE_REAL_API` is fail-secure and defaults to `false`; production live mode requires server-side configuration and an approved authorization grant.
- Clerk authentication is present, but agency employment, role, record-scope, and department identity policies are not configured here. Do not treat the prototype as approved for operational or CJIS-restricted data.
- The XML-to-JSON gateway remains a planned boundary. No live Government System XML or binary integration is active.

## Resources tab

The signed-in portal's Resources tab combines the existing Law Library with 23 downloadable DOC, DOCX, and PDF references. Twelve unique domestic-violence training PDFs were added from the DV Training archive; duplicate source files were not added twice. The catalog uses the internal API; downloads require a Clerk session and are streamed from an explicit server-side allowlist rather than a public static URL. Some references contain sensitive internal or victim-safety training material. Do not enter case-specific victim information. Authentication is not a substitute for agency role authorization, which is not yet configured, so every signed-in user with app access can download these resources.

## Validation and module format

- The entire workspace environment and its complete transitive dependency graph are 100% unified under the modern Zod 4 runtime engine. There are zero legacy Zod 3 footprints remaining in the active lockfile. The shared catalog is `^4.6.7`; Field Training forms also use `@hookform/resolvers` `7.0.7` and React Hook Form.
- Workspace packages use ECMAScript modules. Local TypeScript and TSX imports use the emitted `.js` suffix (for example, `./model.js`); directory entrypoints specify `/index.js`. TypeScript resolves these source specifiers to `.ts`/`.tsx` files, while compiled Node code keeps valid ESM paths.
- OpenAPI-generated validators and clients live under `lib/api-zod` and `lib/api-client-react`. After code generation, verify local generated imports retain explicit ESM extensions before building.

## Runtime and environment

The workspace targets Node.js `^20.19.0 || >=22.12.0 <25`. Configure values through the agency service manager or a protected environment file. Node does not automatically load `.env` for `npm start`. Never commit secrets or print them in logs.

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Set to `production` on the agency server | Enables production middleware and startup checks. |
| `PORT` | Optional; defaults to `3000` | Port supplied by the host or service manager. |
| `TRUST_PROXY_HOPS` | Optional; defaults to `1` | Exact count of trusted reverse proxies. The confirmed agency ingress has two hops; set to `2` for that topology and recheck if it changes. |
| `AUDIT_ID_HMAC_KEY` | Required for API startup; at least 32 bytes | Secret-manager key for HMAC-SHA-256 pseudonyms of verified user identifiers and client IP addresses. |
| `CLERK_PUBLISHABLE_KEY` | Required for production API authentication | Clerk publishable key used by the server middleware. |
| `CLERK_SECRET_KEY` | Required for the production Clerk proxy | Server-only Clerk credential. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Required when building the Field Training Officer Portal | Public, build-time Clerk key for the browser application. |
| `VITE_CLERK_PROXY_URL` | Set by the approved Clerk deployment for production proxying | Browser-side Clerk proxy URL; keep empty in development. |
| `USE_REAL_API` | Optional; defaults to `false` | Fail-secure mock-by-default switch. Production live mode requires `REAL_API_URL`, `REAL_API_KEY`, and an approved authorization grant. |
| `REAL_API_URL` | Required when production live mode is enabled | HTTPS endpoint for the upstream records service. |
| `REAL_API_KEY` | Required when production live mode is enabled | Server-only upstream credential; browser authorization headers are never forwarded to this service. |
| `PATROLVIEW_EVENT_LOOKUP_URL` | Optional; required for dispatch prefill | Agency-approved HTTPS adapter URL with exactly one `{eventId}` path placeholder. The adapter must return event ingress time and approved incident fields as JSON. |
| `PATROLVIEW_API_TOKEN` | Required when dispatch prefill is enabled | Server-only bearer credential for the approved dispatch adapter. It is never sent to the browser. |
| `PATROLVIEW_ALLOWED_CLERK_USER_IDS` | Required when dispatch prefill is enabled | Comma-separated Clerk user IDs approved by the agency for dispatch lookups. Requests fail closed if the list is empty or the user is not listed. |
| `ALLOWED_ORIGINS` | Optional for same-origin hosting; required for a separate browser origin | Comma-separated exact HTTPS origins allowed by CORS. Wildcards are rejected. |
| `LOG_LEVEL` | Optional; defaults to `info` | Pino logging threshold. Structured logs are written to stdout. |
| `DATABASE_URL` | Not used by current API routes | Connection string for the separate database helper if database-backed routes are implemented. |
| `RESOURCE_FILES_DIR` | Optional | Approved mounted resource directory; otherwise the API uses its packaged `resources/` directory. |

The current dispatch adapter accepts a `patrolViewEventId` URL parameter; it is not the requested incident-number-triggered workflow and no live PatrolView feed is configured. The approved next behavior is to look up only after an FTO enters an incident number, then match the response against the Cruiser ID recorded on Reporting for Duty. Apply a unit's values only when there is exactly one exact match; if the unit is missing or ambiguous, leave the run for manual entry. Keep all prefilled fields editable and preserve FTO corrections. The sample PatrolView run page is needed before mapping its unit and metric fields. Until then, do not enable live lookup or infer activity totals from another officer's incident record.

`TRUST_PROXY_HOPS` is validated and applied before security, request logging, and audit middleware. The confirmed agency ingress uses two trusted hops, so set `TRUST_PROXY_HOPS=2` for that deployment. Do not trust forwarded headers directly or reuse that value for a different proxy topology without verification.

Express resolves the client address into `req.ip` using only the configured trusted proxy hops. The audit middleware hashes that value with `AUDIT_ID_HMAC_KEY` before writing the `client_ip_hash` field.

## Build and package

From the workspace root:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm run build
pnpm run bundle:production
```

`pnpm run build` type-checks the workspace and builds the API, shared libraries, component preview, and portal. `pnpm run bundle:production` builds and type-checks the API, then recreates `dist-production/` and `dist-production.zip`, including the current `HANDOVER_MANUAL.md` and protected reference documents under `resources/`. The packaging step removes prior generated package output before writing the new archive; no second `zip` command is needed.

The standalone archive contains the compiled API entry and a production-only `package.json`. Third-party runtime packages remain external and are listed in that manifest; workspace modules are bundled into the API output. No workspace `node_modules` directory is copied. The portal's static build is separate from the API package.

### Daily packet coordination

The portal now derives shift-local page references from one shared coordinator:
one orientation sheet first on phase ingress, Reporting for Duty on every day,
chronological runs with conditional supplements and continuations, then orientation
note attachments and the daily summary and
its continuations. Each shift starts at Page 1 without a fixed application page
cap. Print references and the class workbook's Daily Page Index and Checklist
Exceptions sheets use that same sequence. Old source-reference review
confirmations require reconfirmation after the packet-index version 2 migration; historical
text and training time are preserved. See `HANDOVER_MANUAL.md`, section 11, for
the exact page scope. Section 12 documents the named-category UA rules, FTO
override dialog, consolidated source-linked articulations, and four-tab
monthly exporter, styled after the supplied U-10.174 reference with
three category panels, four activity blocks, metadata, comments, and legend.

The approved orientation Example B presents 43 combined checklist rows retaining
all 82 original task keys and saved partial states. It records an FTO/PO walkthrough,
not performance ratings. Phase Day 1 is orientation P1, duty P2, runs P3 onward;
routine days are duty P1 and runs P2 onward. Long orientation notes are preserved
on separate U-10.192 attachments rather than clipped from the single checklist sheet.
The monthly exporter preserves the 30-category data model. Unchecked applicable
daily duty/run tasks (not orientation walkthrough items) project UA immediately,
but the grouped articulation editor opens only after explicit checklist review;
weekly counts use reviewed, non-Limbo summaries. More than four source weeks or
an out-of-range record stops export rather than merging weeks or dropping dates.
New reviewed runs use versioned clearance multipliers; legacy manual totals are
not silently migrated. A 3V run requires a recorded arrest, and an actual
transport destination type (Jail, HQ, or Clerks) plus the actual destination is
required for a transported arrest. Selecting Arrest Made or 3V preselects
transport; if no transport occurred, the FTO can clear that flag and the run
uses 1V. A 4V run adds no automatic activity counts. Legal-document payloads
remain local drafts, not completed or filed forms. Shotgun Training `N` marks
Resource/Equipment Usage as not applicable outside the five-value rating
system; it is excluded from weekly rating counts unless a recorded deficiency
exists.
The 15-week phase calendar applies Limbo windows and blocks rating review on
Limbo days. Officer Safety UA remains locked for the affected category for that
day. Week 15 release recommendations and automatic next-phase assignment
creation are not yet provided.

The authoritative phase registry is
`artifacts/field-training/src/config/phaseConfiguration.ts`. It defines the
approved 4/4/4/3 week schedule in `PHASE_TIMELINE_REGISTRY.durationInWeeks`,
derives program-week starts, and contains
offline developer instructions. Phase IV remains three weeks unless formally
approved; after approval, an agency developer can edit the Phase IV
`durationInWeeks` value and run `pnpm typecheck` followed by `pnpm run build`.

### Agency-managed monorepo startup

Build the workspace from its root, with `VITE_CLERK_PUBLISHABLE_KEY` and any other build-time public settings supplied by the deployment environment:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm run build
```

Inject `AUDIT_ID_HMAC_KEY`, `CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` through the agency's secret manager or service environment. Then start the API from the workspace root:

```sh
NODE_ENV=production PORT=3000 TRUST_PROXY_HOPS=2 USE_REAL_API=false pnpm start
```

Set `TRUST_PROXY_HOPS` to the verified number of trusted proxies in front of Express; `2` applies only to the confirmed two-hop Columbus ingress topology. The API binds to `0.0.0.0`, reads `PORT`, and writes structured logs to stdout. The root `pnpm start` command starts the API only. Serve `artifacts/field-training/dist/public` as the static portal with an SPA fallback to `index.html`; the API does not host the portal files.

Configure the reverse proxy to preserve the `/api` prefix when forwarding API traffic and to overwrite, not append to untrusted client-supplied forwarding headers. Express applies the configured hop count before audit and security middleware; the Clerk proxy uses Express-resolved host and client-IP values and replaces forwarded headers before its upstream request.

To run the standalone API package on the agency server:

```sh
unzip dist-production.zip
cd dist-production
npm install --production
npm start
```

Inject the required API secrets and runtime settings through the agency service manager before `npm start`; the archive contains no `.env` file or credentials.

For an offline server, install from a pre-populated npm cache or an agency-controlled package mirror. The archive does not contain `.env` files or credentials. Keep the service in the foreground under systemd, PM2, or the agency's service manager so stdout and stderr can be captured and rotated.

For individual workspace services, use:

```sh
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/mockup-sandbox run dev
pnpm --filter @workspace/field-training run dev
```

## Operational boundaries

- The Express server reads `PORT` from the environment, defaults to `3000`, and binds to `0.0.0.0`.
- Helmet applies a restrictive Content Security Policy, including same-origin defaults, `object-src 'none'`, and `frame-ancestors 'none'`; `X-Powered-By` is disabled.
- API request logs are structured JSON Lines on stdout. They are not a write-once archive; configure the agency's approved external log collection and retention separately.
- The backend does not persist application data to local files. The Field Training Officer Portal stores encrypted offline drafts in browser IndexedDB using AES-GCM and a passphrase-derived key; it does not sync those drafts to the API.
- The separate database helper uses `DATABASE_URL`, but current API routes do not import it.
- The component preview dev plugin writes a generated registry for previews only; it is not application data.
- `API_BASE_URL` is centralized in the shared API client and points to the same-origin `/api` path.
