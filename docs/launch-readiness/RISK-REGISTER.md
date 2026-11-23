# Columbus launch risk register

Assessment: 2026-11-23. Read with [assessment](../COLUMBUS-LAUNCH-READINESS.md)
and [evidence](EVIDENCE.md). No finding below is marked remediated by this task.

**Classification:** B = production blocker (also blocks real-record pilot);
P = prerequisite for the defined pilot/feature; L = later improvement.
**Kinds:** D = confirmed implementation defect/gap; R = unverified operational
risk; A = missing agency information; Q = required policy decision; O = optional
integration. A source gap does not prove an exploit or actual incident.
Owners below are accountable positions to appoint, not assumed approvals.

## CR-01 — Unfinished records can become permanently sealed

- **Gate / kind / rationale:** B / D. Upload changes the available editing lifecycle;
  false completion and irreversible local seals are unacceptable for official records.
- **Evidence / status:** LR-01 receives 200 + `synchronized_complete` for a structurally
  valid `status:"draft"`, blank/unreviewed daily packet. `offlineStorage.ts`
  `saveWorkspace` queues every unsealed report; `workspace.tsx` `syncPackets`
  persists then uploads the whole pending queue. Router `completeReportStructure`
  checks types, not duty/run/ratings/source review or packet readiness. **Reproduced**
  with actual router + injected SQL client; no live DB used.
- **Trigger / impact:** FTO starts several shifts, finishes one, then explicitly
  syncs; unfinished days can be accepted and sealed too. Upload is not trusted
  signature, command submission or operational readiness.
- **Existing protection:** No visible sync button; explicit hook only, sync off by
  default; assigned-FTO gate and structural bounds; editor-dirty guard.
- **Owner / mitigation:** Application owner + Coordinator: define readiness and
  explicit selection/confirmation; validate completion server-side before sealing,
  preserve drafts on rejection. Obtain preview approval for any UI.
- **Related work:** #34 (Protect training records with agency role access);
  #38 (Finish checklist rules without losing saved records) is only partial checklist
  scope, not full submission lifecycle.
- **Acceptance:** Mixed ready/unready workspace; only explicitly selected ready
  records accepted. Direct API bypass of every missing requirement rejected;
  no readiness inferred from default checkmarks or empty activity.

## CR-02 — No accepted-packet correction/return/signature lifecycle

- **Gate / kind / rationale:** B / D. Training history needs truthful corrections,
  not forced deletion or untracked external workarounds.
- **Evidence / status:** Agency SQL enforces `server_version = 1`; store accepts only
  same operation ID/content digest; LR-02 changed content/operation returns 409.
  `workspace.tsx` prevents sealed edit/deletion. Weekly acknowledgement disables
  signatures; command-review page explicitly unavailable. **Source confirmed and
  retry/conflict reproduced**; trusted signature integrity unimplemented.
- **Trigger / impact:** Wrong date/narrative found after sync; PO/FTO cannot return,
  correct or re-sign a verified new version. Reordered object keys can also change
  JSON.stringify digest, so “exact retry” is not arbitrary semantic equivalence.
- **Existing protection:** No overwrite of accepted snapshot; PO release defaults
  false; upload does not manufacture signatures.
- **Owner / mitigation:** Coordinator + records owner + app owner: approve versioned
  correction/return/release, exact digest-bound signer sequence and retained originals.
- **Related work:** #34; #56 (Let coordinators release packets for PO review) is a
  draft covering release, acknowledgement and an amendment policy, not delivered functionality.
- **Acceptance:** Preserve original, authorize correction, audit reason/actor/version,
  invalidate stale attestations; COC sees only completed/submitted scoped versions;
  client signature fields never establish trust.

## CR-03 — Count batching corrected; byte-oversized batches cannot progress

- **Gate / kind / rationale:** B / D, narrowed after merged-source recheck. Offline work must drain
  without forced deletion; a permanent backlog is not usable recovery.
- **Evidence / status:** Final merged `syncPacketBatch` selects at most 100 entries.
  Updated LR-09 verifies 101 drain in two calls across vault reopen: **the original
  count-stall finding is superseded**. LR-14 verifies a 50-packet aggregate >2 MB
  receives 413 before DB calls. Selection has no byte budget/splitting path.
  **Byte-limit failure reproduced; count batching passed.**
