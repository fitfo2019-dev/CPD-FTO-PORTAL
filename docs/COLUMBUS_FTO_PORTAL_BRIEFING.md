# City of Columbus Chain of Command Brief
## City of Columbus stakeholder briefing

**Prepared:** November 25, 2026
**Evidence cutoff:** Baseline source and handover review through November 24, 2026; own-account cruiser history and shared patrol-assignment catalog source reviewed November 25, 2026
**Purpose:** Explain the current portal, its workflows, integration readiness, and a practical way to measure a City-approved pilot.
**Update policy:** This briefing is maintained as material changes reach the main workspace, through verified live production publication and formal handover. The evidence cutoff above marks the latest review; planned or unverified work is not presented as implemented.

> **Readiness notice.** This is a source-based product briefing, not City approval, a security or compliance certification, a production-readiness decision, or evidence of realized time savings. No live Columbus identity provider, dispatch feed, records service, agency database, or production host was verified for this briefing. No operational connection is claimed.

## Executive overview

The Field Training Officer Portal (FTO Portal) is a browser application for organizing field-training shift records, run documentation, evaluations, weekly and monthly summaries, class oversight, and packet review. It combines structured forms, validation, reusable phase and assignment details, follow-up views, print layouts, and spreadsheet exports.

The current product has two distinct kinds of work:

1. **Device-local work:** An FTO can prepare and save a training workspace locally. A local save is not an upload, an official shared record, a backup, or a verified signature. A local roster import, assignment, report, weekly acknowledgement, or export does not become shared simply because the user is signed in or online.
2. **Shared-service work:** The source now includes authenticated API flows for phase-extension requests and for daily packet draft sync, explicit final submission, Coordinator review, and packet access actions. Draft synchronization is distinct from finalization: eligible saved drafts may sync when connectivity returns, while final submission remains a separate FTO action. The editor blocks draft sync while local edits are unsaved. These are real implementation surfaces, not merely a lack of code waiting for an endpoint. They still depend on City-approved identity claims, server-side roster and Coordinator data, database installation and grants, runtime configuration, policy decisions, and acceptance testing. None is live-verified for Columbus.

The portal may reduce repeated entry and compilation work: phase details can prefill shift records; required run forms and checklists are organized in one workflow; reviewed evaluations and activity counts feed weekly and monthly summaries; and class-level views help a Coordinator find records and follow-up items. Whether that reduces administrative minutes, after-hours work, or overtime—or changes FTO capacity—is an outcome to measure in a controlled pilot, not an established result. The portal does **not** automatically enter dispatch data, create calls, or guarantee additional runs.

## How to read readiness labels

| Label | Meaning in this briefing |
| --- | --- |
| **Implemented — awaiting City configuration** | Executable portal/API code, contracts or adapters, and supporting checks exist. The City endpoint, credentials, identity/roster data, approved hosting, or other required configuration is not established here. |
| **Partially prepared** | Some reusable code, schema/package support, or UI/API pieces exist, but important parts such as a City-approved authorization model, active migration, operational interface, or acceptance evidence remain incomplete. |
| **Design-only** | A contract or architecture is documented, but that specific service or workflow is not implemented as an operational portal/API path. |
| **Unavailable** | No usable City-facing integration or capability is present in the reviewed source, or the current UI explicitly says the action is unavailable. |
| **Live-verified** | Proven against the actual approved City service and configuration, with recorded acceptance evidence. **No integration surface in this briefing qualifies.** |

“Implemented” describes source, not City authorization or production readiness. Synthetic tests demonstrate selected behavior with fictional data; they do not prove City configuration, deployment, policy acceptance, or real-world performance.

## Roles and boundaries

The application contains role-specific screens for PO, FTO, FTO Coordinator, FTO COC, POLICENET, and POLICENET Admin — SGT. Screen visibility and local role behavior are not, by themselves, proof of a person’s City role or authorization. The shared packet APIs separately require verified agency identity claims and server-held assignment or Coordinator scope. Columbus must decide how every role is provisioned and verified.

