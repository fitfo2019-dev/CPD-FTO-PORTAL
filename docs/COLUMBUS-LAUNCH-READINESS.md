# Columbus FTO Portal: launch readiness and handoff

**Assessment date:** November 23, 2026 (UTC). **Disposition: NO-GO for operational training records.**

This is an assessment of the reviewed source and a controlled synthetic rehearsal,
not a deployment approval, compliance certification, penetration test, or promise
of zero incidents. No production service, connected-service data, agency accounts,
or real training records were changed. No UI or business-policy remediation was
implemented. New checks characterize existing behavior, including defects.

## Read this packet in order

1. This assessment: capability inventory, agency decisions, launch gates and support.
2. [Risk register](launch-readiness/RISK-REGISTER.md): individually owned findings,
   evidence, triggers, existing protections and measurable acceptance tests.
3. [Evidence ledger](launch-readiness/EVIDENCE.md): baseline, commands, actual
   results and explicit limits of each rehearsal.

**Decision in plain terms:** the software builds and several fail-closed boundaries
work. It is not yet a complete, agency-authorized records system. Enabling packet
upload now could permanently seal unfinished records; two browser instances can
overwrite unsynchronized work; byte-oversized batches cannot progress; shared request
authorization is broader than assigned-class scope. These are not solved by TLS,
encryption at rest, Clerk sign-in, a successful build, or a working health response.

### What changed from the preliminary concerns

- The current generator **and the archive inspected at the start of this run**
  include `migrations/agency-training.sql`. The earlier missing-migration finding
  is superseded. The release is still API-only, without portal assets/source or
  a release-specific dependency lockfile.
- The current packet store selects exactly one active, date-bounded roster
  assignment and inserts `packet_assignments` during upload. **Advance provisioning
  of every individual packet ID is no longer required.** Trusted roster creation,
  substitute coverage, revocation and historical-access operations remain unprovided.
- Phase-extension requests use authenticated shared PostgreSQL storage and
  server-checked Clerk public metadata; they are **not same-device-only**.
  This does not establish class-scoped authorization, immutable decision history,
  notification delivery or centrally updated phase folders.
- The PWA build plugin and production registration **do exist**. Static shell
  caching is not a tested offline authentication/recovery design.

## 1. Reviewed baseline and moving areas

Initial source HEAD: `57f048574fcac4038040beeaa114871a23712efa`, committed
2026-11-23T13:43:34Z. The working tree was already dirty at assessment start,
including packet identity/routes/store/migration and daily-draft code. The
assessment covers those observed bytes, **not a claim that all were merged**.
Critical-file hashes and generated release hashes are in the evidence ledger;
the repeatable runner captures the full selected-source checksum inventory.

Task #34 (Protect training records with agency role access) was active in the
main workspace at baseline. Its observed packet changes are assessed but not
modified. Task #47 (Add Portal Vite Typechecking) was merging, while
Task #48 (Clean Up Orientation Checklist) and Task #51 (Select High Risk Stops)
were active. No edits were made to those implementations. New source, policy,
dependency or hosting changes invalidate affected conclusions and require a
fresh release baseline and relevant acceptance checks before approval.

**Final merged-source reconciliation:** the assessment was synchronized onto
`059db89bb58f84172f20ec781d1c1bee9a91f5e8`, including the merged #34 agency packet
and #47 Vite checker work. A second complete synthetic/build/package pass assessed
those merged bytes. Count-limited queue batches and uncertain-upload snapshot
protection are now verified; the older >100 queue-stall finding is superseded.
Byte-oversized batches remain a separate confirmed limit. #50 (Run offline and
dispatch regressions together) was ready, while #55
(Preview safe packet upload controls for FTOs) and #56 (Let coordinators release
packets for PO review) were active. Do not infer that their UI/release work is
included or accepted here. Columbus's final release owner must reconcile any
later merged tag against the final evidence hashes and rerun affected gates.
Task state alone is not source verification.