- **Trigger / impact:** Fifty long narratives exceed 2 MB; retries select the same
  oversized batch. Uncertain-attempt protection preserves/locks the original
  snapshots but does not split the payload or permit editing those snapshots.
- **Existing protection:** Count-bounded batches; explicit failure; queue retained;
  attempted snapshots/operation IDs protected across restoration.
- **Owner / mitigation:** App owner: byte- and count-bounded resumable batches,
  stable operation IDs and committed-only acknowledgements; expose accurate progress.
- **Related work:** #34 related storage boundary; #50 (Run offline and dispatch
  regressions together) does not implement batching.
- **Acceptance:** 101 count-only case passed. Still require 250 mixed-size packets,
  byte-aware partitioning, lost response between batches, oversized individual
  packet and partial failure; eventual exact count, no false seal.

## CR-04 — Historical list silently stops at 100

- **Gate / kind / rationale:** B / D. Incomplete history cannot support official
  packet review, records requests or reconciliation.
- **Evidence / status:** Store `read` orders descending and `LIMIT 100`; route
  metadata uses returned length; schema max 100; no cursor/has-more/total count.
  LR-06 injects 101 histories and demonstrates returned 100 with ignored cursor.
  **Query/envelope contract reproduced, not live PG cardinality verification.**
- **Trigger / impact:** Authorized officer has 101+ records; oldest omitted,
  returned count can be mistaken for all history.
- **Existing protection:** Scope applied in SQL; packet-by-ID route exists for known IDs.
- **Owner / mitigation:** App/records owner: stable paging, completeness indicator,
  authorized total/search contract and audited export.
- **Related work:** #34 related read boundary; not covered by #39 packaging.
- **Acceptance:** Retrieve 250 across equal dates, inserts between pages and revoked
  scope; no omissions/duplicates; total not confused with page length.

## CR-05 — Different authorization models do not enforce one agency policy

- **Gate / kind / rationale:** B / D + A. Authentication is not training authorization.
- **Evidence / status:** `agencyIdentity.ts` supports PO/FTO/Coordinator signed claims;
  packet scope uses active roster. Phase routes use public metadata and
  `listPending()` without class restriction; FTO submit trusts target fields without
  roster check. Dispatch uses user allowlist; resources use sign-in only. Policy
  helpers in `authorization.ts` are not mounted to those routes.
  **Source confirmed; selected injected-role tests pass; real multi-account scope unverified.**
- **Trigger / impact:** Coordinator from another class lists/reviews pending
  requests; FTO submits for arbitrary PO/class; signed-in nonemployee downloads
  internal material. Claimed roles exceed implemented server capabilities.
- **Existing protection:** Signed session, backend-only metadata, trusted packet
  roster, fixed resources, dispatch allowlist and absent live grants.
- **Owner / mitigation:** Agency security + Coordinator + app owner: approve one
  action-specific role/assignment model and integrate it across routes.
- **Related work:** #34 primary; #35 (Connect the agency-approved dispatch feed)
  needs explicit access contract, not authorization-by-configuration alone.
- **Acceptance:** Cross-class, unassigned, inactive PO, substitute, former FTO,
  technical and direct API negative matrix on all routes; authorized cases succeed.

## CR-06 — Trusted roster operations and full role lifecycle are not established

- **Gate / kind / rationale:** B / D + A. Routine roster operation must not depend
  on browser assignments or ad hoc DBA edits.
- **Evidence / status:** Current store **creates packet bindings on upload** after
  exact active/date-bounded roster match; per-packet advance provisioning concern
  superseded. Agency SQL has assignments but no mounted provisioning/coverage/
  activation workflow. Only three packet roles. `authorization.ts` has narrower
  Sgt./COC and two-person deletion helpers, not live routes. **Source verified.**
- **Trigger / impact:** Substitute FTO, future phase, leave, reassignment or class
  activation has no supported central operation; deactivating old assignment also
  removes historical reads because query requires active assignment.
- **Existing protection:** Ambiguous/no roster matches fail 403; browser role/badges
  alone do not authorize; separate assignment and release authority intended.
- **Owner / mitigation:** Coordinator + identity/DBA + app owner: trusted audited
  provisioning, overlap rules, future windows and separate historical permission.
- **Related work:** #34 primary; #42/#43 date display/preview are local usability,
  not server roster provisioning.
