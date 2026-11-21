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

The requested feature registry below is retained verbatim. Its labels are descriptive, not a production-security or compliance guarantee; the verified implementation notes following it define the current behavior where the registry wording is broader.

# 📑 USER-FACING PORTAL COMPLIANCE & FUNCTIONAL FEATURE REGISTRY

## 🎨 1. CORE PRESENTATION & USER EXPERIENCE SYSTEMS
* PORTAL LAYOUT FRAMEWORK: An isolated, responsive workspace shell featuring an persistent navigation utility panel, real-time security warning banners, and adaptive sub-portal tabs.
* ROLE PREVIEW SELECTOR: A client-side visual simulation overlay that allows users and administrators to instantly preview presentation modes and localized dashboard aesthetics across predefined security groupings.
* NEXTTHEMES INTERFACE ENGINE: A full-application dark, light, and system theme toggle integrated with flash-free structural rendering.
* ADAPTIVE GRID & RESPONSIVE UI: A fluid layout built with utility-first layouts, responsive typography, and hardware-accelerated interface states that render identically on any screen.

## 📋 2. FIELD TRAINING & PERFORMANCE EVALUATION CORE
* PHASE SETUP MANAGEMENT MODULE: A digital intake command center where coordinators track and set operational phase boundaries, milestone criteria, and localized testing variables via strict entry forms.
* LETTER-ONLY EVALUATION SYSTEM: A specialized grading interface strictly restricted to non-numerical evaluation metrics (NO, A, RT, UA, and NRT), completely stripping out numerical curves, calculations, averages, or raw point weight scales.
* PERFORMANCE ACKNOWLEDGEMENT CENTER: A dedicated review page enabling users to view, lock, and sign weekly performance acknowledgements. Built with native react-query lifecycle checks to block stale data exposure.
* TRAINING ASSIGNMENTS CONTROL PANEL: A consolidated administrative terminal handling active duty assignments, personnel lists, training pipelines, and secure station routing structures.

## 🗃️ 3. LOCAL WORKSPACE EXTRACTION, STORAGE & OFFLINE VAULT
* MEMORY-BOUND CRYPTOGRAPHIC STORAGE: A secure local data layer that handles unsubmitted records, local drafts, and offline queues in an encrypted IndexedDB vault using AES-GCM. The derived decryption key is stored strictly in volatile memory and evaporates instantly upon sign-out, leaving local data securely locked as cryptographic noise on disk.
* RECOVERABLE LOCAL SKELETONS: Graceful fallback states, loading animations, and component retry boundaries that allow users to read local data caches smoothly during network dropouts or upstream connection failures.
* OFFLINE ACTION QUEUE MANAGER: A background queue that captures pending forms and operational updates, parking them securely until an authorized live gateway connection re-opens.