| Role | Current portal role view | Important limits |
| --- | --- | --- |
| **FTO** | Sets up a local phase folder; records shifts, duty checks, runs, activity, SEG evaluations, and narrative; reviews assigned PO records in the local class workspace; builds weekly and monthly summaries; can submit a daily packet through the explicit shared workflow when that service is configured. Can submit a shared phase-extension request. | Local assignment, imported roster, and saved report are not shared authority. Shared packet upload requires verified identity and a matching active server roster. Dispatch data is not written automatically. |
| **FTO Coordinator** | Reviews local class/roster information, manages phase setup and local assignment data, coverage and class workflows; reviews phase-extension requests; sees the packet submission inbox and local summaries. Can be the server-authorized Coordinator for shared packet review when provisioned. | The local roster/assignment screens do not provision the trusted server packet roster. City roster, class scope, substitute coverage, account lifecycle, and Coordinator directory operations need an approved process. |
| **Probationary Officer (PO)** | Sees account-access guidance until department email, class, and phase access are activated. Once properly provisioned, can access packet status and eligible released agency packets. | Cannot use the FTO daily-report editor or change FTO-authored ratings and narratives. The shared packet API limits PO reads to the PO’s own eligible, released, non-withdrawn packet. Account sign-in alone does not open a training record. |
| **FTO COC** | A “Submitted Packets” command-review screen is present. | The current screen states that packet review, export, printing, comments, and return-for-review are unavailable for this role. Do not assume it is the Coordinator packet inbox or that it has shared packet access. |
| **POLICENET** | Technical Access and Resources screens. | The current technical page says technical test tools are not available to the account. It does not grant access to operational training records or a technical bypass. |
| **POLICENET Admin — SGT** | Sees the stated two-person SGT/LT approval boundary for record deletion. | No deletion tool is connected. The two-person rule is not a general authority to change evaluations, assignments, or operational access. |

New account registration is invitation-only in the portal. The sign-in flow and role-view names are not a substitute for a City decision on identity provider, staff verification, MFA, employment status, role assignment, class membership, or revocation.

## Feature inventory

### Training work

- **Phase setup:** A phase folder holds PO, FTO, class, phase dates, shift/company, patrol zone, precinct, cruiser district, assignment code, and days off. A Coordinator can import and edit local class/assignment data; an FTO can use an assigned folder. Saving changes affects the current folder, while previously saved daily records retain their snapshots.
- **Patrol-assignment choices:** Phase setup now uses a shared, validated catalog to generate and check FTO assignment choices by precinct and watch. This is training-roster assignment data, not the physical Cruiser field or a live CAD profile; browser selections do not create trusted server roster authority.
- **Substation orientation:** A first-day orientation checklist and printable record support shift setup. The first FTO shift is directed through orientation when a matching record is not present.
- **Daily Performance Log:** A staged editor covers shift, Reporting for Duty, run forms, activity totals, SEG ratings, and narrative/comments. It validates required review steps and fields before final submission.
- **Run forms:** The workflow organizes primary and conditional supplemental forms, checklists, incident details, and narrative. Certain totals and categories are derived from reviewed run information, while manual activity totals remain in the daily record. The FTO reviews and confirms the forms; the portal is not a dispatch-entry system.
- **Follow-up:** Dashboard and class views surface UA/NRT selections and missing follow-up details. These views help locate work but do not prove that a person was notified or that a policy decision was completed.
- **Weekly and monthly outputs:** Weekly views summarize reviewed daily ratings and activity totals; a weekly performance-log supplement gathers relevant UA articulations and corrective-training time. Monthly summaries calculate counts and support local print/PDF and Excel export. The monthly Excel export has a four-week-range limit and reports an error rather than silently generating an incomplete workbook.
- **Coordinator oversight:** Class and roster views can filter local records, show run/activity/rating summaries, find UA/NRT follow-up, and produce a local class workbook. The Coordinator dashboard also links to phase posts, coverage, packet queues, and saved paperwork.
- **Resources:** The portal has an allowlisted resource catalog and authenticated file-download route. This is not a connected City records library or a role- and assignment-scoped document repository.
- **Cruiser assignment history:** The approved Account Settings addition lets verified FTOs and POs read only their own saved operational-token changes, with old/new tokens, server-recorded time and actor, and older entries. Each successful token change and its history commit together; competing or rejected saves cannot leave partial evidence. History begins at an explicitly labeled tracking boundary for existing accounts and does not reconstruct earlier changes or rewrite packet snapshots. Disposable PostgreSQL, access-denial, generated-client and mounted-screen checks passed; City database migration/grants and actual agency use remain unverified and require City configuration.

### Local storage and shared records are different

The normal operational banner says Patrol View and report submission are unavailable and warns that records saved there are local drafts, not submitted or server-confirmed. A user can save the encrypted workspace on the device. An eligible saved FTO draft may later synchronize to the configured shared service, including after connectivity returns; this synchronization keeps it editable and does not submit or finalize it. A local save itself does not upload anything. Online status does not mean a record is shared. Device-local recovery copies are not a database backup or account-level recovery service.

The separate fictional preview is memory-only and clears on refresh. It is for demonstration and testing, not operational data entry. Do not use preview-role selection, synthetic records, or development-only screens as evidence of a City connection.

## Walkthrough: typical work from shift to oversight

The labels **LOCAL**, **SHARED**, and **CITY CONFIGURATION REQUIRED** are deliberate. A screen that looks complete may still contain only local data.

### 1. FTO shift setup and closeout

