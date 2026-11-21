# Field Training Officer Portal

Offline-capable Field Training Officer Portal with an empty initial workspace and encrypted device-local drafts. No protected report service is connected; the application is not approved for operational or CJIS-restricted data.

Read `PROJECT_MANIFEST.md` before changing the codebase; it is the source of truth for the main application and its security boundaries.

## Current workspace

- `artifacts/api-server/` is the Express API server. Its secure-records endpoint is not a protected training-record service.
- `artifacts/mockup-sandbox/` is the React/Vite component preview and reusable UI library.
- `artifacts/field-training/` is the local-only Field Training Officer Portal; drafts are not shared or uploaded.
- `lib/` contains shared API clients, OpenAPI definitions, generated schemas, and an unconnected database foundation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/field-training run dev` — frontend, via its configured workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

See `docs/PROJECT_STRUCTURE.md`. Portable SQL is in `database/migrations/001_field_training.sql`; encrypted storage is `artifacts/field-training/src/lib/offlineStorage.ts`.

## Architecture decisions

- The initial workspace contains no generated training records. User-entered records remain device-local; no protected report backend or department identity integration is connected.
- Never claim CJIS compliance from framework choice, encryption, or hosting provider alone.
- Preserve portability to standard government/on-premise PostgreSQL and self-hosted infrastructure.

## Product

Current application: dashboard, Daily Performance Log builder, training competencies, local-only signature status, passphrase vault, night-shift mode, and a configured PWA shell. Patrol View import, trusted signatures, protected report sync, and target-browser install/cold-start validation are not complete.

## User preferences

Follow the current FTO manual and the workflow requirements below. Use the exact descriptive rating labels and SEG definitions; do not create numeric performance scores.

### Verified manual and Columbus geography

- Current portal export labels follow the user's latest direction: Daily Performance Log U-10.174, Weekly Performance Summary U-10.173, and Weekly Performance Log Supplement U-10.174S. The submitted manual conflicts internally on .173/.174 and the historical 2014 log sample prints U-10.174; preserve source-copy labels but use the current portal mapping for generated exports.
- The user's newer Weekly Performance Summary photograph supersedes the older manual index: use its 30 SEG categories only. Rating order: Not Observed (NO), Acceptable (A), Responding to Training (RT), Unacceptable (UA), Not Responding to Training (NRT). New daily ratings default to Acceptable at the user's explicit request, with human review before submission. Daily logs carry manually entered statistics; weekly and phase statistics are entered separately, not calculated from daily logs. The Weekly Performance Log Supplement consolidates reviewed UA articulations and retraining time, defaulting new retraining entries to 15 minutes while allowing FTO edits. Run checklist selections default checked at the user's explicit request, but require review and clearing any inapplicable or unacceptable item before marking the run complete. Use one run-save review prompt, not per-item confirmations. Do not rewrite existing saved evaluations. NRT is an exclusive current rating with links to earlier reviewed UA entries and corrective training, not simultaneous UA and NRT. Never invent numeric performance scores, averages, or rankings. All FTOs can access class records for temporary coverage; FTO Office Admin can also view/export classes. Substitute coverage creates a day without replacing the regular phase assignment. Role selection is not authorization.
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