Related task plans were re-queried, not inferred from historical documents.
Draft tasks are **not remediation commitments or completed controls**. The
register maps to existing work rather than creating duplicate remediation tasks.

## 2. Current capability matrix

“Implemented” below means executable source or the stated synthetic test, not an
approved Columbus service. “Local” never means shared, delivered or backed up.

| Capability | Actual behavior | Central/agency acceptance boundary |
| --- | --- | --- |
| Sign-in | Clerk browser/session middleware exists; sign-up screen says invitation/verification unavailable | Agency SSO, employment, MFA assurance, activation and revocation policy not established |
| Daily drafts, runs, ratings, duty/orientation | Encrypted browser IndexedDB workspace; explicit local save and autosave; local previews/exports | No shared draft editor; no approved official-record storage |
| Local vault | AES-GCM; passphrase-derived PBKDF2 key held in memory; locking clears references/state | Not account identity, physical memory zeroization, key recovery, backup or device compliance |
| Account switch/sign-out | Source clears React Query and locks/reset workspace | Default vault namespace remains device-wide; same passphrase can open shared-device ciphertext; agency browser profiles needed |
| Shared phase requests | FTO submits/reads own requests; metadata-authorized Coordinator lists/reviews pending requests in DB | No per-class Coordinator query or verified PO assignment on submit; no delivery notice; local folder application remains distinct |
| Guarded packet upload | Explicit hook, signed agency claims, server roster, transactional snapshot/exact retry; count-limited 100-packet chunks and uncertain-upload protection | Disabled by default; no visible upload/shared-record UI; no byte-aware chunking, readiness validator, signature or correction workflow |
| Packet reads | Scoped query for assigned FTO/Coordinator; PO also needs server `released_to_po` | First 100 only; release workflow, historical reassignment and complete retrieval contract absent |
| Trusted signatures | Weekly UI disables signing; packet upload does not verify client signature fields | Typed names/local states are not identity-bound attestations; PO → FTO → Field Training Office sequence requires approved design |
| COC review | Explicitly unavailable queue; packet API recognizes only PO/FTO/Coordinator | No completed-packet command comment/export/return service |
| Roster, assignment, coverage, phase signup | Local workspace workflows/imports; do not provision the trusted packet roster | No supported agency roster administration/coverage/activation lifecycle demonstrated |
| FTO Sgt. and technical roles | Policy helper functions express narrow class assignment and distinct SGT/LT deletion approval | Helpers are not mounted enforcement; no production deletion workflow; no implied report/audit bypass |
| Statistics | Manual amounts plus versioned reviewed-run contributions; legacy values retained; descriptive ratings | Conflicting manual-only instructions require signed policy crosswalk; full correction history is not established |
| Monthly XLSX | Four tabs; reviewed non-Limbo rating counts; excludes raw incident/narrative data | More than four ranges fails explicitly; no approved operational overflow output |
| PDF/workbooks | Reconstructed portal layouts and local workbook generation, continuation/reference logic | Not filled originals or approved agency forms; office suite/printer and field completeness acceptance still required |
| Dispatch | Manual entry; explicit exact incident/unit lookup adapter, server allowlist and credential boundary | Optional live feed unconfigured/unverified; no inferred agency contract; outage must leave manual path usable |
| Secure-records service | Synthetic mock by default; live path requires server grant and configured upstream | No populated approved grant adapter; not a portal records backend |
| Resources | Fixed allowlist, Clerk-authenticated streamed attachments, successful responses no-store | Any signed-in account can access; agency material classification/access decision required |
| Notifications/chat/email | Chat drafts encrypted, separate local-only store; mailto opens external composer | No verified chat, delivery receipt, shared message history or automatic phase decision notices |
| Media/training documents | No approved secure upload/playback/retention service | Not centrally stored, assigned, delivered or legally held |
| Auditing | Packet commit/read events in DB transaction; request HMAC JSONL on stdout | External immutable retention not established; phase decisions lack equivalent event transaction; most route callers not attached as general audit principals |
| PWA/offline | Production emits/registers static service worker; excludes API paths and records | Offline login/cold start, expiry, reconnection, eviction and upgrades unverified on managed browsers |
| Synthetic staging | Isolated development service; agency release removes staged router | Not an operational record service or agency identity acceptance test |