- **Acceptance:** Provision/revoke/cover/reassign with fictional actors without DBA
  routine intervention; preserve regular assignment/history; activation distinct from
  sign-in; technical deletion requires distinct SGT/LT and no active hold.

## CR-07 — Session assurance, revocation and shared-device isolation need approval

- **Gate / kind / rationale:** B / R + A. Sensitive offline use needs explicit
  assurance and separation, not indefinite trust in cached claims.
- **Evidence / status:** Packet middleware sets diagnostic principal
  `mfaVerified:false`; it does not call strict `requireSession` or online status
  check. Do **not** interpret this as proof Clerk never revokes sessions. App clears
  cache/locks on account change but default vault namespace is fixed, with a
  separate passphrase rather than per-account key binding. **Source gap; agency
  token expiry/revocation and authenticated device switching not tested.**
- **Trigger / impact:** Personnel deactivated while old claims/offline key remain;
  shared browser/passphrase exposes prior user's ciphertext/workspace.
- **Existing protection:** Clerk verification; account-change purge; passphrase
  encryption and idle lock; active packet roster checked per request.
- **Owner / mitigation:** Identity/security + endpoint owner: define bounded offline
  access, assurance claims, revocation latency and per-user device/profile/key design.
- **Related work:** #34 related; none demonstrates managed-device acceptance.
- **Acceptance:** Expire/revoke session and remove roster/role independently;
  attempt replay after reconnect and switch two accounts on one device. Verify no
  decrypted prior data or authorized upload beyond approved policy.

## CR-08 — Packet cache-control and route identity audit gaps

- **Gate / kind / rationale:** B / D + R. Sensitive responses and attributable
  actions require explicit controls independent of service-worker behavior.
- **Evidence / status:** LR-01 packet success lacks Cache-Control; portable packet
  401 likewise absent. Packet read/router sets no `no-store`. Resources/phase/
  dispatch successful responses have it. General audit reads `res.locals.principal`;
  phase/dispatch/resources do not consistently populate it. **Source/header confirmed;
  no actual cross-user cache disclosure claimed.**
- **Trigger / impact:** Browser/proxy retains packet responses; audit action can be
  labeled ANONYMOUS despite route-level identity, hindering incident reconstruction.
- **Existing protection:** PWA excludes API requests; scope checked; request IDs and
  packet events record HMAC actor; phase DB retains requester/reviewer IDs.
- **Owner / mitigation:** App/security operations: no-store on every sensitive
  success/error; approved principal adapter; test proxy and browser cache behavior.
- **Related work:** #34; no complete cross-route audit acceptance verified.
- **Acceptance:** Inspect all role/error outcomes through agency proxy, then
  account-switch/back navigation; correlate verified pseudonymous actor/request IDs
  for access, review, denial and export without sensitive payload logging.

## CR-09 — Durable audit, least privilege and retention remain unverified

- **Gate / kind / rationale:** B / D + R + A. Audit availability and integrity
  cannot be inferred from comments or SQL transactions alone.
- **Evidence / status:** Packet store transaction includes READ/COMMIT event;
  LR-04 proves rollback **command**, not actual PG rollback. Migration grants are
  comments; agency packet events have no append-only triggers in this file.
  Phase store updates decision row without corresponding transactional event.
  General logs stdout only; no immutable sink/retention evidence. **Source confirmed;
  installed agency grants, external retention and API concurrency unverified.**
  The isolated SQL recovery rehearsal additionally proved actual PostgreSQL
  rollback after an event CHECK failure and restricted explicitly supplied
  synthetic grants; it did not establish agency runtime permissions.
- **Trigger / impact:** Excess runtime grant, log rotation or phase-decision
  change destroys evidence; inherited grants undermine comment-level restrictions.
- **Existing protection:** Parameterized SQL, packet transaction, HMAC identifiers;
  no runtime update/delete intended; broader legacy audit triggers are not evidence
  for this schema.
- **Owner / mitigation:** DBA + security + records owner: enforce nonowner runtime
  role, independent immutable collection, transactional phase history and holds.
- **Related work:** #34; #27 (Retain a review history for phase extensions) needs
  reassessment because server status rows exist, but append-only decision audit does not.
- **Acceptance:** Fail event insert and confirm no persisted mutation/receipt;
  prove runtime cannot alter/truncate/audit-delete; restore/search retained evidence;
  authorized administrators cannot silently erase independent copy.

## CR-10 — Unsynchronized work has no verified backup/recovery