1. **Sign in.** The FTO uses an approved staff account. **CITY CONFIGURATION REQUIRED:** the current portal account flow does not establish Columbus employment, MFA, assignment, or operational access.
2. **Open phase setup.** Select or enter the PO, class, phase, phase start/week dates, FTO, shift, geography, assignment code, and days off. **LOCAL:** the case folder and ordinary class/roster data live in the device workspace; they do not provision the shared server roster.
3. **Complete first-day orientation when required.** The shift-start route sends an FTO to the orientation record if the matching first-day record is missing. **LOCAL:** completion is part of the workspace unless a separately approved shared record service is configured.
4. **Start or continue a shift.** The dashboard links to a new shift or the existing draft. The next scheduled workday is calculated from the phase folder and saved reports.
5. **Complete duty, runs, activity, evaluation, and narrative.** Reporting for Duty, each selected run form, required supplements, activity totals, and SEG ratings are entered and reviewed. Run details may be manually entered; a future configured dispatch lookup can supply defaults but cannot auto-complete or submit the report.
6. **Save locally.** **LOCAL:** the FTO saves the workspace on the device. “Online” is not a submission receipt. If the shared packet service is unavailable, local drafting remains separate from server storage.
7. **Close out deliberately.** The FTO reviews validation issues, saves changes, and—if the City has enabled the shared packet service—uses the separate **FINALIZE AND SUBMIT TO COORDINATOR** action. **SHARED, only after configuration and a server receipt:** draft sync is not finalization; finalization seals the submitted snapshot and is not an electronic signature.

### 2. Run documentation and dispatch prefill

1. The FTO selects the primary run type and enters date/time and incident/unit details.
2. The workflow presents the applicable checklist and conditional supplemental forms. The FTO reviews each required sheet and confirms it before adding the run.
3. If a dispatch adapter is approved and configured, the portal can request an event prefill or an incident/unit lookup. It maps only defined fields, checks the response, and preserves fields the FTO has changed. **CITY CONFIGURATION REQUIRED:** endpoint, credential, allowed portal users, field semantics, and authorization scope.
4. If the feed is unavailable, the UI is designed to leave manual entry available. The FTO must verify the information against the authoritative dispatch source. The portal does not automatically enter a dispatch event, create a run, or send changes back to dispatch.

### 3. Weekly packet and review

1. The FTO opens a Sunday–Saturday weekly summary for a PO and week. Rating counts use reviewed daily evaluations; they are counts by descriptive category, not numerical performance scores. Run checklist totals include completed and reviewed runs.
2. The FTO may maintain the Weekly Performance Log Supplement and a Weekly Packet Acknowledgement. These are local workspace forms and printable outputs. Signature recording is disabled; typed status or a printed draft is not a verified signature or approved packet.
3. If configured, an eligible saved daily record can synchronize as an editable shared draft when the FTO workspace is online and has no unsaved editor changes; reconnection may start this draft sync. Draft sync alone does not finalize or submit it.
4. The FTO explicitly finalizes a ready packet. The shared API checks the current FTO identity and active server assignment, validates the packet, stores a snapshot, and creates a submission for its assigned Coordinator.
5. The Coordinator receives a blocking receipt gate for incoming submissions, acknowledges receipt, opens the submitted version, then approves it or returns it with a written correction reason. Receipt and approval are separate actions.
6. A correction is not an edit to the acknowledged snapshot. The FTO opens the correction and submits a new version; the new version needs a fresh review.
7. **PO release is a separate boundary.** A separate Agency Packets API/UI exposes release/withdraw/PO-acknowledgment actions. The current source does not establish that Coordinator “APPROVE PACKET” automatically performs the distinct PO release. Columbus must approve and test the canonical handoff from Coordinator approval to PO visibility and any PO acknowledgment.

The daily shared packet workflow is not the same as the weekly paper/manual acknowledgement flow. Do not treat a server receipt, Coordinator approval, PO receipt acknowledgment, or a typed name as interchangeable signatures.

### 4. Monthly reporting and export

1. Select a PO and month from the saved local workspace.
2. Review rating counts and activity totals. Only reviewed daily evaluations contribute to rating counts.
3. Print/save a local PDF or export a local Excel workbook. The export does not submit source daily records and is not a City-approved official form until the City accepts the field mapping, layout, handling, retention, and print/spreadsheet behavior.
4. If an ordinary month or extended phase produces more than four weekly ranges, the current workbook path reports a range error. The City must approve the overflow procedure before operational reliance.

### 5. Coordinator oversight

1. Review locally imported class rosters and saved records, filter by class/PO, and locate follow-up items.
2. Review or edit local phase setup, manage local class and coverage workflows, and use class/phase sign-up information. These screens are not a shared roster-administration console.
3. Review pending phase-extension requests through the shared request route when configured. An approval decision can be observed by the FTO when the FTO next retrieves shared state; this is not a guaranteed push, email, or after-hours notification.
4. Use the packet submission inbox only when the server identity, database, roster, and Coordinator assignment are configured. A shared inbox failure is shown as unavailable, not as a successful empty queue.
5. Export class-level workbooks only from the local records available to that workspace. The export is not proof that all City records were retrieved.