## 3. Authorization and data-boundary accounting

Each endpoint must be judged independently. A strict helper elsewhere does not
protect a route that does not invoke it.

| Surface | Caller/scope in reviewed implementation | Revocation/activation limitation |
| --- | --- | --- |
| `/api/v1/training-packets{,/id,/sync,/sync-readiness}` | Verified session claim paths; only FTO uploads; active roster, exact FTO identity/badge, PO badge/class/phase/date; scoped reads and PO release | No explicit recent-MFA/online session-status check or separate PO/class Phase I activation; signed claims can outlive personnel changes; roster revocation is a distinct control |
| `/api/v1/phase-extension-requests{,/id/review}` | Clerk session; fresh backend publicMetadata role lookup; own-request FTO list; all-pending Coordinator list | Role removal is re-looked-up, but no per-class/PO trusted assignment gate; no common activation/revocation policy |
| `/api/v1/dispatch/{incident-lookup,event-ingress}` | Clerk session plus configured user-ID allowlist; browser supplies incident/unit | Allowlist removal checked each call; no roster/PO/date gate; IT must approve whether staff may request any incident/unit |
| `/api/v1/resources{,/id/download}` | Clerk authentication; fixed file allowlist | Employment, training assignment and agency role not checked |
| `/api/v1/secure-records` | Mock without operational data; live verified sign-in plus server grant, currently unpopulated | Live grant fails closed; no connected portal record view |
| Development mock login/audit/staging | Production mock login/audit disabled; staging graph removed by agency compiler | Synthetic smoke confirms selected exclusions, not a complete attack-surface/security review |
| Browser drafts/exports/chat | Vault passphrase + client role-preview workflow | No server authorization/audit of local reads/exports; fixed namespace; unlocked browser and exported files are separate data exposures |

Account activation must remain separate from authorization to train. An invited,
verified, MFA-enrolled but unassigned PO must not receive records. FTO Sgt.
assignment authority must not imply report access; COC reads/comments/exports must
be limited to completed/submitted scoped packets; technical staff must not gain
training access through maintenance privileges. Any deletion needs distinct
SGT/LT approvals for the exact request/record **and** records-owner legal-hold
checks. None is established merely by the existing helper's unit tests.

Data minimization protections include approved dispatch field selection, no caller
contacts/narratives/officer identities imported, no report API caching in the PWA,
formula-safe workbook strings, fixed resource paths, pseudonymized general
request logs and bounded input. Remaining exposures include local printed/exported
files, unlocked plaintext, packet pass-through fields, missing packet no-store
headers and different identity/audit adapters. Restrictive API Helmet headers do
not prove the separately hosted portal's CSP works with SSO.

## 4. Agency decisions and accountable owners

All statuses below are **OPEN**. Named positions are proposed accountable owners,
not evidence Columbus has appointed or approved them. Record name, decision,
date, policy/source version, evidence link and expiry/review date in agency records.
Do not send credentials in chat.

