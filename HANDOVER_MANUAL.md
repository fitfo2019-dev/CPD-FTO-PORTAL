# Handover Manual

## Verified synthetic staging and source-recovery boundary

The unused extra developer-password gate has been removed. Normal Clerk
sign-in, recent MFA, and explicit server-managed role/assignment grants remain
mandatory for synthetic-record routes. There is no private developer access in
the agency handover. The entire source is intended for Columbus IT review.

An isolated `synthetic_training` PostgreSQL schema and tested development-only
record API now exist; this is not a connected operational training-record
service. The portal's encrypted device drafts are unchanged and are never
automatically uploaded. See `docs/SYNTHETIC_STAGING.md` in the source repository
for scope, setup and test limitations. The agency-release compiler excludes the
staging executable code; staging routes must return 404 in production.

### Visible configuration snapshots

`pnpm snapshot:context` creates
`local-history-snapshots/snapshot_YYYYMMDD_HHMMSS_<unique suffix>/` containing
only allowlisted context documents/configuration files, with a timestamp and
SHA-256 manifest. It never copies Secrets, browser vaults, user uploads,
training records or database contents. It is not a complete site/data backup.

For an automatic snapshot immediately before a protected configuration write:

```sh
pnpm context:write .replit-context.md prepared-context.md
pnpm typecheck
```

The prepared replacement must be a non-hidden text file in the repository.
The writer aborts if the snapshot fails and replaces the target atomically.
This is a source-maintenance command, not a browser/FTO-save event or an OS-wide
file watcher. Other editors/agents must explicitly run `pnpm snapshot:context`
before changing protected documents. Backend requests never write these files.

The snapshot root is owner-only (0700), copied files are owner-read/write (0600),
and the directory is excluded from Git, deployment and the ZIP. It is not
served by Express or Vite. Before a whole-directory IT transfer, omit or purge
this directory and all temporary prepared replacements; administrator access
can bypass ordinary filesystem permissions. These measures are not a
compliance certification or a guarantee of privacy from a machine owner.

### Approved orientation walkthrough and daily duty order

The user selected Example B: one orientation checklist sheet with 43 combined
rows covering all 82 original tasks. These are walkthrough completion checks,
not performance ratings. The original task keys and saved partial states remain
intact. A mixed row is shown as mixed on screen; checking it explicitly marks
all of its listed tasks covered. Safety-specific tasks retain individual checks.
The review confirmation is below the list.

Reporting for Duty is retained every day: Phase Day 1 is orientation P1, duty
P2, then runs from P3. Routine days are duty P1 and runs from P2. Long orientation
notes are preserved on separately numbered U-10.192 attachments after the runs.
Standalone orientation attachments without a matching saved daily report are
explicitly unindexed rather than assigned made-up packet coordinates.

**Before modifying this workspace, read `PROJECT_MANIFEST.md` and preserve its API contracts, naming rules, and scope boundaries.**

## CONFIGURATION PROTECTION GATES (QUEUE CONTROL & ANALYSIS CONTRACT)
1. PARSE TIMELINE SEQUENCE PRIOR TO EMISSION: Prior to executing any structural code modifications, state migrations, or schema updates, the compiler must conduct a multi-file dependency audit mapping the target source file across active workspace modules.
2. CONFLICT INVERSION BLOCKER: If a queued instruction model demands adjustments to variables or files currently undergoing mutation by an active or immediately preceding thread pass, the agent must freeze execution and print a plain-text architectural warning outline summarizing the collision vectors, explicitly requesting human operator validation before altering the file tree.
3. TRANSACTIONAL LOG COMPILING: Every structural pass must run `pnpm typecheck` automatically upon completion, rolling back to the immediate prior git baseline commit if a syntax error or contract drift registers.

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

### Approved 30-category SEG taxonomy

Use these image-verified category names consistently in forms, deficiency mapping, weekly summaries, and workbook exports:

1. Report/Prepared for Duty
2. Comprehension/Usage
3. Public/Police Interaction
4. Feedback Acceptance
5. Precinct Orientation
6. Routine
7. EVO
8. Policies / Procedures
9. Criminal / Traffic Offenses
10. Arrest, Search, Seizure
11. Information Gathering
12. Resource/Equipment Usage
13. Form Usage
14. Grammar / Legibility
15. Content Accuracy
16. Completion Time
17. Response to Enforcement
18. Threat Assessment
19. Initiating Arrests
20. Handling Prisoners
21. Vehicle Stops
22. Run Approach
23. Building Search
24. Pat Down / Searches
25. Low Stress Situations
26. High Stress Situations
27. Arrest Situations
28. Problem Solving
29. Motivational Traits
30. Task Management

### Resources tab

The signed-in Field Training Officer Portal has a **Resources** navigation tab. It brings together the existing Law Library and 23 downloadable reference documents. The original 11 are Amy's Law Factors; two BMV 2255 files; the Domestic Violence Protocol; Drug Possession Weights; the DV Strangulation Diagram; Key Criminal Law Issues (2024); Ohio Constitutional Opinions; the Ohio Supreme Court Felony Quick Reference; the Police Phone Directory; and Prior Offenses Constituting WUD. Twelve unique PDFs were added from the DV Training archive: 3-3 Domestic Violence; CPO vs TPO; Family or Household Member Relationships; FETI Model; I-40.115 Domestic Violence Lethality Screen; Power and Control Wheel; Safety Plan for Victims, pages 1 and 2; Strangulation Assessment Card v4; Strangulation Checklist; Strangulation: Physiological Consequences; and Worksheet 1: Types of Abuse. Duplicate Amy's Law and the 11 documents already present in the Directories archive were not added again.