## Integration-readiness inventory

| Surface | Readiness label | What exists in current source | City handoff and what remains unverified |
| --- | --- | --- | --- |
| **Patrol View dispatch event prefill** | **Implemented — awaiting City configuration** | Portal hook and response mapper; mounted authenticated API route; HTTPS endpoint-template validation; bounded request/response, timeout and response normalization; user allowlist; field whitelist and manual fallback. | Approve the event endpoint contract, event ID semantics, token/service account, permitted Clerk user IDs, returned fields/timezone semantics, data minimization, network access, rate limits, and support. Synthetic adapter tests exist. No live Patrol View call or Columbus field mapping was verified. |
| **Patrol View incident/unit lookup** | **Implemented — awaiting City configuration** | Separate API adapter and route; requires incident number and unit; filters returned data to matching unit; unit-specific times are not borrowed from another unit; response fields are validated and sensitive upstream fields are excluded; FTO edits are preserved. | Provide an approved HTTPS URL template with one `{incidentNumber}` placeholder, server-held credential, approved user allowlist, field/unit/time contract, audit expectations, and manual fallback. Parser, fallback, timeout, and malformed-response tests exist. No live endpoint or operational acceptance is claimed. |
| **Daily packet draft sync, finalization, and Coordinator review** | **Implemented — awaiting City configuration** | Portal client and UI; explicit local-draft sync; explicit finalization action; generated Zod/OpenAPI contracts; complete packet validation; verified claim-to-role/badge mapping; server-side active assignment checks; PostgreSQL schema/migrations; bounded batches and exact retry identities; versioned snapshots; packet and review events; Coordinator directory and review inbox; correction replacement path; PO packet endpoints and separate release/ack actions. | Agency DBA must apply the correct fresh or upgrade SQL sequence to an approved **agency** database, configure a separate least-privilege runtime account, and provision real signed identity claims, active FTO/PO assignments, Coordinator directory and PO-to-Coordinator mapping. Required setting names in the current handover include `AGENCY_DATABASE_URL`, `AGENCY_PACKET_SYNC_ENABLED`, `AGENCY_VERIFIED_CLAIM_PATH`, `AGENCY_ROLE_CLAIM_PATH`, `AGENCY_BADGE_CLAIM_PATH`, and `AUDIT_ID_HMAC_KEY`; production Clerk settings are also required. Do not share credential values in this document or chat. Synthetic API/database and client tests cover selected lifecycle and retries; the Nov. 24 stress note reports 205 fictional records through size-aware batches and finalization in disposable PGlite, but explicitly did not perform release or PO acknowledgment. No City DB, account, browser, or live roster test is claimed. |
| **Packet release and PO acknowledgment** | **Partially prepared** | Server routes and portal actions exist for Coordinator release/withdraw and PO read/acknowledgment, with server-side role and roster scope, immutable snapshots, content hashes, operation IDs, and transactional audit behavior. A separate Coordinator submission inbox supports receipt acknowledgment and approve/return. | The two adjacent workflows must be reconciled into a City-approved end-to-end state model: which action completes Coordinator review, when/how PO release occurs, whether a PO acknowledgment is required, and how the weekly signature process relates. This specific handoff was not completed in the Nov. 24 stress run and no live acceptance evidence is available. |
| **Phase-extension requests** | **Partially prepared** | Frontend request/retry/status/review flow; mounted API routes; generated request/response contracts; typed Drizzle schema; agency-database repository; fresh Clerk backend lookup of FTO/Coordinator role; active assignment checks; current PO-to-Coordinator class scope; reviewer and decision time stored on the request; reviewed migration and database-backed route tests. An offline or unavailable submission can remain a device-local unsent draft. | City must apply `agency-training-phase-extensions.sql` after `agency-training-packet-review.sql` and configure the restricted agency database role. There is no append-only decision-event history, central phase-folder update, or push/email delivery. No City database or live roster test is claimed. Official schedule effects still require City approval. |
| **Roster, identity, and class assignments** | **Partially prepared** | Clerk sign-in; signed session-claim mapping for packet API; server-held packet assignment checks; Coordinator provisioning table; local CSV/XLSX/DOCX roster parsing and assignment workflows; a shared Zod-validated precinct/watch assignment catalog in phase setup; access screens and role-specific navigation. | City must select identity/SSO, stable person and badge mapping, MFA, account activation/deactivation, role claims, class/phase roster authority, substitute coverage, history rules, and roster-admin process. The catalog validates available client-side choices; local imports, role views, and client-entered assignment data do not create or authorize a server assignment. The separate broad class-assignment API remains design-only. |
| **Department records/resource services** | **Partially prepared** | A secure-records API adapter validates an HTTPS upstream, service credential, response shape, size, timeout, and errors. The route defaults to mock records and requires a separate server authorization grant in live mode. A fixed allowlisted resource catalog can serve packaged files to signed-in users. | No populated authorization grant or operational portal records view is established; the secure-records route is not a connected FTO record system. Columbus must identify the actual upstream endpoint, approved credential scope, data contract, user/record authorization, audit and classification rules, and approved resource content. The fixed resources route checks sign-in, not assignment-specific access. |
| **Backup, recovery, notifications, and media** | **Unavailable for City operations** | Device-local encrypted workspace and local encrypted recovery copies exist. Source-level packet events and phase request status exist. | No City-managed backup/restore or RPO/RTO evidence, external immutable audit retention, general notification delivery, shared chat, approved object/media storage, or operational recovery service was verified. Device-local recovery copies are not central backups. |
| **Hosting and release packaging** | **Partially prepared** | The API artifact has a production build/start configuration and health endpoint; the portal has a separate Vite build. An API-only production bundle includes API migrations. Build/typecheck and synthetic package rehearsals are documented. | The City must choose and approve hosting, public HTTPS origin, network/proxy/CORS, static portal hosting and API routing, identity proxy, secrets manager, database, monitoring, capacity, service ownership, release process, and rollback. The handover says the API bundle is not a full portal/source archive; the portal is built separately. The Nov. 23 evidence ledger reports no clean-host frozen dependency installation and no complete deployment rehearsal. No approved City deployment or production smoke test was performed. |
| **General shared class/report API described in `API_CONTRACT.md`** | **Design-only** | The document proposes assignment and report APIs, authorization rules, sync, audit, and department hosting requirements. | This proposal is not the same implementation as the current daily packet routes or phase-extension route. Its broad class assignment and general shared report store must not be presented as already mounted or live. |