| Decision / required information | Accountable owner | Required written outcome |
| --- | --- | --- |
| Identity/SSO, stable identifiers, agency verification, MFA, session expiry/revocation and academy invitations | IT identity owner + security | Approved IdP/Clerk relationship, subject/badge mapping, department-email rules, separate activation events, 15-minute or approved assurance window and revoke/offline policy |
| Role/class/coverage/history permissions | FTO Coordinator + command + security | Capability table for PO, FTO, Office Admin/Coordinator, Sgt., COC, POLICENET and technical SGT/LT; class-wide versus assigned scope; dates and former-FTO access |
| Data classification and permitted synthetic/operational content | Records owner + security | Classification including narratives, badges, victim-sensitive training material and metadata; handling/export restrictions |
| Hosting, vendor/subprocessor, locality and network approval | IT architecture + procurement/security | Approved host/DB/object store/key service/SSO/log vendors, contracts, region, HTTPS origin, network boundaries, two-hop topology confirmation |
| Retention, legal holds and deletion | Records owner + legal | Retention schedule per record/version/audit/media/export; hold/release authority; two-person deletion cannot override hold |
| Records/public-records requests and discovery | Records custodian + legal | Authorized search/export, redaction, chain of custody and access auditing; first-100 list not acceptable as complete search |
| Statistics/checklist/NRT/Limbo/forms policy | Training policy owner + Coordinator | Signed conflict table below; accepted form mapping and semantic SEG crosswalk; no retroactive conversion without separate approval |
| Optional dispatch contract | Dispatch system owner + IT/security | Approved endpoint and field/time/unit semantics, grant scope, support/limits; separate decision to enable |
| Devices, browser, PWA and local unlock | Endpoint management + security | Approved OS/browser versions, separate managed profiles, disk encryption, patch/idle/offline limits, remote wipe, downloaded-file policy |
| Backup, recovery and migration | DBA + records owner + endpoint owner | Numerical RPO/RTO, approved key recovery, device-loss plan, encrypted DB/object/audit backup and verified isolated restore; separately approved local import |
| Audit and monitoring | Security operations + DBA | Runtime grant evidence, immutable collector, retention/query/access policy, time sync, alert routing, HMAC rotation migration |
| Incident response | IT/security incident commander + records owner | Lost-device, unauthorized access, corruption, disclosure and outage procedures; reporting timelines and contact roster |
| Support, patching and release | IT service owner + Coordinator | Named primary/backup/on-call contacts, supported hours, patch SLA, dependency/license review, rollback ownership and signed release authority |

### Policy conflicts requiring explicit disposition

| Topic | Conflicting material / current behavior | Decision required; preserve meanwhile |
| --- | --- | --- |
| Statistics | `replit.md` manual-only §4 versus `.replit-context.md` versioned multipliers and `run-activity`/monthly export behavior | Confirm applicable precedence/version; authorize overrides/correction history and explicit blank vs zero. Retain legacy amounts; do not recount |
| Rating selection | Manual/FTO evaluation language versus immediate checklist-to-UA and Officer Safety latch; user-confirmed semantic 30-category mapping | Training owner validates named-category crosswalk, review timing and allowed overrides; never infer numeric scores or rewrite historical ratings |
| NRT | Historical UA support versus exclusive current NRT choice | Approve required prior reviewed UA/training references and who receives review; local “notified” flags are not delivery evidence |
| Record scope | All-FTO class coverage wording versus assigned-FTO server roster and proposed API contract | Approve accepted substitute coverage and historical scope, then enforce consistent server rules; no browser-selector workaround |
| Forms and categories | Older 38 rows and conflicting .173/.174 identifiers versus confirmed 30 categories and portal Daily U-10.174 / Weekly U-10.173 / supplement U-10.174S | Approve current outputs and field-by-field original-form crosswalk; source copies keep original labels |
| Limbo and duration | Older manual Phase I two days versus newer full first week; 4/4/4/3 standard versus proposed changes | Record authoritative manual/addendum and effective cohort; Phase II two scheduled workdays, III/IV one under current registry; saved schedules stay snapshots |
| Four-tab month | Exactly four separate Sunday–Saturday tabs versus ordinary five/six-week months and extensions | Approve split/overflow workflow. Current explicit error is safe against omission, but not a completed monthly outcome |
| Citations/page sequence | Historical W#D#P# text versus current orientation/duty/run/continuation projection | Human reconfirms source references after layout/schedule changes; physical Page X of Y is not training-folder P |
| Completion/signature | Source review/ready workflow versus structural API accepting `draft` and permanently sealing v1 | Define completion, return/correction/release/signature states and approval authority; do not equate sync with submission or legal signature |

No policy choice was made by this assessment. Current user directions are recorded
as implementation context, not invented agency approval.

## 5. Verification and acceptance plan

### Executed here