The catalog is returned in the standard JSON envelope. Downloads use `GET /api/v1/resources/{resourceId}/download` and are served as attachments from a fixed server-side allowlist through the Clerk-authenticated API; the documents are not placed in the web app's public static directory. The resource archive is included by the standalone API package builder under `resources/`. `RESOURCE_FILES_DIR` may point to an approved mounted directory instead. Uploaded examples may contain personal details or internal contact information. The new victim-safety and domestic-violence training references are training materials only; do not enter case-specific victim information and follow agency handling rules. Clerk sign-in is authentication only: agency-specific role authorization is not configured, so any signed-in user with app access can download the catalog.

## Current Boundaries and Operating Rules

- The secure-records API is mock-first. Live access requires explicitly configured server-side credentials and an approved upstream URL.
- The audit-log endpoint returns deterministic development samples and responds with 404 in production.
- Reference-document downloads require a Clerk-authenticated session, but access is not yet scoped by verified agency role.
- Clerk session authentication is present, but agency role and record-scope authorization is not configured.
- The Field Training Officer Portal stores unsent drafts in encrypted IndexedDB; it does not sync training records to a backend.
- Shift start time and run event date/time are separate fields. The event time is editable and should reflect when the call was aired or initiated. The FTO selects **New run**, enters an incident number and the editable Unit / cruiser assignment from Reporting for Duty, then explicitly starts lookup. `POST /api/v1/dispatch/incident-lookup` requires a verified Clerk session, the `PATROLVIEW_ALLOWED_CLERK_USER_IDS` allowlist, `PATROLVIEW_INCIDENT_LOOKUP_URL`, and server-side `PATROLVIEW_API_TOKEN`. The request times out after five seconds at the server and 15 seconds in the client. No live dispatch feed is configured in this checkout.
- Incident matching is exact by incident number and assigned unit. The server returns only that unit's row; each PO can independently query the same incident. Incident-wide fields, including dispatch/clear times when supplied as shared incident fields, are inherited by that matching unit; unit-specific times override the shared values. The FTO reviews and edits every prefilled field and chooses the primary form when the source does not provide an explicit valid form type. A 10-code alone never determines the form. Unmatched/ambiguous results fall back to manual entry; another unit's details are never offered as a substitute.
- The uploaded PatrolView screen is a visual example, not a confirmed API response contract. Before live deployment, agency IT must approve the JSON adapter endpoint, field names, unit associations, time semantics, credential, and authorized Clerk user allowlist. No request is made on page load; lookup occurs only after the FTO enters an incident number and clicks Look up.
- These values belong to the parent `TrainingRun`. Arrest Process, OVI Process, and narrative continuation pages reference the same run and use deterministic run/supplement page identifiers rather than creating duplicate incident records. The Arrest Process supplement carries the user-specified U-10.188 identifier in its form metadata; it appears in existing print and workbook labels without changing their layout.
- There is no database-backed training-record route or connected portal records view.
- The database schema and audit helper are foundations only; they are not mounted to current application routes.
- The XML-to-JSON gateway is planned, not implemented.
- Phase extension requests and approvals exist only in the current encrypted local workspace; there is no cross-device or server approval workflow.
- There is no multi-county split-jurisdiction override or midwatch session extender. DMW and EMW are shift labels only.
- There is no batch offline log-ingress grid. Offline drafts remain individual device-local records.
- Role-preview restrictions are prototype UI behavior, not agency authorization. Coordinator views are not universally empowered to override records, and exported workbooks do not enforce PO-versus-FTO editing permissions.
- Do not describe the current workspace as production-ready, regulator-certified, or backed by immutable audit retention.
- Keep `AUDIT_ID_HMAC_KEY`, `REAL_API_KEY`, `SESSION_SECRET`, and other credentials in the environment secret manager; never print their values.

## Workspace Checks

- `pnpm run typecheck` — TypeScript checks across workspace packages.
- `pnpm run build` — type checks and builds all workspace artifacts using their local default ports and paths.
- `pnpm run test:field-training:phase` — runs the Node test suite for the phase registry, phase extensions, and training calendar using the Field Training test config and path aliases.
- `pnpm run bundle:production` — builds the API and creates a clean standalone `dist-production.zip`.
- `pnpm --filter @workspace/api-server run dev` — starts the API Server workflow.
- `pnpm --filter @workspace/mockup-sandbox run dev` — starts the Component Preview Server workflow.
- `pnpm --filter @workspace/field-training run dev` — starts the Field Training Officer Portal workflow.

The requested feature registry below is retained verbatim. Its labels are descriptive, not a production-security or compliance guarantee; the verified implementation notes following it define the current behavior where the registry wording is broader.

# User-Facing Portal Compliance and Functional Feature Registry

## 1. Core Presentation and User Experience Systems
* PORTAL LAYOUT FRAMEWORK: An isolated, responsive workspace shell featuring an persistent navigation utility panel, real-time security warning banners, and adaptive sub-portal tabs.
* ROLE PREVIEW SELECTOR: A client-side visual simulation overlay that allows users and administrators to instantly preview presentation modes and localized dashboard aesthetics across predefined security groupings.
* NEXTTHEMES INTERFACE ENGINE: A full-application dark, light, and system theme toggle integrated with flash-free structural rendering.
* ADAPTIVE GRID & RESPONSIVE UI: A fluid layout built with utility-first layouts, responsive typography, and hardware-accelerated interface states that render identically on any screen.

## 2. Field Training and Performance Evaluation Core
* PHASE SETUP MANAGEMENT MODULE: A digital intake command center where coordinators track and set operational phase boundaries, milestone criteria, and localized testing variables via strict entry forms.
* LETTER-ONLY EVALUATION SYSTEM: A specialized grading interface strictly restricted to non-numerical evaluation metrics (NO, A, RT, UA, and NRT), completely stripping out numerical curves, calculations, averages, or raw point weight scales.
* PERFORMANCE ACKNOWLEDGEMENT CENTER: A dedicated review page enabling users to view, lock, and sign weekly performance acknowledgements. Built with native react-query lifecycle checks to block stale data exposure.
* TRAINING ASSIGNMENTS CONTROL PANEL: A consolidated administrative terminal handling active duty assignments, personnel lists, training pipelines, and secure station routing structures.