- **Gate / kind / rationale:** B / D + A. Draft encryption/persistence is not
  recovery from device loss or forgotten keys.
- **Evidence / status:** Offline vault key never backed up; persistent-storage
  request best-effort; one browser workspace; source snapshots explicitly exclude
  records/DB. No approved RPO/RTO or agency restore evidence supplied. A disposable
  local SQL backup/restore preserved synthetic counts/hash/grants, not lost-device
  drafts. **Source confirmed; agency recovery unexecuted.**
- **Trigger / impact:** Lost device/passphrase, browser eviction, corrupt local
  store or wiped profile removes unsent work; account login cannot recover key.
- **Existing protection:** Atomic encrypted writes, visible errors, preserved queue
  on failures, persistent storage request.
- **Owner / mitigation:** Endpoint owner + DBA + records owner: approved recoverable
  key/backup design, measured restore and paper continuity; explicit local-data
  inventory/import approval, never automatic upload.
- **Related work:** #34 related shared storage does not replace unsynced-device recovery.
- **Acceptance:** Lost-device/passphrase/eviction and DB/object/audit restore drills;
  measured loss/time meet signed numerical RPO/RTO, verify restored content/scope/
  receipts/history and legal holds.

## CR-11 — Multiple browser instances can overwrite unsynchronized edits

- **Gate / kind / rationale:** B / D. Silent loss of daily work is unacceptable.
- **Evidence / status:** LR-13 opens two vault objects on same namespace; second
  stale workspace overwrites first's new unsynchronized narrative. `operations`
  serializes per instance, not all tabs; final merged guards protect synchronized
  or attempted snapshots, not never-attempted pending edits. **Reproduced with IndexedDB emulation**; not a browser
  race timing or two-network-device test.
- **Trigger / impact:** Two tabs/windows or shared-device sessions save older whole
  workspace snapshot; newer pending work/queue replaced.
- **Existing protection:** Atomic transaction and per-instance queue; sealed records
  protected; server accepted content conflicts rather than overwriting.
- **Owner / mitigation:** App owner: cross-instance revision/ownership conflict
  checks with preserved versions and explicit resolution; until fixed, single-tab
  instruction reduces risk but is not enforcement.
- **Related work:** #34 adjacent; no existing plan explicitly resolves local stale writes.
- **Acceptance:** Two stale tabs and two devices edit same/different reports, lock/
  save/sync interleavings; no silent loss, both candidate versions retained.

## CR-12 — Release completeness and dependency reproducibility

- **Gate / kind / rationale:** B / D. Columbus must receive the entire tested
  product and reproducible dependencies, not just one executable.
- **Evidence / status:** Prior and rebuilt archives contain migration now; no
  portal assets/source or lockfile. Generator copies runtime dependency ranges.
  Full build/bundle/integrity pass; extracted API without installed deps fails;
  borrowed-dependency boot succeeds. **Confirmed; clean-host install NOT passed.**
- **Trigger / impact:** ZIP alone has no website; future install resolves different
  versions; offline host lacks approved mirror/cache; migrations/source missing
  from an incomplete handoff process.
- **Existing protection:** Workspace pnpm lock, frozen install documented; ESM API
  output, resource/migration copying and staging marker rejection.
- **Owner / mitigation:** IT release owner: finish existing paired packaging plan,
  locked release dependency closure, source/tag hashes, notices/SBOM and approved
  mirror; use tested install, not workspace symlinks.
- **Related work:** #39 (Package the portal with the agency API) primary; reproducible
  dependency closure is an additional acceptance requirement, not a completed feature.
- **Acceptance:** Fresh approved host installs offline/from approved mirror using
  exact locked versions; portal deep link/login/API/resources/migrations succeed;
  hashes and dependency inventory match release.

## CR-13 — Health is not dependency/schema readiness or operational resilience

- **Gate / kind / rationale:** B / D + R + A. A green liveness result must not
  conceal unusable storage or auth dependencies.
- **Evidence / status:** `health.ts` returns constant success; LR-07 readiness
  returns can_sync based on store object without querying DB. API startup validates
  configuration presence only; packet pool max 4/timeouts bounded; index has fatal
  exit handlers, no explicit graceful SIGTERM drain. **Reproduced/source confirmed;
  live failover/rotation/alerting unverified.**
- **Trigger / impact:** DB/schema outage while traffic remains routed; restart kills
  in-flight requests; missing collector/backups/cert expiry goes unnoticed.