- **Final merged-source pass: 47 API/security/adapter and 60 field/offline/calendar/
  workbook/print-markup tests passed: 107 distinct tests, none skipped.**
  Earlier baseline runs are historical, not additional distinct coverage.
  The merged-source checks verify 101 queued packets drain in two acknowledged
  batches; an aggregate body over 2 MB still receives 413 before DB writes.
- Full workspace typecheck, build, agency-release bundle and ZIP integrity passed.
- Rebuilt API booted outside the source layout **using borrowed workspace
  dependencies**, synthetic configuration, no database and no live identity.
  Seven HTTP checks matched expected statuses.
- A fresh extraction without installed dependencies failed as expected. Clean-host
  reproducible installation is **blocked**, not passed: archive has ranges and
  no release lockfile. No new dependency install/resolution was performed.
- A workspace license inventory was generated; it is **not a release SBOM,
  license/legal approval, current vulnerability audit or artifact attestation**.
- A disposable PostgreSQL 16 cluster, with no network listener and no connection
  to the application's configured databases, accepted the packet migration.
  A deliberately invalid audit event rolled back its synthetic packet/binding.
  An isolated dump/restore preserved fixture counts, narrative hash and explicitly
  supplied synthetic grants. This is not agency backup/restore or RPO/RTO acceptance.
- The attempted bounded browser/paperwork assessment returned no usable evidence
  and was stopped. A separate signed-out screenshot confirms the landing/sign-in
  renders, not authenticated workflows, physical PDFs, accessibility, or PWA behavior.

### Required synthetic UAT scenarios on Columbus staging

Use fictional identities in two classes, two FTOs, two POs, Coordinator, Sgt., COC
and distinct technical SGT/LT. Seed only an approved disposable database. Capture
request IDs, release hashes, expected/actual results, actor, timestamps and
screenshots; redact identity/session headers. Nothing below authorizes provisioning
or testing against production.

| Scenario | Measurable acceptance | Current status / evidence |
| --- | --- | --- |
| Activation, wrong role/class/PO, direct API bypass, revoked session, removed role, stale claims | Every disallowed call denied; no payload/audit disclosure; unassigned activated PO sees no training data; all allowed calls scoped | Partial unit/query contracts only; live SSO/directory absent |
| Trusted roster, future days, leave, reassignment and substitute FTO | Supported provisioning with audit; correct date bounds; overlap ambiguity denied; regular assignment retained; former/historical access follows approved rule | Roster SQL present; lifecycle and live DB drill unverified |
| Daily closeout → explicit sync → correction | Incomplete duty/run/review/required components rejected without sealing; reviewed ready packet acknowledged; correction retains old version and invalidates stale signatures | Current unfinished-draft and immutable-correction gaps reproduced |
| Lost response, duplicate operation, reordered batch and two writers | Exact retry returns same receipt once; changed digest conflicts; no lost edit; cross-tab/device conflict preserves both drafts | Exact retry/order/query rollback and local receipt tests pass; stale local overwrite reproduced; real DB races unverified |
| Partial batch/audit failure/timeout/oversize | All-or-none DB records/events/receipts; client keeps every unacknowledged draft; no false completion; bounded error | Client partial receipts tested; DB rollback command tested, actual transaction isolation not tested |
| Backlog/history | Upload 101 and 250 packets in bounded resumable batches, interrupt/resume; retrieve all authorized 250 exactly once with complete totals/cursors | Merged count batching drains 101 in two calls across vault reopen; byte-oversized batch rejects; limited history reproduced; 250 live DB scenario open |
| Boundaries and schedule | Overnight duty/run dates; both NY DST transitions including repeated 01:30 offset; Sunday/month/year/leap day; A/B/C two off-days; midwatch four workdays; leave/extension keeps approved history | Date/display/phase units pass; repeated local hour ambiguous; full shift/duration policy UAT open |
| Ratings/statistics | All 30 exact labels; no numerical score; reviewed/unreviewed, NO/A/RT/UA/NRT, NRT links, safety latch, N/A and Limbo verified; legacy data unchanged | Selected units pass; authorized policy acceptance open |
| Paperwork | Field-by-field original crosswalk; full narrative tail, checkboxes and signature warning; correct PO/class/phase/date; references match physical sheets; no blank/footer-only sheets | Markup/continuation units pass; browser evidence limited; original approval/agency printer open |
| XLSX | Open/save in approved Excel/LibreOffice; exact labels and cells; 0 vs blank, counts, literal `= + - @` strings; no raw incident fields in monthly output; all selected dates accounted | Workbook object tests pass; office-suite round trip/overflow policy open |
| Accessible field use | Complete representative report with keyboard, logical focus/labels and recoverable errors; screen reader announces save/failure; 200% zoom and touch do not hide actions | Browser pass did not produce evidence; screen reader/zoom/touch/managed-device UAT open |
| Poor connectivity / interrupted save / lock / account switch | Failure visible, no false “saved/sent”; exact draft retained after reopen; abort does not restore plaintext; signed-out/new account has no previous decrypted state | Storage/retry/lock units pass; authenticated online/offline journey unverified |
| Production PWA | HTTPS install → close browser/network off → cold start per approved auth policy; expired/revoked session handling; reconnect; upgrade N→N+1 and rollback without mixed assets or data loss | Worker build/registration confirmed; agency device and production-auth tests not run |