### Packet database configuration sequence

The current packet handover says:

- For a fresh database, apply `agency-training.sql`.
- For an existing supported packet installation, apply `agency-training-draft-finalization.sql` once before running the newer service.
- Apply `agency-training-packet-review.sql` for both fresh and existing installations.
- Use an agency database owner/admin for reviewed migrations and a separate non-owner runtime account with narrow grants. Do not grant broad schema ownership, deletion, truncation, or unrestricted roster updates to the runtime.
- Provision actual server-side assignments and Coordinator accounts. Do not accept assignments or roles from the browser as authority.
- Keep packet sync explicitly disabled until City approvals and acceptance checks are complete.

This sequence is not permission to run migrations against a live City system. A City DBA must first identify and back up the correct target, reconcile the installation baseline, review each migration and grant, and test on an approved isolated environment.

## Where current source and older documents disagree

The code and documents have changed over time. This briefing uses current executable source and the newer November 24 handover/stress notes for current feature descriptions, while retaining the limits of older evidence:

1. **November 23 launch-readiness assessment:** It records a **NO-GO** assessment for its reviewed source baseline and says the portal had no visible packet submission/review UI, no explicit finalization, and no correction lifecycle. The November 24 `ASSIGNMENT_INTEGRATION.md`, current mounted route/UI source, and `PACKET_STRESS_TEST.md` show later packet finalization and Coordinator review work. The older assessment’s UI and finalization statements are superseded for this briefing; its dated synthetic test results and unverified City infrastructure limits are not thereby invalidated. Any later release still needs a fresh source/hash baseline and acceptance pass.
2. **Packet review documents describe adjacent models:** `AGENCY_PACKET_REVIEW.md` documents `/training-packets/{id}/release`, `/withdraw`, and PO acknowledgment. The newer handover and current `packet-submissions` UI describe a separate finalize-to-Coordinator inbox, Coordinator receipt acknowledgment, approval, and correction request. The code confirms distinct endpoints/actions. The City must define and test the transition between Coordinator approval and the separate PO release/acknowledgment path.
3. **`API_CONTRACT.md` is explicitly a proposal:** Its broad shared assignment/report API is design-only. Its status statement must not be generalized to the distinct packet and phase-extension endpoints that are mounted now. Conversely, those mounted endpoints do not make the proposed general assignment/report API complete.
4. **Phase extensions have shared storage code, not full operational integration:** The November 23 assessment correctly distinguishes shared requests from same-device-only drafts, but notes missing class scope, notifications, and central schedule updates. The current frontend adds polling and shows decisions after retrieval; it does not prove an after-hours delivery notice. Source inspection found a typed table schema but no active migration for the phase-extension table in the reviewed migration directories. This remains a City handoff and verification gap.
5. **FTO COC is not the packet Coordinator:** Current code gives the FTO COC a separate command-review placeholder that explicitly says review/export/comments/return are unavailable. The shared packet Coordinator inbox uses a different role and permission path.

The November 23 launch assessment and evidence ledger remain useful as dated evidence for their baseline. They are not a certification of the November 24 checkout or a substitute for current release testing. The November 24 stress report is synthetic and explicitly excludes City services, real-browser UI acceptance, release, and PO acknowledgment.