- **Existing protection:** Fail-secure missing configuration, input/transport
  timeouts and exact retry; structured sanitized fatal logging.
- **Owner / mitigation:** IT service/DBA/security operations: separate live
  dependency/schema readiness, redacted monitoring, agreed resource limits,
  controlled restart/failover, rotation and recovery procedures.
- **Related work:** #39 install context; no task establishes agency operations.
- **Acceptance:** Wrong schema, blocked DB, expired cert and disabled audit sink
  produce correct readiness/alert outcomes; controlled restart + replay shows no
  duplication or false completion, meets approved service objectives.

## CR-14 — Conflicting evaluation/statistics/access policy needs written resolution

- **Gate / kind / rationale:** B / Q. A build cannot decide authoritative training policy.
- **Evidence / status:** `replit.md` manual-only counts/FTO-selected evaluation/
  class-wide FTO access versus `.replit-context.md` versioned clearance counts,
  checklist-UA defaults and assigned roster. Remembered newer user directions
  explain prototype intent but are not agency approval. **Conflict confirmed.**
- **Trigger / impact:** FTO cannot lower derived counts through manual portion;
  inconsistent counts/ratings across forms or access expectations.
- **Existing protection:** Legacy counts retained; reviewed/new-version gates;
  descriptive categories; no numeric performance score; no silent policy rewrite here.
- **Owner / mitigation:** Training policy owner + Coordinator/records/security:
  approve conflict table in assessment with effective dates and correction rules.
- **Related work:** #37 (Let FTOs correct automatic daily totals), #38 checklist,
  #28 (Require formal approval before changing program lengths), #34 access.
- **Acceptance:** Signed examples for 1V/2V/3V/4V, citation separation, blank/zero,
  UA/NRT/safety/N/A/Limbo and coverage; legacy record hashes unchanged after migration.

## CR-15 — Ordinary months have no approved four-tab export outcome

- **Gate / kind / rationale:** P / D + Q. Blocks monthly reporting acceptance;
  if monthly export is mandatory for operational pilot, promote to B.
- **Evidence / status:** `monthly-export.test.ts` confirms five-/six-week months,
  >4 phase ranges and out-of-range records explicitly error; initial monthly
  task merged but safe fail-closed limit remains. **Reproduced in existing units.**
- **Trigger / impact:** November 2026 fifth range, August 2026 six ranges or extension
  prevents workbook; manual workaround risks omission.
- **Existing protection:** No silent week merge/drop; source records preserved.
- **Owner / mitigation:** Coordinator/records owner: approve split/overflow output,
  then implement without changing phase duration or historical counts.
- **Related work:** #17 (Choose how the workbook handles five-week months), merged;
  #39 is packaging only, not resolution of overflow policy.
- **Acceptance:** Each selected day appears exactly once in approved output and
  reconciles to source, including six-range month and approved extension.

## CR-16 — Forms, physical pages and signatures need agency acceptance

- **Gate / kind / rationale:** B / R + Q. Reconstructed output is not an approved
  original form or trusted signature merely because it prints.
- **Evidence / status:** `FTO-FORM-EXPORT-COVERAGE.md` lists originals/widgets and
  missing source-specific capture; print/continuation/workbook units test markup/
  objects. Current browser evidence in ledger is bounded; historical generated
  PDFs are not this release's acceptance. Conflicting 38/30 categories and form
  numbers remain source discrepancies. **Partial verification; agency acceptance open.**
- **Trigger / impact:** Long narrative, blank lines, footer overflow, omitted field,
  wrong reference or office-suite rendering creates incomplete paperwork.
- **Existing protection:** Continuation projection, reference review gates,
  signature-disabled notices and formula-safe text.
- **Owner / mitigation:** Records/training forms owner + endpoint/accessibility
  owner: approve field crosswalk and actual source/page order; physical print and
  office-suite round trip on agency equipment.
- **Related work:** #38 semantic checklist; #45 (Catch portal layout changes after
  stylesheet updates) can protect appearance but does not approve forms.
- **Acceptance:** All original field widgets mapped or explicitly waived; physical
  sheet count and final narrative tail verified; correct dates/identifiers and no
  phantom signature; keyboard/screen-reader/zoom/touch scenario accepted.

## CR-17 — Production offline authentication and upgrade behavior unverified