## 6. Installation, recovery and operating responsibilities

### Portable installation rehearsal and release prerequisites

Repeat local checks with:

```sh
pnpm install --frozen-lockfile
bash docs/launch-readiness/rehearse.sh
node docs/launch-readiness/portable-smoke.mjs
bash docs/launch-readiness/recovery-rehearsal.sh
```

Generated logs live under ignored `generated-artifacts/launch-readiness/`. The
rehearsal command regenerates build outputs and the API-only archive, not application
data. The recovery command creates and stops its own disposable synthetic
PostgreSQL cluster using Unix sockets only, never the configured application DB.
Preserve any previously approved release elsewhere before running packaging.
Passing characterization tests may document a defect; read their names.

On an **approved isolated agency host**, IT must rehearse the complete paired
portal/API release from Task #39 (Package the portal with the agency API):

1. Verify approved source tag and artifact SHA-256, locked dependency inventory,
   license notices and release SBOM. Install with the selected frozen lockfile
   and approved package mirror. No workspace node_modules symlink is acceptable.
2. Build public portal values for the approved origin/base path; configure
   SPA fallback and `/api` preservation. Root `pnpm start` starts only the API.
   Never distribute private environment values or workspace context snapshots.
3. Inject secrets through the agency secret manager; configure exact trusted
   proxy hops (two only if topology confirmed), CORS origins, HTTPS/cert chain,
   SSO proxy and the **static host's** CSP/security headers. Confirm login,
   assets, deep links, resources and no demo/staging endpoints.
4. DBA reviews **agency packet** SQL and the separate current phase-request
   schema/migration; identify the actual baseline before applying. Do not run the
   obsolete `database/migrations/001_field_training.sql` as an operational shortcut.
   Use separate migration/runtime/roster administration identities.
5. Prove runtime cannot own/alter schema or update/delete/truncate protected
   packets/events; test all direct/inherited grants and PUBLIC grants. Restore to
   a clean schema to rehearse rollback; do not invent a destructive down migration.
6. Provision fictional roster and signed identity mapping; test schema compatibility,
   failure responses, role removal, approved MFA/revocation, allowed/denied reads,
   packet lifecycle and history at scale. Verify DB commit/audit evidence, not only
   mock query text. Turn packet sync on only after approval; local saving never uploads.
7. IT records actual CPU/memory/disk/pool/timeout limits, expected peak capacity,
   certificate expiry, monitoring and on-call response. Pool max 4, packet 2 MB/
   100 batch, tree bounds and timeouts are source limits, not capacity assurance.
   No load test of agency infrastructure was authorized.
8. Stop/restart the service under the selected service manager; verify health,
   dependency readiness, in-flight behavior and exact retry. SIGTERM drain/
   failover, restart loop protection and session continuity require measurement.