## Efficiency mechanisms and limits

| Verified convenience | Administrative work it may reduce | Conditions and limits |
| --- | --- | --- |
| Reuse PO, FTO, class, phase, assignment, and shift details from phase setup | Repeatedly typing the same header and schedule data into each daily form | Correct initial folder and assignment; local values must match the City roster. Old saved report snapshots do not silently change when the folder changes. |
| Guided duty/run stages, required supplement selection, and checklist validation | Searching for required fields, discovering omissions late, or assembling separate run sheets | FTO still enters and verifies facts, reviews each sheet, and completes narrative. More validation may add time when policy or source data is unclear. |
| Optional dispatch prefill | Re-keying approved incident, location, unit, time, and code fields | Only after an approved feed is configured; the FTO verifies and may correct values. No automatic dispatch entry, report completion, or write-back. |
| Activity totals and reviewed evaluations feeding weekly/monthly summaries | Recounting the same saved records by hand | Depends on complete and accurate source records, accepted definitions, review status, and policy on manual versus derived totals. |
| Class/PO filters and UA/NRT follow-up views | Looking across local records to find outstanding items | Local record coverage only; not proof of a complete shared roster or successful notification. |
| Reusable print/PDF and Excel layouts | Reformatting or copying saved values into a report workbook | City must approve the layouts and field mapping; printer/office-suite acceptance and overflow handling remain open. |
| Shared packet submission and review state | Emailing or manually tracking receipt/review for eligible daily packets | Only after City identity, roster, storage, policy, and release workflow are configured. It does not replace weekly signature procedures or records policy. |

These mechanisms can plausibly reduce duplicate entry, manual collation, missing-field corrections, and the time spent locating follow-up records. They can also add work through structured entry, review gates, local/shared reconciliation, or correction requests. No current source provides a validated estimate of minutes saved, overtime avoided, calls handled, or additional FTO capacity.

## City-approved pilot measurement framework

### Design and comparison

Before a pilot, the City should approve the population, workflow, data handling, time definitions, and comparison method. Use an agreed baseline period and a post-training/post-stabilization period. Where practical, use a matched comparison group or phased rollout; otherwise compare like-for-like shifts and phases within the same FTOs and document other changes. Do not mix onboarding/training time with steady-state workflow time.

Use the same definitions and collection method before and after. Capture time from a brief contemporaneous time log or approved study instrument—not from assumptions about application timestamps. The reviewed portal source does not establish a complete paperwork-time telemetry feature. Avoid entering operational narrative or sensitive identifiers into an unapproved study dataset.

### Measures

| Measure | Suggested definition | Denominator / comparison |
| --- | --- | --- |
| **Daily paperwork time** | Minutes spent preparing, checking, correcting, and finalizing duty, run, activity, evaluation, and narrative paperwork for a shift. Record initial preparation and later correction separately. | Minutes per completed FTO–PO shift record; also report median and distribution by shift, phase, and workload stratum. |
| **Weekly paperwork time** | Minutes spent preparing the weekly summary, supplement, acknowledgement, and review/assembly tasks. Separate time spent obtaining missing source information. | Minutes per PO-week with the same required weekly outputs. Report incomplete weeks separately; do not count missing records as zero minutes. |
| **Monthly paperwork time** | Minutes spent reconciling and preparing monthly summaries, PDF/print, workbook export, and any approved overflow procedure. | Minutes per PO-month and per completed monthly output; identify months with more than four weekly ranges. |
| **Rework and correction** | Number and type of returned forms, missing/invalid fields, corrected values, repeat reviews, and time spent on each correction. | Corrections per 100 submitted daily packets (or per 100 shift records); minutes per correction and total correction minutes. Keep first-pass completion and correction reasons. |
| **After-hours work** | Minutes spent on paperwork outside the employee’s scheduled shift, using a City-approved definition of scheduled time and after-hours work. | After-hours paperwork minutes per completed shift record and per FTO-week. Separate voluntary carryover from scheduled administrative time if City policy requires. |
| **Overtime** | Payroll-approved overtime hours attributable to training paperwork, where attribution can be made consistently. Also record total overtime separately. | Paperwork-attributed overtime hours per FTO pay period, per completed shift record, and per eligible FTO. Do not infer overtime from after-hours entry alone. |
| **FTO capacity and workload** | Number of active FTOs, assigned POs, completed scheduled FTO–PO shifts, and time spent in training administration. Include phase, shift, coverage/substitute workload, and relevant staffing changes. | FTO capacity should be expressed using a City-defined denominator such as available FTO hours or completed scheduled FTO–PO shifts. Track calls/runs as context, not as a promised productivity gain. |
| **Quality and timeliness guardrails** | Missing required fields, late/incomplete packets, failed saves/submissions, correction rates, and time from shift end to accepted completion/review. | Rates per eligible record and median elapsed time. Report local drafts separately from shared submissions and approved records. |