- **Gate / kind / rationale:** P / R. Required before field/offline use; promote
  to B for an offline-dependent operational pilot.
- **Evidence / status:** `pwa-plugin.ts` precaches shell, excludes API; `main.tsx`
  registers only in PROD. Worker activation deletes prior prefix caches and claims
  clients; navigation cache ties to shell. No managed-device authenticated offline/
  upgrade/rollback acceptance evidence. **Worker existence/build confirmed, device
  acceptance not run.**
- **Trigger / impact:** Cold start offline cannot establish session, old/new tabs
  load mismatched assets, rollback loses cached shell or user clears storage.
- **Existing protection:** Records not SW-cached; hashed bundles; local vault encryption.
- **Owner / mitigation:** Endpoint owner + identity/IT release owner: approved
  offline policy and measured install/reconnect/N→N+1/rollback matrix.
- **Related work:** #45 visual and #50 regression command partial only.
- **Acceptance:** Approved browser/OS, locked/unlocked/expired/revoked states,
  airplane mode cold start, interrupted upgrade and rollback preserve drafts without
  unauthorized access or misleading “synchronized” status.

## CR-18 — Local/unsent workflows must not be treated as delivered services

- **Gate / kind / rationale:** P / D + O. Missing optional service is not always a
  production blocker; relying on it as an official workflow is.
- **Evidence / status:** Weekly signature disabled, command review unavailable,
  local chat excluded from sync; roster/signup/coverage/doc/media workflows do
  not establish approved central delivery. Phase decision notifications absent.
  **Source confirmed.**
- **Trigger / impact:** Staff assume office/PO/COC received packet, media or notice;
  handoff obligations missed despite local status flag or mail composer.
- **Existing protection:** Local/unsent/disabled notices; separate chat store.
- **Owner / mitigation:** Coordinator + app owner: train accurate capability
  boundary, approved external delivery fallback and explicit confirmation; integrate
  only services actually required and separately approved.
- **Related work:** #40 (Notify FTOs when extension requests are reviewed),
  #41 (Let Coordinators explain denied extension requests); #34 shared records.
- **Acceptance:** Another account sees nothing until actual authorized delivery;
  offline unsent work never becomes “sent” on reconnect; no auto-uploaded chat/media.

## CR-19 — Dispatch is optional until contracted and independently verified

- **Gate / kind / rationale:** P for enabling feed / O + A; **not a blocker to a
  manual-entry-only pilot** with written exclusion.
- **Evidence / status:** Adapter normalizes exact incident/unit and approved
  fields; route checks Clerk + allowlist; selected integration/prefill tests pass.
  Agency endpoint/token/contract not verified; historical README adapter paragraph
  stale. **Synthetic-only verified; no live calls made.**
- **Trigger / impact:** Shared incident returns other unit times, unavailable feed
  or credential/allowlist mismatch; unreviewed prefill mistaken for authoritative fact.
- **Existing protection:** Manual editable fields, explicit lookup, no identity/caller/
  narrative imports, safe timeout errors and unique-form suggestions.
- **Owner / mitigation:** Dispatch owner + IT/security: approve contract/scope/
  semantics/support, protect server token, preserve FTO edits and retry UX.
- **Related work:** #35 connection and #36 (Let FTOs retry unavailable dispatch lookups).
- **Acceptance:** Approved nonproduction multi-unit event, ambiguous/no match,
  unavailable service and bad credential; exact unit only, no sensitive extras,
  no overwriting corrections, no inference of actions/ratings from code alone.

## CR-20 — Handoff statements and release evidence are inconsistent

- **Gate / kind / rationale:** P / D. Misdescribed capabilities can cause unsafe use
  even when code fails closed.
- **Evidence / status:** `.replit-context.md` older phase/local-only sections,
  `HANDOVER_MANUAL.md` older device-local approval sections, README DATABASE_URL/
  event-only adapter text and API_CONTRACT “only health mounted” conflict with current
  routes. **Source confirmed.** Current consolidated matrix in this assessment
  supersedes those historical capability claims for this reviewed baseline only.
- **Trigger / impact:** IT installs obsolete migration or assumes no DB backup is
  needed; FTO assumes local notice means central delivery.
- **Existing protection:** Newer top-of-file packet boundaries and explicit
  limitations; this dated assessment/evidence inventory.