### Backup/restore and device-loss drill

DBA + records owner must agree **numeric RPO and RTO before pilot**. No values
are invented here. Backups must include records, versions/receipts, assignments,
audit, approved object references, schema/grants, and recovery of necessary keys.
Encrypt and access-control backups independently of application credentials.

Use a dedicated synthetic recovery database and pre-reviewed fixture manifest:
take backup → simulate loss of that isolated database → restore to a new host →
apply verified compatible release → compare row counts **and content hashes** →
verify assignment/history/PO-release scope, receipts, audit integrity and legal
holds → replay a lost response exactly once → record measured data loss and elapsed
recovery against RPO/RTO. Re-test runtime grants after restore. Object and audit
stores need coordinated restore verification; files alone are not sufficient.

For a managed test device, separately simulate browser eviction, device loss and
forgotten passphrase. Current unsynchronized drafts have **no demonstrated recovery
path**. Do not promise restoration from account login or source snapshots.
Coordinator reconciles from approved paper/manual records and documents any
irrecoverable gap. Do not delete original local drafts to “fix” sync, clear site
data during rollback, share passphrases, or silently import every local workspace.
A future import requires inventory, owner review, identity mapping, preview,
explicit approval and committed receipts; chat remains excluded.

### Monitoring, rotation and support

| Owner | Minimum handoff responsibility |
| --- | --- |
| IT service owner / deputy | Complete build/install inventory; source and reproducible binaries; service manager, HTTPS, static/API routing, release rollback and dependency patch procedure |
| Identity/security operations | Approved assurance/revocation tests; audit ingestion alerts, access review, incident response and secret/certificate rotation |
| DBA / deputy | Migrations/grant evidence, roster administration support, retention/holds, capacity, backups, restore measurements and DB outage recovery |
| FTO Coordinator / backup | Training acceptance, roster/coverage accuracy, readiness/correction decisions, manual fallback and discrepancy reconciliation |
| Records custodian/legal | Authoritative forms/statistics, records requests, export handling, retention/legal holds and deletion approval |
| Dispatch owner | Optional feed contract, uptime/support/rate limits, allowed fields and manual-entry fallback |
| Endpoint/accessibility owner | Approved browser/PWA lifecycle, local draft risk, managed profiles/device-loss response and assistive-technology UAT |

Required alerts: dependency/schema probe failure despite healthz=200, elevated
401/403/409/5xx, packet backlog age/count, save/sync failures, audit collector
silence, DB pool exhaustion, disk/memory pressure, failed backups/restore checks,
certificate expiry and clock drift. Avoid sensitive bodies/identifiers in alerts.
HMAC rotation requires a coordinated identity/roster hash migration, not simply
replacing the environment value. Rehearse DB/IdP/dispatch credential rotation and
certificate renewal with scoped synthetic calls and a documented rollback.

## 7. Go/no-go, limited pilot and outage fallback

### Gate G0: this assessment

Complete when the dated baseline, test evidence, gaps and owners are recorded.
**G0 is not operational release approval.**

### Gate G1: synthetic-only pilot

- [ ] Named Coordinator, IT/security and records-owner sponsors approve the
  written scope: fictional records only; approved test devices/accounts.
- [ ] Identify exact source/build hashes and complete release layout; no moving
  implementation is represented as accepted.
- [ ] No operational imports/uploads, live dispatch, real media or notifications.
  Packet sync stays disabled unless isolated synthetic staging is explicitly approved.
- [ ] Teach local/unsent/signature/recovery limits and paper/manual fallback.
- [ ] Log UAT outcomes, including failures; no unresolved severe safety or data-loss
  defect is hidden by a green test count.

Proposed bounded pilot for approval: **two FTOs, two fictional POs in separate
test classes, one Coordinator, five test shifts**, including one overnight,
one simulated network failure and one recovery exercise. Include other roles as
test actors for negative access checks. This is a recommended scope, not an
authorization or real training schedule.