### Analysis template

For each measure, calculate:

- **Baseline:** `[City-measured baseline value]` with period, population, denominator, and collection method.
- **Post-pilot:** `[City-measured post-pilot value]` using the same definitions and matched strata.
- **Difference:** `post-pilot − baseline`.
- **Relative change, if meaningful:** `(post-pilot − baseline) ÷ baseline × 100%`. If baseline is zero or not comparable, report an absolute difference or mark the ratio not meaningful.
- **Uncertainty and context:** number of observed shifts/records/FTOs, missing observations, phase/shift/workload mix, staffing changes, holidays, overtime rules, and implementation/training time.

Do not convert paperwork minutes into “extra calls” or “extra runs” without a separately designed and City-approved analysis. Additional FTO capacity is a possible outcome to investigate, not an automatic consequence of shorter paperwork.

## City decisions and acceptance checks before operational use

The following decisions belong to Columbus and should be recorded with an owner, date, approved source/policy version, and evidence:

1. **Identity and access:** approved SSO/Clerk relationship; staff verification; MFA assurance; stable identity and badge mapping; invitation and activation; role/class/phase assignment; session revocation; account deprovisioning; and access for substitutes and former assignments.
2. **Record authority and workflow:** which store is the official record; what draft sync means; which event constitutes submission; how Coordinator receipt, review, approval, PO release, PO acknowledgment, and weekly signatures relate; how corrections and withdrawn versions are retained.
3. **Roster administration:** trusted source, responsible provisioning operator, class and date scope, active/inactive changes, Coordinator directory, substitute coverage, audit, conflict handling, and historical access. Browser import alone is not that process.
4. **Policy and forms:** accepted daily/weekly/monthly forms, SEG labels and rating rules, manual/derived activity definitions, Limbo and phase durations, NRT/UA follow-up, signatures, extension approvals, and workbook overflow. The Nov. 23 assessment records unresolved policy/source contradictions; current generated output is not City approval.
5. **Dispatch and records integration:** system owner, approved endpoint and credentials, data fields and semantics, allowed-user scope, network boundary, service limits, audit, manual fallback, and support. Each is an independent optional integration decision.
6. **Hosting and operations:** approved portal/API hosts, region, public origin, proxy/routing, TLS, CSP/security headers, database and secret management, least-privilege grants, monitoring/on-call, release/rollback, patching, capacity, and support ownership.
7. **Privacy, retention, and recovery:** record classification; permitted use of sensitive fields; printed/exported file handling; retention and legal holds; audit retention; backup and restoration; key/device loss; numerical recovery-point and recovery-time objectives; and local-draft import policy.
8. **Operational acceptance:** two-account and cross-class negative-access tests; roster/revocation tests; packet lifecycle and correction tests; failure/timeout/duplicate retry; real-browser field entry and keyboard/accessibility checks; managed-device offline/upgrade behavior; physical printer and office-suite workbook validation; and measured recovery rehearsal.

### Minimum integration acceptance examples

- **Dispatch:** correct event/incident and assigned-unit match; invalid/other-unit data rejected; no sensitive caller/officer fields returned; FTO corrections preserved; configured outage yields a visible manual path; no write-back occurs.
- **Packets:** unauthorized role/class/PO and revoked account are denied; local save never transmits; draft sync never submits; explicit finalization rejects incomplete packets; retry after lost response is exact and idempotent; Coordinator receipt differs from approval; correction keeps the prior snapshot; PO visibility/acknowledgment follows the approved state model.
- **Phase extensions:** only authorized FTOs can submit; only authorized Coordinators can review within approved class scope; duplicate/stale review is rejected; decision history is retained; local phase folders change only under the approved application rule; notification expectations are tested.
- **Records/resources:** real endpoint and authorization scope verified; no mock data presented as live; missing authorization fails closed; allowed fields and retention are documented.
- **Deployment:** reproducible install on the selected City host; separate portal/API routing; sign-in, deep links, health/dependency checks, secret injection, runtime grants, fail-closed errors, monitoring, backup/restore, and rollback demonstrated.

## Evidence index

The following source and handover references support this briefing. Paths are repository-relative so City reviewers can trace the claims to the reviewed source:

### Current portal screens and workflow