- **Owner / mitigation:** Release/documentation owner: use this packet as review
  index, reconcile release docs after active changes settle; retire contradicted
  operational instructions, preserving historical source/policy provenance.
- **Related work:** #39 handoff packaging; #25–28 and #40–43 plans need current
  baseline recheck rather than assuming their historical descriptions remain true.
- **Acceptance:** Final source tag, package hashes, schema/install instructions
  and all capability claims agree; agency operators can distinguish draft, stored,
  submitted, signed and delivered without consulting conflicting sections.

## CR-21 — Repeated DST hour lacks unambiguous field evidence

- **Gate / kind / rationale:** P / R + Q. Important for overnight record accuracy;
  no incorrect elapsed-time calculation is asserted by this display-only test.
- **Evidence / status:** LR-11/12 pass calendar boundaries and demonstrate both
  `2026-11-01T05:30Z` and `06:30Z` display as local 01:30 without offset.
  **Display ambiguity reproduced**; end-to-end run entry/duration reconciliation
  and agency time semantics unverified.
- **Trigger / impact:** FTO documents a run during fall-back repeated hour; reviewer
  cannot distinguish instant from displayed local time alone.
- **Existing protection:** Stored ISO instants can distinguish times where supplied;
  calendar week calculations use UTC day arithmetic; spring-forward display skips 02:00.
- **Owner / mitigation:** Training/dispatch policy owner + app owner: define shift
  date versus event date and ambiguous/nonexistent local-time capture and display.
- **Related work:** #35 feed semantics; #26 (Keep saved daily logs aligned after
  Limbo changes) tests different schedule effects, not DST instant disambiguation.
- **Acceptance:** Overnight runs spanning both DST changes retain correct instant,
  offset and shift attribution; nonexistent time rejected or explicitly resolved;
  both 01:30 occurrences distinguishable in approved exports.

## Existing-task remediation map (no duplicate tasks created)

| Existing work | Finding coverage / remaining limitation |
| --- | --- |
| #34 Protect training records with agency role access | CR-01–09, CR-11 adjacent; merged source reconciled and retested, count batching/uncertain retry protection verified |
| #25 Prevent stale phase requests from appearing approved | CR-14/20; stale local target outcome still needs explicit check |
| #26 Keep saved daily logs aligned after Limbo changes | CR-14/21 partial; historical snapshots and encrypted restore |
| #27 Retain a review history for phase extensions | CR-09/20; reassess retained server status versus immutable decision history |
| #28 Require formal approval before changing program lengths | CR-14 policy approval |
| #35 Connect the agency-approved dispatch feed | CR-19, CR-05/21 access/time semantics |
| #36 Let FTOs retry unavailable dispatch lookups | CR-19 outage UX |
| #37 Let FTOs correct automatic daily totals | CR-14 auditable override |
| #38 Finish checklist rules without losing saved records | CR-01/14/16 partial, not complete packet lifecycle |
| #39 Package the portal with the agency API | CR-12/13/20 primary packaging; frozen runtime closure and clean-host acceptance still needed |
| #40 Notify FTOs when extension requests are reviewed | CR-18; notification not official packet delivery |
| #41 Let Coordinators explain denied extension requests | CR-18/20 decision explanation, not audit retention |
| #42 Show each recruit’s planned phase end date | CR-06/14 usability only |
| #43 Preview a recruit’s date changes before saving | CR-14/20 schedule review only |
| #45 Catch portal layout changes after stylesheet updates | CR-16/17 appearance only, not agency forms/device approval |
| #49 Catch portal type errors before they ship | CR-12 reproducible release gate partial; #47 checker work reported merged after assessment baseline |
| #50 Run offline and dispatch regressions together | Ready after baseline; test-command convenience, not acceptance of CR-03/10/11/17 |
| #55 Preview safe packet upload controls for FTOs | Active, preview awaiting approval; CR-01/18 backend readiness still required, not implied by a button |
| #56 Let coordinators release packets for PO review | Active, awaiting input; CR-02/05 release, acknowledgement and amendment policy not verified in this checkout |
| #53 Reopen saved orientation from every phase’s shift form | CR-16 navigation improvement, not forms/field acceptance |
| #54 Require a fresh review after orientation time corrections | CR-01/16 stale review metadata, not full packet readiness |

Missing agency controls remain owner decisions and release gates, not silently
expanded implementation tasks. Optional delivery/feed features remain optional
unless Columbus makes them part of the official workflow.