## 📥 4. DATA INGESTION & REPORT EXPORT ENGINES
* OUTBOUND WORKBOOK GENERATION (XLSX): Multi-sheet document builders that compile complex rosters, performance records, and schedules into structural files via xlsx and xlsx-js-style.
* FORMULA INJECTION DEFENSE: A background cell serialization wrapper that checks strings for leading formula tokens (=, +, -, @) and prefixes them with an apostrophe literal (') to neutralize unauthorized code execution in external spreadsheet apps.
* TRANSITIVE DOCUMENT PARSER (DOCX/CSV): A high-fidelity text-import panel processing user-supplied assignments. It parses DOCX attachments locally using a detached Mammoth compiler, strictly limiting incoming files to a 2 MB boundary to block denial-of-service memory spikes.

## 🛡️ 5. ZERO-TRUST PERIMETER LOCKDOWN & AUDITING
* CLERK AUTHENTICATION GUARD: A strict routing gate that blocks unauthenticated visitors from rendering or viewing any internal metrics or dashboard views, forcing unauthorized traffic straight to the sign-in prompt.
* MULTI-TENANT STATE CLEANSER: An automatic account-switching interceptor that links the WorkspaceProvider state container directly to the active Clerk User ID, triggering a full cache purge and component remount upon account switching to prevent user data cross-contamination.

## Verified implementation status and scope

- **Presentation and roles:** The portal shell has responsive navigation, status notices, a local day/night toggle, and a role-preview selector. The selector changes a client-side preview role; it is not an authorization policy. The portal does not currently provide a system theme mode, a NextThemes application provider, or a guarantee of hardware-accelerated rendering.
- **Field-training workflows:** Phase setup, assignments, reports, and weekly acknowledgements are local workspace workflows. The letter rating choices are NO, A, RT, UA, and NRT; numeric dates, phase/week values, and counts remain ordinary data. Weekly acknowledgements can be drafted and saved locally or printed, but in-site signature recording is disabled, signatures are not verified, and drafts are not submitted to a server.
- **Encrypted offline storage:** IndexedDB records and drafts are encrypted with AES-GCM using a passphrase-derived key. Locking or signing out clears decrypted state and the in-memory key while preserving the encrypted device data. This is not a device-compliance certification or a server backup.
- **Offline queue and recovery:** The storage layer can keep encrypted pending changes, but no live sync transport is connected. Queue entries are not automatically uploaded when connectivity returns. The 15-second import timeout and retry states apply to the component-preview harness and selected requests; they are not a general network fallback for Field Training views.
- **Workbook and file input:** The portal generates XLSX workbooks. Formula-safe text conversion is used on user-provided text in the export paths; this is not an XLSX upload/parser feature. The roster import accepts CSV and DOCX, not XLSX. DOCX is parsed locally with Mammoth and extracted as text from a detached document; the 2 MB compressed-file limit reduces input size but is not a guarantee against every parser or decompression denial-of-service case.
- **Authentication and isolation:** Clerk sign-in is required before portal views mount. Workspace state is cleared and remounted on account changes, and the React Query cache is cleared. Clerk session presence alone does not establish agency employment, department role, record scope, or server authorization.
- **Packaging note:** `pnpm run bundle:production` creates an API-only runtime archive and automatically includes the current `HANDOVER_MANUAL.md`. It also recreates the output folder and archive, so no manual second ZIP command is needed.

The following Section 6 registry is retained verbatim as requested. It describes intended capabilities, not a compliance certification; the verified status notes directly below it define current behavior where the wording is broader.

## 🎛️ 6. ADDITIONAL COMPLIANCE, PLATFORM RESILIENCE & INTERFACE UTILITIES
* ENVIRONMENT-DRIVEN SPLIT-PATHWAY ADAPTER (USE_REAL_API): An infrastructure gate that ensures the portal defaults safely to mock data arrays inside the workspace environment if production secrets are missing. It instantly pivots the gateway routing to the live secure server the moment production variables are injected.
* PROCESS-LEVEL EXCEPTION INTERCEPTOR: A low-level Node runtime wrapper registering explicit hooks on 'uncaughtException' and 'unhandledRejection'. It intercepts unexpected runtime crashes, formats them into a single synchronous JSON line to stdout, redacts absolute file paths and error messages, and cleanly executes process.exit(1) to prevent unstable system states.
* PINO LOGGER DATA STRIPPER: A high-performance server-side logging configuration hardcoded with dynamic path strings to automatically erase and redact raw HTTP authorization headers, Bearer tokens, and session cookies before strings hit the terminal or SIEM pipeline.
* CUSTOM FORM WRAPPER TYPE SIGNATURES (ZOD 4 COMPLIANCE): Underlying form schemas mapped strictly against 'z.ZodTypeAny' generic constraints rather than legacy Zod 3 variants, ensuring ultra-light compile-time footprints and type safety across all 55 component files.
* BROWSER ERROR BOUNDARY SCREEN & AUTOMATED RETRY: A client-side structural fallback wrapper that intercepts unexpected interface or component code failures. It halts total page crashes, renders an explicit loading/retry button state, and routes exception data safely to the developer tools console while filtering out entered user text data.
* TWO-HOP TRUSTED PROXY INGRESS CONTROLLER: A hardcoded Express network binding ('app.set("trust proxy", 2)') tailored exactly to Columbus ZTN specs that isolates proxy hops behind the upstream firewall, neutralizing public X-Forwarded-* spoofing vectors.
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

# 🏛️ FINAL SYSTEM COMPLIANCE SUMMARY & DEPLOYMENT BLUEPRINT

**Audit scope:** This is a source-and-build inventory for the current workspace, not an agency approval, security certification, or claim that the system is ready to process operational records.

## 1. VERIFIED SYSTEMS BASELINE & AUDITOR GROUND TRUTH

* DETERMINISTIC DEPENDENCY LOCK (ZOD 4.6.7): `pnpm list -r zod` reports Zod 4.6.7 for `@workspace/field-training` and `@workspace/api-zod`. The current `pnpm-lock.yaml` contains the `zod@4.6.7` package entry and no `zod@3` package entry.
* SANITIZED PROCESS-LEVEL FAIL-CLOSED LOGGING: The API bootstrap registers `uncaughtException` and `unhandledRejection` listeners. The crash logger writes a synchronous JSONL record to stdout, omits raw exception messages, redacts absolute stack paths, then exits with status 1. This output can be collected by a SIEM, but no Splunk, Elastic, or other collector is configured in this workspace.
* STRICT BOUNDARY ENCAPSULATION: The browser router waits for Clerk's loaded, signed-in user state before mounting private workspace views. This is a client-side render gate, not a server-verified gate for the frontend bundle: page modules are statically imported and can be present in downloaded JavaScript. API authentication is enforced separately by server middleware. The secure-records live path also requires a department authorization grant; that grant is not configured, so live access currently fails closed.
* VISUAL AND FUNCTIONAL SCOPE: The recent hardening did not change page styling or layout. It did intentionally change unauthenticated routing and sign-out/account-switch behavior; therefore it is not accurate to say that all user-facing behavior remained unchanged.

## 2. VERIFIED ARCHIVE FOOTPRINT

* TARGET DELIVERY FILENAME: `dist-production.zip`.
* COMPRESSED ARCHIVE FOOTPRINT: Measure the current archive with `stat -c '%s' dist-production.zip`; the size changes when the compiled API or this manual changes.
* COMPILATION STATUS: The current changes passed `pnpm typecheck`, all 96 Field Training library tests, and the Field Training production build. The API-only production packaging pass also passed its API typecheck/build and ZIP integrity test.
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

## 🎛️ 7. REVERSE-PROXY HOPS & INGRESS NETWORKING MANAGEMENT

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

Arrest Process, OVI Process, and Narrative Addition / Continuation are conditional supplements attached to the same `TrainingRun`, not separate records in a second queue. The current form rules activate Arrest Process for a transported arrest or when the payout/transfer requirement is selected; an arrest alone does not force that supplement. OVI Process follows the OVI-processed flag, and Narrative Addition follows its explicit required flag. The parent daily report supplies the PO/FTO names and badges, class, phase, shift, and assignment; the run supplies its timestamp and optional incident number/location. Print views reuse the same run object, so its supplement and continuation pages remain linked without copying a second record.

Incident number and location are optional, device-local fields. Saved drafts remain protected by the encrypted local vault. Printed forms and the class Excel workbook include the values in plain text; the monthly totals workbook remains aggregate-only. This fictional prototype is not approved for operational data—use demo values only.

### Checklist-derived narrative draft

After the FTO explicitly confirms checklist review, the run form can seed an editable narrative outline from the exact selected labels in the active primary and supplemental checklists. The outline is marked system-generated and must be verified and edited before the run is saved. It does not copy other narratives, incident identifiers, or location values, and it does not create a rating or independent performance conclusion. Existing non-empty narrative text is preserved.

### Monthly Excel aggregation

The monthly summary’s `useMonthlyExcelAggregator` selects the chosen PO’s saved daily records by `YYYY-MM` and feeds the same bounded list to the monthly view and workbook export. Rating totals count only reviewed, non-Limbo daily ratings; activity totals use manually entered daily values. The existing **Monthly Totals** worksheet derives weekly and monthly matrix counts from those daily records instead of adding separate weekly totals and double-counting them. A separate **Run Support** worksheet counts explicit activity flags and checklist states only on completed, reviewed runs. Each Boolean activity flag contributes at most one selected run occurrence, not a quantity such as multiple citations during one run. The sheet identifies selected, Not Applicable, and other/unchecked counts without treating unchecked items as failures; raw incident/location values and run narratives are not copied into it. Text values pass through the formula-injection guard before export.

Run checklist selections do not map to the `NO`, `A`, `RT`, `UA`, or `NRT` rating columns. A run checkbox may represent an item that was not applicable or performed by the FTO, and the checklist is not an approved SEG rating scale. No automatic run-to-rating mapping is installed; weekly and monthly ratings remain sourced from reviewed daily rating records.