- `artifacts/field-training/src/App.tsx` — authenticated routes and role-specific route boundaries.
- `artifacts/field-training/src/components/shell.tsx` — navigation, local save/lock controls, and local-draft/unsent banner.
- `artifacts/field-training/src/pages/dashboard.tsx` — FTO and Coordinator starting points and work queues.
- `artifacts/field-training/src/pages/phase-setup.tsx`, `class-overview.tsx`, `fto-classes.tsx`, and `substitute-fto.tsx` — phase setup, local roster/class oversight, and coverage/signup.
- `artifacts/field-training/src/pages/report-editor.tsx` — shift/run/evaluation workflow, validation, and packet submission control.
- `artifacts/field-training/src/components/packet-review/submit-control.tsx` and `state/packet-review.tsx` — explicit finalization and review context.
- `artifacts/field-training/src/pages/packet-submissions.tsx`, `components/packet-review/gate.tsx`, and `components/agency-packet-review.tsx` — Coordinator inbox, receipt/review, correction, and separate packet access actions.
- `artifacts/field-training/src/pages/weekly-summary.tsx`, `weekly-performance-log.tsx`, `weekly-acknowledgement.tsx`, and `monthly-summary.tsx` — local weekly/monthly aggregation, forms, and export.
- `artifacts/field-training/src/pages/role-access.tsx` and `command-review.tsx` — PO activation guidance and explicit technical/COC limits.
- `artifacts/field-training/src/hooks/use-patrolview-sync.ts`, `artifacts/field-training/src/lib/dispatch-prefill.ts`, and `artifacts/field-training/src/lib/training-packet-sync.ts` — dispatch mapping and packet client contracts.
- `lib/api-zod/src/patrol-assignment.ts`, `artifacts/field-training/src/lib/cpd-geography.ts`, and `artifacts/field-training/src/lib/patrol-assignment-catalog.test.ts` — shared precinct/watch assignment choices, contextual validation, and catalog checks. This catalog is not the trusted agency roster.

### Current API, adapters, contracts, schema, and tests

- `artifacts/api-server/src/routes/index.ts`, `routes/dispatch.ts`, `routes/training-packets.ts`, `routes/packet-review.ts`, and `routes/phase-extension-requests.ts` — currently mounted API surfaces.
- `artifacts/api-server/src/services/patrolViewIntegration.ts` and `patrolViewIncidentIntegration.ts` — dispatch adapters, HTTPS/configuration checks, mapping, limits, and fallback errors.
- `artifacts/api-server/src/services/govApiIntegration.ts` and `routes/secureRecords.ts` — partially prepared upstream records adapter and separate authorization grant.
- `artifacts/api-server/src/lib/agency-packet-store.ts`, `packet-review-store.ts`, `phase-extension-store.ts`, and `security/agencyIdentity.ts` — packet/phase data operations and server identity checks.
- `artifacts/api-server/migrations/agency-training.sql`, `agency-training-draft-finalization.sql`, and `agency-training-packet-review.sql` — packet schema and review support; confirm installation baseline before any City use.
- `lib/api-zod/src/generated/api.ts`, `lib/api-zod/src/patrol-assignment.ts`, and `lib/db/src/schema/phase-extension-requests.ts` — shared API and table-schema support.
- Relevant tests include `artifacts/api-server/test/packet-draft-finalization.test.ts`, `test/packet-review.test.ts`, `tests/packet-review.test.ts`, `tests/agency-packets.test.ts`, `src/routes/phase-extension-requests.test.ts`, `src/services/patrolViewIncidentIntegration.test.ts`, and portal `training-packet-sync.test.ts`, `dispatch-prefill.test.ts`, and `phase-extension.test.ts`.

### Dated handover and assessment evidence

- `docs/ASSIGNMENT_INTEGRATION.md` — November 24 packet finalization/review handover, migration/configuration requirements, and API-bundle scope.
- `docs/PACKET_STRESS_TEST.md` — November 24 synthetic 205-packet client/API run and explicit coverage limits; no release or PO acknowledgment in that run.
- `docs/AGENCY_PACKET_REVIEW.md` — separate packet release/withdraw/PO acknowledgment model; reconcile with the newer Coordinator inbox workflow before City use.
- `docs/COLUMBUS-LAUNCH-READINESS.md` and `docs/launch-readiness/EVIDENCE.md` — November 23 dated NO-GO assessment and synthetic evidence for that reviewed baseline, including limits on live identity, database, dispatch, browser, print, deployment, and recovery verification.
- `docs/API_CONTRACT.md` — November 21 proposal for a broader shared assignment/report API; it is marked design-only and is not the status of every separately mounted route.
- `docs/SYNTHETIC_STAGING.md` — synthetic-only service boundary and production exclusion; staging is not an operational records connection.

## Bottom line

The current FTO Portal has substantial working training, reporting, local storage, validation, and packet workflow code. Several integration paths are implemented or partially prepared and should not be called “missing” merely because Columbus has not supplied a live endpoint or credentials. At the same time, source code, synthetic success, a signed-in screen, or an API health response does not establish City authorization or production readiness.

Columbus must approve the record lifecycle, role and roster model, identity provider and claims, dispatch and records contracts, hosting and database, policy crosswalk, backup and retention, operating ownership, and acceptance evidence. A pilot can then measure paperwork time, rework, after-hours work/overtime, and FTO workload using City-approved definitions and real baseline data. Until that evidence exists, savings and additional capacity remain hypotheses to measure.