### Gate G2: any operational-record pilot

- [ ] All **production blocker** findings in the register closed with
  release-specific evidence; operational pilot does not bypass this gate.
- [ ] Signed role/activation/coverage/history, statistics/forms/Limbo and
  completion/signature/correction policies; no material unresolved conflict.
- [ ] Complete reproducible install on approved host; trusted proxy/CSP/SSO and
  direct-route bypass checks pass; reviewed schema/runtime grants verified.
- [ ] 101/250 backlog/history, cross-tab/device conflicts, failed/duplicate/reordered
  operations and transaction/audit rollback pass with no lost or falsely sealed data.
- [ ] Managed-device PWA/offline/lock/sign-out and accessible field UAT pass.
- [ ] Actual original-form field crosswalk, physical PDFs and agency XLSX/printer
  checks accepted; overflow-month outcome approved.
- [ ] Restore meets approved numeric RPO/RTO; device/key loss and local-unsynced
  risk explicitly accepted or remediated; immutable audit/hold/access controls tested.
- [ ] Incident/support contacts and patch/rotation procedures filled; optional
  dispatch either accepted separately or explicitly excluded with manual entry.
- [ ] Coordinator, IT/security and records owner each sign **GO**, record evidence
  identifiers, release hash, date, conditions and rollback authority.

### Gate G3: expansion

After the approved pilot: no unresolved critical/high findings; every pilot
packet reconciled against its authoritative source; no unexplained missing/
duplicate records or false delivery/signature status; monitoring and support
meet agreed service levels; all three owners authorize expansion. Any missing
signature/failed acceptance means **NO-GO**. Do not promise zero incidents or CJIS
approval from these gates.

### Critical-outage fallback and rollback

| Failure | Immediate safe fallback | Recovery / owner |
| --- | --- | --- |
| API/agency DB/network unavailable | Keep editable work local only on approved device; if local use is not approved, use approved paper/manual forms. Never call queued work submitted | IT/DBA restore; FTO reconciles each exact receipt before any re-entry; no blanket queue deletion |
| Local write/quota/vault failure or lost passphrase/device | Stop claiming saved; preserve device if possible; approved paper/manual continuity, report gap | Endpoint/security handles device; Coordinator/records owner reconstruct only from verified sources; no promised key recovery |
| IdP/SSO outage or revoked session | No bypass role or shared credential. Only approved offline-unlock window, otherwise paper/manual | Identity owner restores access; revoked users remain denied; re-auth before replay |
| Dispatch outage | Explicitly enter/verify incident facts manually; do not fill from another unit | Dispatch/IT restore adapter, preserve FTO corrections, test allowlist before enabling |
| PDF/XLSX unavailable/over-four-week block | Approved original paper/forms or approved manual workbook; track pending export and sources | Coordinator/records owner approves output and reconciles every date; no merging or omission workaround |
| Bad application/SW release | Halt new sync/edits where safety unclear; preserve local ciphertext/queue and committed versions; paper/manual | IT pins last known-good paired assets/API, verifies compatible schema and caches on test device; never blindly downgrade vault/schema or clear site storage |
| Suspected compromise or audit gap | Isolate affected service/device, revoke access per incident plan; preserve logs/records/holds; paper/manual | Security incident lead + records owner; restore only after evidence preservation and authorized reconciliation |

Before rollback, record current release and data/schema versions and take an
approved backup. Do not restore a database over newer committed records as an
application rollback. If schema/data are incompatible, stop and use the recovery
plan, not a guessed reverse migration. Resume only after integrity, scope,
duplicate-retry and source reconciliation checks and the same three signoffs.

**Signoff record (all blank / not granted):**

| Role | Name | GO / NO-GO | Release hash / evidence | Conditions | Date |
| --- | --- | --- | --- | --- | --- |
| FTO Coordinator | Not appointed | Not signed | Pending | Pending | — |
| IT/security release authority | Not appointed | Not signed | Pending | Pending | — |
| Records owner | Not appointed | Not signed | Pending | Pending | — |
