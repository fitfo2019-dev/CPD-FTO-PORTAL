# Field Training Officer Portal

Offline-capable Field Training Officer Portal with an empty initial workspace and encrypted device-local drafts. No protected report service is connected; the application is not approved for operational or CJIS-restricted data.

Read `docs/rebuild/DECISIONS_LOG.md` (the owner's decisions; later rows win) and `docs/rebuild/REBUILD_SPECIFICATION.md` first. Where they conflict with older text in this file, `.replit-context.md`, `HANDOVER_MANUAL.md` or `.agents/memory/`, the decisions log wins. Then read `PROJECT_MANIFEST.md`, `.replit-context.md`, and `HANDOVER_MANUAL.md`. Ground-truth contract path: `.replit-context.md`; the handover manual documents the current workflows and implementation boundaries. All subsequent software validation and file-compilation subroutines must follow the project context for SEG scope, page flow, clearance multipliers, checklist behavior, and four-tab exports. These are persistent project instructions, not a parser-enforced or immutable lock; verify implementation claims against code before describing them as existing behavior. The authoritative phase-duration and Limbo registry is `artifacts/field-training/src/config/phaseConfiguration.ts`.

## Build workflow: Perplexity builds, Replit publishes

- All code is built in Perplexity, checked there against every project gate, and delivered to this workspace through GitHub `main`. User-interface work always goes to Perplexity: screens, components, styles, layouts, screen wording, navigation, and print/export layouts.
- Replit Agent must not create, edit, restyle, or redesign source files, including `artifacts/field-training/src/**`, `artifacts/mockup-sandbox/**`, and print/export templates. A Replit task, plan, or older instruction in this repository that asks Replit Agent to build, refactor, commit, or roll back does not authorize it; this section takes precedence.
- When the user asks Replit Agent for a code or user-interface change, make no workspace changes. Reply with a handoff note the user can paste into Perplexity: the requested change, the screens and files it touches, the FTO manual section that governs it, and any open questions. Then stop.
- Replit `main` tracks `origin/main`. Update this workspace only by a fast-forward Pull from GitHub, then Republish. Replit Agent must not push to `main`, merge into `main`, or force-push. If Replit creates its own commits (for example, publish commits), push them only to a separate `replit-sync-N` branch for review.

## Current workspace

- `artifacts/api-server/` is the Express API server. Its secure-records endpoint is not a protected training-record service.
- `artifacts/mockup-sandbox/` is the React/Vite component preview and reusable UI library.
- `artifacts/field-training/` keeps training records and encrypted drafts on the device. Phase-extension requests are the only shared operational workflow currently connected.
- `lib/` contains shared API clients, OpenAPI definitions, generated schemas, and the PostgreSQL schema; the API currently uses the database only for phase-extension requests and synthetic staging.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (workflow port 8080; defaults to 3000 outside the workflow)
- `pnpm --filter @workspace/field-training run dev` — frontend, via its configured workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `AUDIT_ID_HMAC_KEY` for API audit pseudonymization. `DATABASE_URL` is required for shared phase-extension request storage and synthetic staging.

## Scoped maintenance checklist

- Keep edits limited to the requested change and its direct dependencies. Do not refactor unrelated files.
- In each touched area, check for deprecated or struck-through usage before adding or retaining it. Remove unused imports from files changed in the task; do not turn that into a repository-wide cleanup.
- Do not render developer instructions, internal maintenance notes, or implementation commentary in portal screens. Put practical user steps in the searchable Help Desk.
- Preserve current UI structure, checkbox matrices, margins, typography, colors, and field/input values unless a UI change is explicitly requested. Every requested UI change, including CSS-only text capitalization, is built in Perplexity on its own preview branch with screenshots and is merged to `main` only after the user's explicit approval. Never uppercase user-entered logs or transform form values.
- Before changing an allowlisted protected source/configuration file, run `pnpm snapshot:context`; prefer `pnpm context:write <allowlisted-target> <prepared-text-file>` when replacing one protected file so the snapshot precedes its atomic write. The tool snapshots only its explicit allowlist; it is not an OS-wide watcher or a database, upload, or whole-site backup. See `HANDOVER_MANUAL.md` for its confidentiality and transfer boundaries.
- Every code change is built and checked in Perplexity before it reaches `main`, using all seven gates in order: `pnpm run snapshot:context`, `pnpm typecheck`, `pnpm --filter @workspace/field-training run build` with zero warnings, `pnpm smoke:start` (opens the built portal in a headless browser and fails on a blank screen or start-up error), `pnpm test:field-training:regressions`, `pnpm test:maintenance-guardrails`, and `pnpm run bundle:production`. The agreed hard limit for `dist-production.zip` is 26,214,400 bytes (25 MiB); report the actual size. The release archive does not substitute for the portal build.
- For print/export changes, verify current form-source mapping, source references, checkbox states, narrative continuation, page margins, and physical page count. Describe portal outputs as reconstructed layouts unless they are verified filled copies of source PDFs; do not add unverified agency marks.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild API output in ESM format; Vite static output for the portal and component preview

## Where things live

See `docs/PROJECT_STRUCTURE.md`. Portable SQL is in `database/migrations/001_field_training.sql`; encrypted storage is `artifacts/field-training/src/lib/offlineStorage.ts`.

## Stakeholder briefing maintenance

- Keep `docs/COLUMBUS_FTO_PORTAL_BRIEFING.md` current as accepted changes land in the main workspace. Update it after material merges or main-workspace changes that affect product capabilities, user workflows, integration status, security/data boundaries, deployment readiness, or known gaps.
- Refresh its prepared date and evidence cutoff with each substantive update. Verify claims against current source and dated handover/test evidence; distinguish implemented behavior from planned work, synthetic tests, and City-dependent integrations.
- Continue this maintenance until the application is live in production and formally handed over to Columbus. Do not describe it as live, approved, certified, or connected to agency systems before that is verified.
- Keep `HANDOVER_MANUAL.md` as the technical operator/developer document; the briefing is the plain-language product and workflow explanation for the user's records and stakeholders.

## Architecture decisions

- The initial workspace contains no generated training records. Training reports remain device-local; phase-extension requests use authenticated API storage and require server-verified Clerk `publicMetadata.fieldreadyRole` values (`FTO` or `FTO_COORDINATOR`). Client role preview is not authorization.
- Never claim CJIS compliance from framework choice, encryption, or hosting provider alone.
- Preserve portability to standard government/on-premise PostgreSQL and self-hosted infrastructure.

## Product

Current application: dashboard, Daily Performance Log builder, training competencies, local-only signature status, passphrase vault, night-shift mode, and a configured PWA shell. Patrol View import, trusted signatures, protected report sync, and target-browser install/cold-start validation are not complete.

## User preferences

Use professional grammar and punctuation throughout the site. Before integrating
any requested website UI change, including copy or layout, show the user a preview
and get explicit approval.
Routine screens should show task information, actions, values, and actionable feedback—not repeated explanations or developer notes. Put practical application-use steps, expected results, and recovery guidance in the existing searchable Help Desk. Keep operational policy in its cited source library. Preserve role boundaries, truthful local/uploaded states, unsaved-work warnings, and irreversible-action confirmations; do not invent policy or support contacts. A task assignment is not UI approval.

Follow the current FTO manual and the workflow requirements below. Use the exact descriptive rating labels and SEG definitions; do not create numeric performance scores.

### Verified manual and Columbus geography

- Current portal export labels follow the user's latest direction: Daily Performance Log U-10.174, Weekly Performance Summary U-10.173, and Weekly Performance Log Supplement U-10.174S. The submitted manual conflicts internally on .173/.174 and the historical 2014 log sample prints U-10.174; preserve source-copy labels but use the current portal mapping for generated exports.
- The user's newer Weekly Performance Summary photograph supersedes the older manual index: use its 30 SEG categories only. Rating order: Not Observed (NO), Acceptable (A), Responding to Training (RT), Unacceptable (UA), Not Responding to Training (NRT). New daily ratings default to Acceptable at the user's explicit request, with human review before submission. Daily logs carry manually entered statistics; weekly and phase statistics are entered separately, not calculated from daily logs. The Weekly Performance Log Supplement consolidates reviewed UA articulations and retraining time, grouped by run category set as on manual page 42. Corrective-training minutes come from each run's UA box; there is no default, and the FTO can edit entries. Run checklist selections default checked at the user's explicit request, but require review and clearing any inapplicable or unacceptable item before marking the run complete. Use one run-save review prompt, not per-item confirmations. Do not rewrite existing saved evaluations. NRT is an exclusive current rating with links to earlier reviewed UA entries and corrective training, not simultaneous UA and NRT. Never invent numeric performance scores, averages, or rankings. All FTOs can access class records for temporary coverage; FTO Office Admin can also view/export classes. Substitute coverage creates a day without replacing the regular phase assignment. Role selection is not authorization.
- Weekly log exports use the paper-style CATEGORY / TOTAL TIME / narrative table and manual SEG number(s). Every corrective entry links to a daily source record and a verified training-folder reference. Use W#D#P# where P is the source page; never infer P. Require source-reference confirmation before PDF print. Printed Page X of Y numbering is separate from the training-folder reference. Preserve full narrative text on continuation pages and show an export preview.
- Use the 2025 Columbus Division of Police Annual Report for the current Zone-to-Precinct grouping. The current reference has six patrol zones and twenty precincts.
- Use the City of Columbus public Police Cruiser Districts and Police Precincts GIS datasets for the hierarchy and district codes. The cruiser-district dataset description is dated 2021, so label the local list as a reference snapshot and tell FTOs to confirm current assignment instructions.
- Preserve the hierarchy as Division → Zone → Precinct → Cruiser District. Assignment geography is not a run or incident location.
- Sources: [FTO Manual](attached_assets/FTO_MANUAL_(1)_1794984875252.pdf), [2025 Annual Report](https://www.columbus.gov/files/sharedassets/city/v/1/public-safety/police/reports/2025annualreport.pdf), [Cruiser Districts](https://opendata.columbus.gov/datasets/police-cruiser-districts/about), [Precincts](https://opendata.columbus.gov/datasets/police-precincts/about), [Organizational Structure](https://www.columbus.gov/Services/Public-Safety/Police/About-the-Columbus-Division-of-Police/Organizational-Structure).

## Academy Accounts and Training Access

- FTO ADMIN may create a pending PO account before Phase I. Send the activation link to the PO's department email. The PO verifies that account and sets their own password while at the academy; never use a badge number as a password.
- Require acceptance of the applicable account terms and completion of any MFA setup required by department policy.
- Keep account activation separate from training authorization. Until FTO ADMIN assigns the PO to a class and confirms the Phase I setup, the PO may access only account setup, password recovery, and security settings—not view or create training records.
- After class assignment and Phase I setup are confirmed, grant only the training access authorized for that PO. Enforce this on the server for every record request, not only by hiding pages in the UI.
- Record account activation and class/Phase I confirmation as separate audit events.
- FTO ADMIN may assign training documents to a PO, track completion, and review the submitted documents. Store these records only in approved protected storage.
- Provide a way for POs and their assigned FTOs to contact each other through the site. Offline chat may be saved only as an encrypted, device-local unsent draft outside the report sync queue. The author can delete drafts; never auto-upload them or save sent-message history or edits. A verified chat service is required before messages can reach another account.
- Acceptance checks: an activated but unassigned PO cannot access training records; a confirmed PO can access only authorized class records; activation and class confirmation produce separate audit entries; FTO ADMIN document assignment and PO completion are traceable; offline chat drafts remain local and unsent, can be deleted by their author, and never enter report sync.

## Workflow Goal: Enter Once, Use Everywhere

Design the application to reduce repeated typing, duplicate forms, and manual tallying. The FTO should enter each fact once; the app should use that saved information to prepare applicable daily forms, weekly summaries, packets, and exports.

Do not reduce workload by guessing, silently filling in facts, or using run data to recommend a performance rating. For new daily summaries, the user's explicit Acceptable default may preselect the rating, but it is not evidence and must remain unreviewed until the FTO confirms it. The FTO remains responsible for evaluating the PO against the manual’s SEGs, reviewing generated documents, and confirming information before submission.

### 1. Shift Start: One Setup, Reusable Header

Provide a guided **Start Shift** workflow. Confirm or enter:

- PO and class
- Assigned FTO
- Phase, week, and training day
- Date and shift
- Unit/cruiser number
- FTO assignment geography: Zone, Precinct, and Cruiser District
- Whether this is a Limbo Day

Use verified profile and assignment information to populate applicable form headers throughout that shift. Show the values before the shift begins and let the FTO correct permitted fields. Do not copy assignment geography into an incident’s location automatically.

Starting a shift should prepare the required daily forms as drafts—not mark them complete and not create evaluation ratings.

### 2. One Run Record: A Single Source for Related Forms

Make **Add Run** the central daily documentation action. Store a run once, with structured fields for incident and activity information required by approved forms. From that record, prepare the applicable checklist or supplemental form without asking the FTO to re-enter shared information.

Carry forward only verified information, such as:

- Incident number
- Date and times
- Run location
- Dispatched or reclassified call information
- Clearance code
- PO, FTO, phase, week, and day
- Unit number
- Explicitly recorded activity indicators

Let the FTO review and correct imported or copied fields. Clearly identify their source—for example, “from shift profile,” “entered by FTO,” or “imported and confirmed.”

If the FTO records a condition that may require another form, prompt them to add the relevant approved form. Do not silently attach forms or treat an unconfirmed suggestion as completed documentation. Use only triggers verified against the current forms and manual.

### 3. Capture Details in Context

Keep the FTO in a quick run-entry flow rather than making them navigate between many separate forms. Use:

- A compact run list for the shift
- Expandable sections for the approved checklist
- Large, auto-expanding narrative fields
- “Save draft” and clear saved/error indicators
- Keyboard-friendly controls and accessible touch targets
- Duplicate-run warnings based on incident number, date, and PO, with a way for the FTO to resolve legitimate duplicates

The app may save drafts automatically to the server, but must clearly show whether each change is saved. It must warn before leaving when a save has failed. Do not depend on browser storage for official records.

### 4. Separate Factual Activity from Evaluation

Keep these workflows distinct:

- **Activity documentation:** structured factual counts and run records.
- **Performance evaluation:** an FTO-selected descriptive rating using the exact manual rating labels and SEG definitions.

Manually enter every configured statistic at its applicable level. Do not calculate, infer, auto-populate, or silently change statistics from runs, checkboxes, narratives, forms, imports, other statistics, or supporting records. This includes daily, weekly, phase, class, run, goal-progress, and Solve Citation/Summons values. Provide an editable numeric field for each configured statistic; preserve explicit 0 separately from blank or missing. Optional calculated suggestions must be labeled, editable, and must never overwrite entered values. Preserve correction history (original value, corrected value, editor, timestamp, and reason) and audit who entered or changed each value. Keep daily, weekly, phase, class, run, and goal values separate; flag inconsistencies for review instead of correcting them automatically. FTOs may enter/correct only within authorized PO and shift scope; FTO Office Admin may correct within its scope; other roles may view or review only as authorized. Do not present unentered statistics as confirmed. Preserve verified 10-code defaults without using them to generate statistic values. Never use activity data to select or prefill performance ratings, and do not create numeric performance scores.

On a Limbo Day, continue to support run documentation and checklists, but do not create or record evaluation marks.

### 5. Daily Closeout: A Short Review Instead of Form Hunting

At shift end, present a single **Daily Closeout** checklist:

1. Review the shift’s run list and incident details.
2. Resolve missing required fields or duplicate warnings.
3. Review manually entered daily statistics and any flagged discrepancies; do not calculate totals from source records.
4. Complete the FTO’s manual-based evaluation where evaluation is allowed.
5. Add required supporting documentation and corrective-training details.
6. Record the FTO/PO discussion or review when required by the manual.
7. Mark the day’s packet components ready for weekly assembly.

Show missing, incomplete, and not-applicable items separately. Do not treat “no activity recorded” as equivalent to “form completed with zero activity.”

### 6. Weekly Packet: Assemble from Saved Daily Records

Create the weekly packet from completed source records rather than asking the FTO to retype daily information. Assemble the applicable:

- Daily Performance Logs · U-10.174
- Daily Activity Summaries · manually entered statistics
- Daily checklist forms and supplements
- Weekly Performance Summary · U-10.173
- Weekly Performance Log Supplement · U-10.174S, combining UA articulations, corrective training, and editable retraining time
- Weekly Comment/Signature Form
- Required additional documents

Keep manually entered daily, weekly, and phase statistics separate and do not calculate one level from another or derive values from runs/forms. Allow drill-through to supporting records for review; if a value conflicts with them, flag it without changing the entered value.

Generate a **packet readiness checklist** before export or submission. Identify missing or incomplete items, allow the FTO to open the relevant record directly, and preserve the manual’s applicable four-day Midwatch handling.

### 7. Review Before Export or Submission

Provide one preview that lets the FTO and PO review the compiled weekly packet in order. Make it easy to jump from a weekly total or deficiency entry to its source daily form.

Require human review and confirmation before export or submission. Preserve source records, exported version, reviewer, timestamp, and subsequent corrections in version history. Do not claim that a packet was sent, converted, or delivered to the FTO Office unless that integration exists and is authorized.

### 8. Useful Shortcuts Without Policy Guessing

Build configurable shortcuts that reduce clicks without changing policy, including:

- Reuse the confirmed shift header for applicable records that day.
- Copy shared incident facts into a newly added related form.
- Open the appropriate manual statistic field from a run; any optional calculated suggestion must be separately labeled, editable, and never committed unless an authorized user enters it.
- Open the next incomplete required section.
- Navigate from a report total to its source records.
- Flag a possible missing form based on an explicitly entered, verified trigger.
- Reuse a prior entry as a **draft template** only when the FTO confirms it; never copy old ratings or narratives as current-day facts.

Make shortcut behavior visible and undoable. Do not hide generated content from the FTO.

### 9. PDF and Excel Exports

Provide a preview and export workflow for:

**PDF**

- A readable, paginated weekly packet using the approved forms’ layout and required fields.
- Clear continuation pages when needed.
- The correct PO/class/phase/week identifiers.
- A cover or index only if approved by the department.
- Warnings for missing or unverified information.

**Excel-compatible workbook**

- Class roster and assignment information.
- Manually entered daily and run statistics.
- Manually entered weekly, phase, class, and goal-progress statistics, kept separate by level.
- Explicit zero, blank/missing status, and statistic correction audit history.
- Individual PO summaries.
- Reporting completeness and packet status.
- Supporting-record references for review; do not imply a value was calculated from those records.
- Export date, filters, and generating user.

Keep performance ratings as their exact descriptive labels in any spreadsheet. Do not create a rating score, average, or ranking. Restrict class-wide exports to authorized FTO Office roles, preview included data, and audit every export.

### 10. Streamlining Acceptance Tests

Verify that:

- A shared fact entered once is reused in applicable forms without repeated typing.
- The FTO can inspect and correct prefilled or imported information.
- Every configured statistic can be entered, saved, and corrected by an authorized user with a complete audit trail.
- Daily, weekly, phase, class, run, and goal-progress values remain separately entered; no automatic rollups or derivation from other data occur.
- Explicit zero is distinct from blank/missing, and unentered values are never shown as confirmed.
- Supporting-record inconsistencies are flagged without overwriting statistics.
- The app never assigns or suggests a performance rating based on activity.
- Limbo-day run and checklist workflows work while evaluations remain blocked.
- Daily closeout identifies missing forms without falsely treating zero activity as missing documentation.
- Weekly packets can be assembled from saved records and reviewed before export.
- PDF and Excel-compatible exports match the selected records and filters.
- Corrections preserve versions and audit history.
- Workflows use **Cruiser District**, never “beat,” and keep assignment geography separate from run location.

## Gotchas

Read `docs/SECURITY.md` before connecting real identity, sync or databases. SQL triggers/grants are supplied as portable source, not installed in a live database. Production PWA shell is generated by `pwa-plugin.ts`; development does not register a worker.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