## 3. Local Workspace Extraction, Storage and Offline Vault
* MEMORY-BOUND CRYPTOGRAPHIC STORAGE: A secure local data layer that handles unsubmitted records, local drafts, and offline queues in an encrypted IndexedDB vault using AES-GCM. The derived decryption key is stored strictly in volatile memory and evaporates instantly upon sign-out, leaving local data securely locked as cryptographic noise on disk.
* RECOVERABLE LOCAL SKELETONS: Graceful fallback states, loading animations, and component retry boundaries that allow users to read local data caches smoothly during network dropouts or upstream connection failures.
* OFFLINE ACTION QUEUE MANAGER: A background queue that captures pending forms and operational updates, parking them securely until an authorized live gateway connection re-opens.

## 4. Data Ingestion and Report Export Engines
* OUTBOUND WORKBOOK GENERATION (XLSX): Multi-sheet document builders that compile complex rosters, performance records, and schedules into structural files via xlsx and xlsx-js-style.
* FORMULA INJECTION DEFENSE: A background cell serialization wrapper that checks strings for leading formula tokens (=, +, -, @) and prefixes them with an apostrophe literal (') to neutralize unauthorized code execution in external spreadsheet apps.
* TRANSITIVE DOCUMENT PARSER (DOCX/CSV): A high-fidelity text-import panel processing user-supplied assignments. It parses DOCX attachments locally using a detached Mammoth compiler, strictly limiting incoming files to a 2 MB boundary to block denial-of-service memory spikes.

## 5. Zero-Trust Perimeter Lockdown and Auditing
* CLERK AUTHENTICATION GUARD: A strict routing gate that blocks unauthenticated visitors from rendering or viewing any internal metrics or dashboard views, forcing unauthorized traffic straight to the sign-in prompt.
* MULTI-TENANT STATE CLEANSER: An automatic account-switching interceptor that links the WorkspaceProvider state container directly to the active Clerk User ID, triggering a full cache purge and component remount upon account switching to prevent user data cross-contamination.

## Verified implementation status and scope

- **Presentation and roles:** The portal shell has responsive navigation, status notices, a local day/night toggle, and a role-preview selector. The selector changes a client-side preview role; it is not an authorization policy. The portal does not currently provide a system theme mode, a NextThemes application provider, or a guarantee of hardware-accelerated rendering.
- **Field-training workflows:** Phase setup, assignments, reports, and weekly acknowledgements are local workspace workflows. The letter rating choices are NO, A, RT, UA, and NRT; numeric dates, phase/week values, and counts remain ordinary data. Weekly acknowledgements can be drafted and saved locally or printed, but in-site signature recording is disabled, signatures are not verified, and drafts are not submitted to a server.
- **Phase dates and extension requests:** Phase setup stores editable, consecutive Sunday–Saturday date ranges in the encrypted workspace. FTOs can submit a week or Limbo extension with written justification and continue paperwork while it is pending. The Coordinator can approve the request on the same device, appending training weeks or extending the first Limbo range and shifting subsequent ranges; denial removes the pending request. Reports saved without a phase-week number while an extension is pending are assigned one after approval.
- **Device-local approval boundary:** Extension requests and decisions are local to the encrypted device workspace. Switching the local preview role lets the Coordinator review them on that device; this does not notify another account, synchronize devices, or enforce server-side authorization.
- **Encrypted offline storage:** IndexedDB records and drafts are encrypted with AES-GCM using a passphrase-derived key. Locking or signing out clears decrypted state and the in-memory key while preserving the encrypted device data. This is not a device-compliance certification or a server backup.
- **Offline queue and recovery:** The storage layer can keep encrypted pending changes, but no live sync transport is connected. Queue entries are not automatically uploaded when connectivity returns. The 15-second import timeout and retry states apply to the component-preview harness and selected requests; they are not a general network fallback for Field Training views.
- **Workbook and file input:** The portal generates XLSX workbooks. Formula-safe text conversion is used on user-provided text in the export paths; this is not an XLSX upload/parser feature. The roster import accepts CSV and DOCX, not XLSX. DOCX is parsed locally with Mammoth and extracted as text from a detached document; the 2 MB compressed-file limit reduces input size but is not a guarantee against every parser or decompression denial-of-service case.
- **Monthly workbook week policy:** Excel exports contain four distinct weekly tabs. If a month or approved phase timeline requires more than four weekly ranges, or any selected source record falls outside those ranges, export stops with a clear message. Weeks are never merged or silently omitted.
- **Authentication and isolation:** Clerk sign-in is required before portal views mount. Workspace state is cleared and remounted on account changes, and the React Query cache is cleared. Clerk session presence alone does not establish agency employment, department role, record scope, or server authorization.
- **Packaging note:** `pnpm run bundle:production` creates an API-only runtime archive and automatically includes the current `HANDOVER_MANUAL.md`. It also recreates the output folder and archive, so no manual second ZIP command is needed.

The following Section 6 registry describes intended capabilities, not a compliance certification; the verified status notes directly below it define current behavior where the wording is broader.

## 6. Additional Compliance, Platform Resilience and Interface Utilities
* ENVIRONMENT-DRIVEN SPLIT-PATHWAY ADAPTER (USE_REAL_API): An infrastructure gate that ensures the portal defaults safely to mock data arrays inside the workspace environment if production secrets are missing. It instantly pivots the gateway routing to the live secure server the moment production variables are injected.
* PROCESS-LEVEL EXCEPTION INTERCEPTOR: A low-level Node runtime wrapper registering explicit hooks on 'uncaughtException' and 'unhandledRejection'. It intercepts unexpected runtime crashes, formats them into a single synchronous JSON line to stdout, redacts absolute file paths and error messages, and cleanly executes process.exit(1) to prevent unstable system states.
* PINO LOGGER DATA STRIPPER: A high-performance server-side logging configuration hardcoded with dynamic path strings to automatically erase and redact raw HTTP authorization headers, Bearer tokens, and session cookies before strings hit the terminal or SIEM pipeline.
* CUSTOM FORM WRAPPER TYPE SIGNATURES (ZOD 4 COMPLIANCE): Underlying form schemas mapped strictly against 'z.ZodTypeAny' generic constraints rather than legacy Zod 3 variants, ensuring ultra-light compile-time footprints and type safety across all 55 component files.
* BROWSER ERROR BOUNDARY SCREEN & AUTOMATED RETRY: A client-side structural fallback wrapper that intercepts unexpected interface or component code failures. It halts total page crashes, renders an explicit loading/retry button state, and routes exception data safely to the developer tools console while filtering out entered user text data.
* TWO-HOP TRUSTED PROXY INGRESS CONTROLLER: Express reads the trusted proxy hop count from `TRUST_PROXY_HOPS`, defaults to `1`, and validates values from `1` through `16`. Set it to `2` for the documented Columbus ingress; the value is not hardcoded, and the edge proxy must overwrite untrusted forwarding headers.
* ROSTER IMPORT PANEL (MAMMOTH UTILITY): A local text compilation interface embedded in the training assignments workspace that uses an entirely client-side, detached instance of Mammoth to extract raw text strings from '.docx' or '.csv' roster files under a hard 2 MB memory ceiling.
* EXACT-ORIGIN PRODUCTION CORS PERIMETER: An API-level authorization matrix that disables loose wildcard accesses, restricting cross-origin resource sharing strictly to explicit, allowlisted agency HTTPS domains while entirely stripping away server identity signature headers.
* STRUCTURAL JSON RESILIENCE ENVELOPES: A standardized backend-to-frontend payload contract ensuring that all data responses conform to an explicit block structure (status, tracking metadata, and data arrays), guaranteeing clean frontend error-handling loops if an API connection degrades.

### Verified status for Section 6

- **Split-pathway adapter:** `USE_REAL_API` defaults to `false`, so the secure-records API uses mock records. Enabling live mode requires the explicit flag, required server credentials, and a configured department authorization grant; missing live configuration in production fails startup rather than falling back to mock data. Secret injection alone does not switch a running process—operators must set the flag and restart. The Field Training portal is not connected to this endpoint.
- **Process exceptions:** The API bootstrap registers `uncaughtException` and `unhandledRejection` handlers. They emit a synchronous JSONL Pino record to stdout, omit the raw error message, redact absolute paths from stack frames, and exit with status 1. Startup and listener failures use the same safe path.
- **Pino redaction:** The ordinary logger redacts the configured authorization, cookie, and set-cookie object fields; the HTTP request serializer limits logged request fields. This is field-based redaction, not a filter for every arbitrary string, and no SIEM collector is configured here.
- **Zod types:** Zod 4 is used by the shared generated API schemas and form validation. It is not a type wrapper applied to all 55 preview components, and no compile-footprint benchmark is claimed.
- **Error boundaries:** The Component Preview Sandbox boundary catches render errors, shows a retry action, and does not print exception details. The Field Training boundary logs exception details and component stacks to the browser console and displays the error message in development; neither boundary catches every event-handler or asynchronous failure. Do not claim that all user-entered text is filtered from all browser diagnostics.
- **Proxy ingress:** Express reads `TRUST_PROXY_HOPS` dynamically, defaults to `1`, and validates values from `1` through `16`. The documented Columbus ingress uses `2`; it is not hardcoded. Accurate `req.ip` resolution depends on the edge proxy overwriting untrusted forwarding headers.
- **Roster imports:** The upload control accepts CSV and DOCX. CSV is parsed by the local CSV parser; Mammoth is used for DOCX conversion, with extracted cell text read from a detached document. The 2 MB limit applies to the uploaded file size, not a guaranteed maximum decompressed-memory footprint.
- **CORS and server headers:** Production CORS accepts only normalized, explicitly configured HTTPS origins; localhost is allowed only in development. Wildcards are not accepted. CORS is not an authorization policy, and `X-Powered-By` is disabled separately by Express.
- **Response envelopes:** The application API routes use standardized success envelopes and safe error envelopes. This does not make every proxied Clerk response an application envelope or guarantee that every frontend consumer handles all failures correctly.
- **Local phase extension loop:** Pending requests are stored as part of the encrypted workspace record and are persisted before the UI reports success. FTO Coordinator review is reactive to the current local workspace role; it is not a shared database listener or external notification.

# Final System Compliance Summary and Deployment Blueprint

**Audit scope:** This is a source-and-build inventory for the current workspace, not an agency approval, security certification, or claim that the system is ready to process operational records.

## 1. VERIFIED SYSTEMS BASELINE & AUDITOR GROUND TRUTH

* DETERMINISTIC DEPENDENCY LOCK (ZOD 4.6.7): `pnpm list -r zod` reports Zod 4.6.7 for `@workspace/field-training` and `@workspace/api-zod`. The current `pnpm-lock.yaml` contains the `zod@4.6.7` package entry and no `zod@3` package entry.
* SANITIZED PROCESS-LEVEL FAIL-CLOSED LOGGING: The API bootstrap registers `uncaughtException` and `unhandledRejection` listeners. The crash logger writes a synchronous JSONL record to stdout, omits raw exception messages, redacts absolute stack paths, then exits with status 1. This output can be collected by a SIEM, but no Splunk, Elastic, or other collector is configured in this workspace.
* STRICT BOUNDARY ENCAPSULATION: The browser router waits for Clerk's loaded, signed-in user state before mounting private workspace views. This is a client-side render gate, not a server-verified gate for the frontend bundle: page modules are statically imported and can be present in downloaded JavaScript. API authentication is enforced separately by server middleware. The secure-records live path also requires a department authorization grant; that grant is not configured, so live access currently fails closed.
* VISUAL AND FUNCTIONAL SCOPE: The recent hardening did not change page styling or layout. It did intentionally change unauthenticated routing and sign-out/account-switch behavior; therefore it is not accurate to say that all user-facing behavior remained unchanged.

## 2. VERIFIED ARCHIVE FOOTPRINT

* TARGET DELIVERY FILENAME: `dist-production.zip`.
* COMPRESSED ARCHIVE FOOTPRINT: Measure the current archive with `stat -c '%s' dist-production.zip`; the size changes when the compiled API or this manual changes.
* COMPILATION STATUS: The current changes passed `pnpm typecheck`, all 134 Field Training library tests, and the Field Training production build. The API-only production packaging pass also passed its API typecheck/build and ZIP integrity test.
* CLEANROOM STATE: The bundler recreates only `dist-production/` and `dist-production.zip`; TypeScript caches and platform toolchain metadata are not part of the archive and are not removed by this packaging command.

## 3. STANDARD HANDOVER SHELL SCRIPT FOR THE IT OPERATOR

The standalone package is an API-only ESM service. It does not contain or serve the Field Training Officer Portal's static frontend. Install runtime dependencies from the agency-approved package mirror or a pre-populated npm cache when the server has no internet access.

```bash
# 1. Unpack the delivery package
unzip dist-production.zip -d /opt/hardened-gateway
cd /opt/hardened-gateway

# 2. Confirm the supported Node.js range
node --version
# Supported: ^20.19.0 || >=22.12.0 <25

# 3. Install production dependencies from the approved source
npm install --production

# 4. Set non-secret runtime configuration
export NODE_ENV=production
export PORT=8080
export TRUST_PROXY_HOPS=2
export USE_REAL_API=false

# 5. Inject required values via the agency secret manager/service manager:
# AUDIT_ID_HMAC_KEY (minimum 32 bytes)
# CLERK_PUBLISHABLE_KEY
# CLERK_SECRET_KEY (for the Clerk proxy)

# 6. Start the API
npm start
```

`HOST` is not read from the environment; the API binds to `0.0.0.0` directly. `TRUST_PROXY_HOPS=2` applies only to the documented two-hop ingress and must be re-verified if that topology changes. `USE_REAL_API=false` serves mock records for isolated validation only; it is not an operational records service. Do not set `USE_REAL_API=true` for agency operations until an approved upstream endpoint, server credential, and department authorization-grant adapter are configured. `REAL_API_KEY` is a server-side upstream credential, not the HMAC key. Never put real secrets or invented example URLs in this manual.

## 7. Reverse-Proxy Hops and Ingress Networking Management

### A. THE TRUSTED INGRESS BOUNDARY OVERVIEW

Express's `trust proxy` setting controls which forwarding hops may be used to resolve `req.ip` and host information for audit processing. The API reads `TRUST_PROXY_HOPS` as an integer; it defaults to `1` and currently accepts values from `1` through `16`. The documented agency ingress uses two trusted hops. The edge proxy must overwrite client-supplied forwarding headers, and operators must confirm the actual network path before setting the count.

* WARNING: Too few trusted hops can leave audit records showing a proxy address instead of the originating client address. Too many trusted hops can cause Express to rely on attacker-controlled forwarding entries if clients can reach the application through a shorter or untrusted path. Do not expose the application through alternate paths that bypass the configured proxy chain.

### B. CHANGING THE PROXY HOP CONFIGURATION

Set `TRUST_PROXY_HOPS` in the service manager or process environment. No source recompilation is required, but the API process must be restarted for the value to take effect.

* TO SET FOR A SINGLE-HOP TOPOLOGY (only when verified):
  ```sh
  export TRUST_PROXY_HOPS=1
  ```

* TO SET FOR THE DOCUMENTED TWO-HOP AGENCY INGRESS:
  ```sh
  export TRUST_PROXY_HOPS=2
  ```

* CIDR NETWORK LISTS ARE NOT ACCEPTED by the current configuration. A value such as `10.0.0.0/8, 172.16.0.0/12` fails validation; supporting trusted proxy ranges would require an application configuration change and separate review.

### C. CONFIGURING LOCAL SYSTEM DEMO MODES

The current API does not support zero trusted hops: `TRUST_PROXY_HOPS=0` fails startup validation. If the variable is omitted, it defaults to `1`; omission does not disable proxy trust. For a local or direct-access deployment, administrators must assess the network path before using the current default. A zero-hop mode would require an application configuration change.

### D. NETWORKING ENVIRONMENT VARIABLE MATRIX

| Variable Identifier | Supported Value | Operational Impact |
| :--- | :--- | :--- |
| `TRUST_PROXY_HOPS` | Integer from `1` through `16`; default `1`. The documented agency topology uses `2`. CIDR lists and `0` are rejected. | Sets Express's numeric trusted-proxy hop count used to resolve request IP and host values. |
| `HOST` | Not read by the application. | The API binds to `0.0.0.0` directly; setting `HOST` has no effect. |
| `PORT` | Integer from `1` through `65535`; default `3000`. | Sets the API listening port. |

## 8. WEEKLY TIMELINE INTERPOLATION DRAFT

The Weekly Packet Acknowledgement can seed its existing **FTO Comments** field with a deterministic, editable local summary for a newly created acknowledgement. It uses the selected probationary officer and Sunday–Saturday week. The summary is generated in browser memory from the decrypted local workspace; it makes no network request.

* Rating observations are included only from daily logs with `ratingsReviewedAt` set and `limboDay` false. The summary uses the project's exact current SEG categories and letter markers. It reports frequencies as counts, not as a numerical performance score.
* It can state recorded UA-to-A or UA-to-RT changes and repeated UA entries within the same exact category, with source dates. It does not call categories “critical,” rank them, infer motives, or convert recorded ratings into independent performance findings. RT and NRT retain their defined rating meanings.
* Run modules and checklist items are included only when the run form is complete and has a checklist review timestamp. Output is grouped by date and exact form/category labels. The phase-wide `Task` records are excluded because they do not identify a probationary officer; attributing them to an individual would be unsupported.
* Raw narrative, PO comments, incident details, and other free-text observations are not copied into the generated summary. The draft identifies itself as system-generated and requires FTO verification and editing before use. It is not a signature or approval.
* Existing saved acknowledgements and manually edited FTO comments are preserved. If source records change while an unsaved new draft is open, the generated text refreshes only while the FTO Comments field still matches the system-generated baseline.
* The current application has no monthly packet acknowledgement form, so this draft applies only to the weekly acknowledgement.

## 9. EXCEPTION-ONLY RUN CHECKLISTS

Primary run checklists and currently required supplemental checklists start with their items selected; their Not Applicable controls start clear. This preserves the existing review workflow: the FTO clears any item that was not completed acceptably, did not apply, or was performed by the FTO, then confirms the checklist review before saving the run.

* When run metadata changes the required supplements, the active checklist is synchronized to those requirements. Existing selections and exceptions are kept for forms that remain active. Checklist state for a supplement that is no longer required is removed; if the FTO later re-enables that supplement, it starts with its items selected and requires a new review.
* A checklist section heading can toggle only that section between selected and cleared. The control keeps the heading text and layout unchanged, is keyboard accessible, clears the Not Applicable marker for that block, and invalidates the prior review confirmation.
* The run-derived activity flags remain supporting references. They are counted only on completed, reviewed runs and compared with the manually entered daily activity totals using a nonblocking discrepancy note. They do not change daily, weekly, phase, class, or monthly totals.

## 10. RUN CASCADE, NARRATIVE DRAFT, AND MONTHLY AGGREGATION

### Run and supplemental form context

Arrest Process, OVI Process, and Narrative Addition / Continuation are conditional supplements attached to the same `TrainingRun`, not separate records in a second queue. Every recorded arrest attaches its Arrest Process supplement; OVI Process follows the OVI-processed flag, and Narrative Addition follows its explicit required flag. A transported arrest requires the FTO to enter the actual destination before the new run can be saved. The parent daily report supplies the PO/FTO names and badges, class, phase, shift, and assignment; the run supplies its required date/time and optional incident number/location. Print views reuse the same run object, so its supplement and continuation pages remain linked without copying a second record.

Incident number and location are optional, device-local fields. The run time must be explicitly entered; changing a new draft's shift date keeps a valid entered time attached to that date, and the system no longer substitutes a fabricated end-of-day time. The transported destination is included in the existing print and detailed-workbook fields. Saved drafts remain protected by the encrypted local vault. Printed forms and the class Excel workbook include those fields in plain text; the monthly totals workbook remains aggregate-only. This fictional prototype is not approved for operational data—use demo values only.

### Checklist-derived narrative draft

After the FTO explicitly confirms checklist review, the run form can seed an editable narrative outline from the exact selected labels in the active primary and supplemental checklists. The outline is marked system-generated and must be verified and edited before the run is saved. It does not copy other narratives, incident identifiers, or location values, and it does not create a rating or independent performance conclusion. Existing non-empty narrative text is preserved.

### Monthly Excel aggregation

The monthly summary selects the chosen PO’s saved daily records by `YYYY-MM`. Its Excel output contains exactly **Week 1**, **Week 2**, **Week 3**, and **Week 4** tabs, each formatted after the supplied U-10.174 reference: landscape, fit to one page, officer/phase/date header, three side-by-side SEG panels, a four-part Daily Activity Summary grid, optional FTO-comments area, and rating legend. The approved 30-category set appears above the complete activity matrix with centered counts, bold section headings, and thin black borders. Unused tabs remain present with zero counts. If the source month or approved phase ranges require more than four weekly ranges, export stops with an explanation; it never merges separate weeks into one tab or silently drops records. A selected record outside the four ranges also stops export. Raw incident/location values, charge descriptions, and narratives are excluded from this aggregate workbook.

Applicable unchecked tasks on newly created or explicitly edited duty/run checklists project UA into named categories immediately, except on Limbo days. That immediate marker is not a weekly rating count: an exception articulation group is not offered for editing until the associated checklist has been explicitly reviewed, and weekly A-ceiling suppression and counts use reviewed, non-Limbo daily summaries only. Multiple failed tasks in the same category on one run remain one articulation group with all source coordinates. The user approved named-category meanings rather than historical manual numbers as worksheet ordinals. This is user-directed local prototype behavior, not independent certification of a manual-mandated algorithm. Explicit Not Applicable sections and Limbo-day rating restrictions remain respected. No numeric performance rating is used.

### Spreadsheet export validation and formatting

Local spreadsheet exports validate their input records with Zod before workbook
construction. The validation uses the existing 30-category definition and rejects
unknown rating categories, missing category entries, malformed nested run data,
and non-integer or negative activity counts. This is a local export boundary, not
an API integration or a substitute for FTO review.

The weekly form retains its three evaluation partitions and four activity
partitions during class workbook assembly. Workbook formatting uses bold uppercase
section headings, bordered rating cells, centered integer counts, and left-aligned
labels. The four-tab monthly grid replaces the earlier Monthly Totals/Run Support
pair; detailed run evidence remains in the class workbook. Formula-like user
text remains literal spreadsheet text.

The supplied UA default and named-category interpretation are active in the
local checklist workflow. The four-tab exporter fails explicitly when a month
or approved phase schedule needs more than four separate weekly ranges. It never
changes phase lengths, combines source weeks, or omits records to fit the
workbook. Articulations do not assert that training occurred; new source-linked
weekly entries leave actual training time blank.

## 11. SHIFT-LOCAL OPERATIONAL PAGE COORDINATOR

The workspace provider exposes `useOperationalStateMachine` for the active daily
record. Its projection is rebuilt from the current report and matching phase
schedule rather than incrementing a shared global counter. Changing to the next
shift therefore starts a new packet at Page 1; it does not delete saved shifts,
rewrite encrypted tables, or bypass the existing vault lock/logout lifecycle.
There is no application-defined packet page cap. Device memory and JavaScript
runtime limits still apply; this is not a claim of literally infinite storage.

The shared order is:

1. Substation Orientation on the first scheduled workday of each phase only:
   one U-10.181 checklist sheet at Page 1.
2. Reporting for Duty on every day: Page 2 after orientation on phase ingress,
   otherwise Page 1. No saved duty record or duty checklist is removed.
3. Runs in chronological start-time order. Each run has its primary sheet,
   followed by its required Arrest Process and/or OVI Process sheets and every
   generated narrative continuation.
4. Any orientation-note U-10.192 attachments, preserving the entire original
   text without clipping or moving the first run's reference.
5. The daily performance summary, followed by its comment/retraining
   continuation sheets.

Selecting Arrest Made now requires the Arrest Process supplement even when the
transport toggle is clear. OVI Process remains conditional on OVI Processed.
The existing form-rendering and metadata inheritance use the same parent daily
record and run, avoiding independent copies of incident headers. Removing a
conditional supplement rebuilds the projection without leaving duplicate nodes.
No statistic or completed-training statement is inferred from attaching a form.

Print documents and class workbook **Daily Page Index** and **Checklist
Exceptions** sheets consume the same page sequence. `W#D#P#` identifies the
scheduled training week/day and the particular source form, not whichever page
was added last. If the phase schedule is unavailable, exports say that the
coordinate is unavailable instead of inventing a day number. Incomplete
phase-start orientation blocks local packet review and the print-all action.
Only the approved orientation screen and its print layout were redesigned.
Other forms retain their existing layouts.

Cleared applicable checklist tasks generate source-linked exception evidence.
Explicit Not Applicable groups are excluded. Evidence distinguishes reviewed
from unreviewed checklists. Named-category UA routing and weekly ceilings are
now active for opted-in local checklists as described below; no coaching or
completed training is inferred.

### Existing source references and edits

Historical source-reference text, authored narratives, and actual training time
are preserved. Restoring a workspace from before packet-index scheme version 2
clears its source-reference review confirmations, not its content. Save locally
to persist that review-state migration. Later source-record edits, phase schedule
changes, or orientation changes also invalidate affected reference reviews.
Reconfirm coordinates against the regenerated packet before using them as
reviewed evidence. Existing paper packets retain their original historical page
numbering; the application does not silently rewrite those citations.

### Build and delivery scope

Run `pnpm typecheck`, then
`pnpm --filter @workspace/field-training run build`, followed by
`pnpm run bundle:production`. The existing bundler produces the API-only
`dist-production.zip` with this manual. Serve the portal's separate
`artifacts/field-training/dist/public` output through the agency static web server
with SPA history fallback, preserving `/api/*` forwarding to Express. A separate
portal static ZIP may be created from that directory; `npm start` in the API
distribution does not host the portal.

## 12. NAMED SEG ROUTING, ARTICULATIONS, AND CLEARANCE DRAFTS

The workspace retains exactly 30 named evaluation categories under Zod 4.6.7.
Historical manual references 31–38 are citations within that consolidated model,
not extra worksheet rows. Never delete approved categories because of those
reference numbers.

The workspace exposes a frozen source-task directory keyed by form and exact
checkbox key. Duty tasks default to Report/Prepared for Duty. Call-for-Service
and Domestic Incident safety blocks default to Threat Assessment. Building
Search entry/search/tactics and room-entry blocks default to Building Search;
approach tasks use Run Approach. Legal, search, arrest-restraint, transport,
communication, geography, and report-writing tasks use the corresponding named
categories. Defaults are inspectable in `seg-deficiencies.ts`; they are semantic
defaults approved as an approach, not a certified manual crosswalk.

An applicable cleared task immediately projects UA while editing, even before
checklist confirmation. The articulation dialog is offered only after the FTO
explicitly confirms that checklist review. It groups all source tasks in one
incident/category and displays their current W#D#P# coordinates outside the
editable narrative. The FTO can select any of the 30 named categories as an
override. Rerouting moves the current source tasks,
merges distinct articulations without truncation, and restores the old category's
prior rating when no deficiencies remain there. Human-entered rating text is
preserved. NRT is not downgraded to UA. Rechecking tasks restores the captured
baseline rather than inventing a rating. Temporary dialog tracking resets when
the incident editor closes.

The articulation textarea has no application character cap; browser memory is
still finite. Completing daily rating review requires articulation for every
active deficiency. Source-linked weekly rows are unique per incident/category,
leave actual training time blank, and require reference review before formal
use. Limbo days retain the no-ratings rule. Historical checklists are not
silently converted: automation activates on new records or an explicit duty/run
checklist edit.

The duty editor stores a mutable **Cruiser ID**, distinct from precinct,
district, or FTO Assignment. A new shift defaults it from the most recent saved
record in the same class/recruit/phase. **Shotgun Training** is required to save
and accepts only `Y` or `N`; it is not automatically carried into a later shift
and does not replace the detailed shotgun checklist. `N` marks
Resource/Equipment Usage as not applicable, separately from the rating values.
The category is excluded from weekly rating counts unless a recorded deficiency
exists. Names, badges, phase, assignment, and shift schedule continue to come
from the phase folder. Changing
a new daily draft's shift date also updates the date portion of a valid run
timestamp while retaining its entered time; the application does not fabricate
a timestamp when one is absent or invalid.

### Phase and Limbo bounds

The calendar is bounded to 15 program weeks with a 4/4/4/3 duration split:
Phase I is weeks 1–4, Phase II weeks 5–8, Phase III weeks 9–12, and Phase IV
weeks 13–15. Limbo covers all
scheduled working days in Phase I week 1, the first two scheduled working days
of Phase II, and the first scheduled working day of Phases III and IV. Limbo
reports retain checklists and daily activity records but do not accept SEG
ratings or rating review. Reports beyond a phase's configured week length fail
validation. The portal does not yet auto-create the next phase assignment or
provide a Week 15 release/termination recommendation workflow.

The authoritative phase configuration is the workspace-root
`src/config/phaseConfiguration.ts`. Its `PHASE_TIMELINE_REGISTRY` is the single
source for phase durations and Limbo policy. The artifact-local
`artifacts/field-training/src/config/phaseConfiguration.ts` only re-exports the
root module. `model.ts` and `training-calendar.ts` derive phase lengths,
program-week starts, and Limbo boundaries from the root registry. The local
phase-setup Zod schema uses the same phase-length constants to enforce its
minimum week-range count. The monthly exporter consumes saved/computed
`phaseWeekRanges`; default ranges are generated from the registry, while
approved extensions may lengthen the saved ranges. The generated API schemas
do not encode phase durations, so they should not be described as direct
consumers of this registry.
The standard values are 4/4/4/3, with starts at weeks 1, 5, 9, and 13. Phase IV
is fixed at three weeks. A change requires formal
program approval; the Phase IV extension is not active by default.

For agency developers working outside Replit, open the workspace-root registry in
a standard text editor, change the approved phase's `durationInWeeks` value, and from the repository root
run `pnpm typecheck` followed by `pnpm run build`. Review the phase-setup date
range validation, Limbo boundaries, weekly numbering, export tests, and
four-tab workbook behavior before release. These checks must run on the
agency-managed workspace with the project's pnpm lockfile.

### Updating validation bounds and exported totals

1. Phase week-count bounds are read from `PHASE_LENGTH_WEEKS` in the phase
   registry; `phase-setup.tsx` validates the number and order of Sunday–Saturday
   ranges against that value. Do not add a second phase-duration table.
2. Limbo limits also come from the registry. Verify `training-calendar.ts`
   schedule and Limbo tests after changing an approved boundary.
3. The 30 SEG names and daily activity field names are centralized in
   `lib/model.ts`. Checklist-to-category mappings are in `lib/seg-deficiencies.ts`.
   Add or rename fields only after review against the approved form taxonomy.
4. Clearance multipliers live in `lib/run-activity.ts`. Preserve the distinct
   1V/2V/3V/4V rules, prevent manual-plus-derived double counting, and add tests
   for each multiplier and its invalid combinations.
5. The weekly summary and monthly workbook consume the shared rating and
   activity helpers. The monthly workbook builds four weekly tabs in
   `lib/monthly-export.ts`; it stops rather than merge or omit ranges when data
   do not fit. Keep spreadsheet formula escaping in `lib/spreadsheet-text.ts`.
6. Run the focused Field Training tests, `pnpm typecheck`, and the Field
   Training build. Only then use `pnpm run bundle:production` for the separate
   API-only archive; that archive is not the full web portal deployment.

An Officer Safety deficiency also latches UA for its named daily category even
if its checklist item is rechecked later in the same report. This applies to
Threat Assessment, Initiating Arrests, Handling Prisoners, Vehicle Stops, Run
Approach, Building Search, and Pat Down/Searches. The rating remains visible and
cannot be cleared on that day; a Limbo report never receives the latch.

### Versioned clearance-derived activity

New run records carry `clearanceRulesVersion: 1`. Legacy runs retain their manual
accounting even when edited; they are not recounted retroactively. Only completed,
checklist-reviewed versioned runs contribute automatic counts. Displayed totals
are manual extras plus derived counts; editing a total adjusts its manual portion
without counting the run again. Run activity flags remain supporting evidence.
Transport starts unchecked on a new run. `3V` requires Arrest Made and
transport. Selecting Arrest Made or 3V preselects transport and reveals
destination fields. The FTO selects Jail, HQ, or Clerks
and enters the actual destination for a new versioned run. If no transport
occurred, the FTO can clear the transport flag; an arrest without transport must
use 1V. The destination type and actual destination appear in the daily print
form and detailed class workbook. `4V` is timeline evidence only and does not
increment activity totals.

- `1V`: uses an explicitly selected Traffic Citations metric if present;
  otherwise a Traffic Stop or selected Solve Citation/Summons metric contributes
  one Solve Citation/Summons; other runs contribute one PremierOne Report.
  Distinct citation columns are not automatically incremented together.
- `2V`: no automatic report or citation count.
- `3V`: one U-10.100, one Prisoners Slated, one PremierOne Report, one Probable
  Cause Affidavit, and one Criminal Complaint per explicitly entered charge.
- `4V`: no extra report/citation multiplier was supplied, so none is invented.
- Traffic-stop totals increase only for completed, reviewed 1V/2V/3V traffic-stop
  runs; 4V does not create that count. Other source activity flags do not replace
  or duplicate the clearance-derived totals.

For `3V`, the editor accepts one charge per line and derives stable, distinct
draft payloads: U-10.100, Probable Cause Affidavit, and one Criminal Complaint
Form payload per charge. Changing the code or charges rebuilds that list instead
of appending duplicates. The class workbook includes **Generated Document
Payloads** for inspection. These are local data drafts—not completed, signed,
filed, or legally validated documents—and add no physical pages without an
approved printable template.

Weekly views, print forms, workbook forms, and monthly exports share the
category-ceiling calculation. Export strings are guarded against formula
prefixes, including leading whitespace/control characters. Authentication,
proxy routing, CSP, vault cryptography, and disk retention are unchanged.
