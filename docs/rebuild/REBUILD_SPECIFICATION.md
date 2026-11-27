# FTO Portal Rebuild Specification

**Status:** Design-only. These are approved decisions for the rebuild. None of it is implemented yet unless a later entry in `HANDOVER_MANUAL.md` records the build and its verification.
**Decided:** November 25, 2026, in the FTO Office rebuild question sets 1 to 10.
**Applies to:** the whole Field Training Officer Portal. The goal and the workflows stay the same; the user interface and the amount of FTO paperwork time are what change.
**UI approval rule:** a change to the user interface needs a preview approved by the project owner before it is integrated.

## 1. Sources and precedence

When sources disagree, the higher item wins:

1. The project owner's recorded decisions (this document and `docs/rebuild/DECISIONS_LOG.md`).
2. The 2026 FTO Manual (`Final-FTO-Manual-updated-3-10-26.docx`), for program rules.
3. The original FTO Office Excel workbook (photo reference `Original-Excel-Weekly-Summary-Photo.jpg`), for workbook layout, tabs and checks.
4. The current portal source, for anything not covered above.

Where the owner chose to differ from the manual, the decision is marked **Owner decision** and the manual rule is quoted.

## 2. Non-negotiable guardrails (carried forward unchanged)

- **No UI text leakage.** No instruction summaries, rule text or developer comments on any screen. All rules run silently in background TypeScript hooks. Alerts show data only (for example "W2D4 not submitted"), never the rule behind them.
- **Casing.** The shell (frames, sidebar links, tabs and buttons such as FINALIZE AND SUBMIT TO COORDINATOR and SAVE LOCAL DRAFT) uses `text-transform: uppercase`. Raw data (names, narratives, dispatch pre-fills, charges) is never uppercased.
- **Two-stage submission.** Background saves and sync write `local_draft_pending`, hidden from the Coordinator. Only the FTO's FINALIZE AND SUBMIT TO COORDINATOR click sets `submitted_complete`.
- **Forms.** Every exported form is exactly one US Letter page. The three landscape performance forms stay landscape; the rest stay portrait. The City of Columbus wordmark goes upper left, the color patch upper right and the silver badge lower left, with 0.5-inch margins. A narrative that does not fit continues on a numbered addition page, which is also one page within the margins.
- **Engineering gates.** Snapshot to `local-history-snapshots/` before writes. Then run `pnpm typecheck`, then `pnpm --filter @workspace/field-training run build` with zero warnings, then `pnpm run bundle:production`, which fails above 26,214,400 bytes. Zod 4.6.7 and the pnpm workspace baseline. Remove dead imports and replace deprecated code rather than deleting it.

## 3. Roles, sign-in and layout

| Topic | Decision |
| --- | --- |
| Roles | FTO, FTO Coordinator, Probationary Officer (PO), PoliceNet technical. FTO Sergeant and Chain of Command pages are deferred (see Open items for Sergeant alerts). |
| Sign-in | Built for City SSO. Invitation accounts are for testing only until City IT configures SSO. |
| Navigation | Left sticky sidebar, with each tab its own page and no single long scrolling page. Phones get a collapsible menu. |
| Devices | The cruiser laptop is the primary design target. A working single-column phone layout is also provided. |
| Data location | Hybrid. Rosters, phases, assignments, sign-ups, extensions and packets live on the server. Daily drafts save on the device as `local_draft_pending` and sync. |

## 4. Enter once, reuse everywhere

- The FTO never types their own name, badge number, precinct, watch or assignment on any paperwork. These come from Account Settings, and a change there applies going forward only. Submitted packets stay frozen.
- PO name and badge come from the PO's own account (Academy self-registration). POs have no assignment, so no assignment field is required. The Coordinator links the PO to an FTO in Phase Setup.
- Every form header is auto-filled and locked: PO, FTO, badges, class, phase, Phase Week #, FTO Week # and date. Corrections are made at the source and flow to unsubmitted forms.
- Workdays and days off are set once on the FTO profile, and the PO follows the FTO's schedule. The Coordinator can view and override it.
- The cruiser number is entered each shift, with the last-used number suggested. It is kept separate from the dispatch unit.
- Coverage days: the covering FTO drafts and their name, badge and assignment appear on that day's headers. The regular FTO finishes and finalizes on return, and the handoff is recorded in the packet history.
- Personal saved phrases live in Account Settings. They insert with one tap, keep their exact case and can be edited after insertion.

## 5. Start of shift

1. **Substation Orientation (U-10.181)** is added automatically as P1 on W1D1 of every phase, because the PO is at a new substation. Items start checked and the FTO taps exceptions. Runs can start right away, but the packet cannot be finalized until orientation is complete.
2. **Reporting for Duty (U-10.191)** is P1 every other day, and P2 on W1D1. Items start checked and the FTO taps exceptions, then confirms the review once. Shift start and end times are pre-filled from the FTO's watch and can be edited.
3. **Previous-tour UA review.** The manual requires the FTO and PO to review the previous tour's UA ratings by the beginning of the next shift. This is a required start-of-shift item the FTO taps to record.
4. **PO not working.** For a scheduled day the PO did not work, the FTO picks a reason: Sick, Court, Leave / holiday, or Training / in-service. The FTO then chooses either to create that day's Reporting for Duty page with the reason in the Appearance/Equipment narrative, or to mark the day only. For Training and Court, the FTO adds the type and hours, for example "PO attended DTU In-service training from 2p-10p." Either way the day is excused from the weekly day-count check.
   - Manual: "There must be a Reporting for Duty for each day to account for the PO's whereabouts and/or the reason PO was not present."

## 6. Runs

| Topic | Decision |
| --- | --- |
| Quick capture | Add Run takes 3 taps and saves the incident number and run type. Checklists and narrative can be finished later. Finalize is blocked until every run is complete. |
| Dispatch pre-fill | A PatrolView lookup by incident number fills times, location, unit and dispositions. Every field stays editable, FTO edits are preserved, and manual entry remains available. Requires City IT approval. |
| Run type | Pre-selected where the dispatch code maps to one form (17 codes to Domestic, 4 to Crash), and the FTO confirms with one tap. For the 6 ambiguous codes the FTO must choose. |
| Supplements | Attached automatically from run answers (Arrest Made adds Arrest Process, OVI Processed adds OVI Process). Removed cleanly when the answer is unmarked. Each supplement has its own page number directly after its run. |
| Dictation | Device dictation only. Narrative boxes are large and dictation-friendly. The shortcut tip appears only in Help Desk. |
| Phase-goal tags | A run can be tagged On-View Criminal Arrest with Slate, Suspension Packet or High-Solvability Misdemeanor Investigation. Tags feed the phase-goal tracker only and never appear in the printed activity summary. |

## 7. Run checklists and the write-once narrative

### Unchecking an item

The FTO picks one of three reasons:

- **Not Acceptable.** Creates a UA in the item's category.
- **FTO Performed.** Recorded on the checklist only. No sentence is added to the narrative and the ratings are not affected.
- The choice is made in one dialog per unchecked box. A box that combines several tasks lists each task with its own choice, plus "All of these".
- **Not Applicable.** No effect.

One tap on a section header marks the whole section Not Applicable.

### Automatic deficiency sentences

- Every item has a pre-written "PO failed to..." sentence, for example "PO failed to shut the car door silently." The sentence library must be drafted and approved by the project owner before build.
- Unchecking an item as Not Acceptable inserts its sentence into the run narrative automatically, in checklist order (which follows the call), and the FTO can edit it in place.

### Written once

- The UA narrative is written once, in the run narrative, as the manual requires. Call for Service #11 makes it mandatory to state the unacceptable performance and the corrective training there.
- For each deficient category on the run, the FTO completes:
  1. what the PO did that was deficient (seeded by the automatic sentences),
  2. any important context,
  3. how the FTO corrected the deficiency or trained the PO,
  4. the minutes spent on corrective training.
- The daily rating row and the Weekly Performance Log entry fill in from this text automatically, so nothing is typed twice. Minutes captured here mean nothing has to be re-entered on the weekly.
- A narrative that is too long for its page continues on a Narrative Addition page, printed as the next page number within the margins.
- This replaces the earlier "write per category on the rating row" decision.

### Daily packet flow and time savers (preview, Nov 27, 2026)

- Stages: Start Shift (shift details and Reporting for Duty), Runs, Finish and Submit (activity summary, Daily Ratings, shift narrative). Old links to the five earlier steps open the matching stage.
- Start time defaults from the assignment (lib/shift-start-times.ts) and stays editable.
- Daily Ratings: Acceptable unless a box is unchecked; the 8 default Not Observed categories stay Not Observed; Not Applicable counts as Not Observed.
- Run UA box: tap-to-insert corrective training phrases (lib/corrective-training-phrases.ts) appear only when tapped and stay editable. Locked chips open Change UA category.
- Weekly Performance Log: 3 or more Responding to Training ratings in one category in a week draft an entry with W#D#P# references and blank minutes; FTO edits are kept.
- Patrol View mapper (lib/patrol-view-incident.ts): no screen; API pending.
- Server totals (api-server packet-po-totals.ts) count Not Applicable as Not Observed and mirror UA counting.

### The run UA box (preview, Nov 27, 2026)

- Each run has one UA box on its Narrative and Save step. It lists every UA category on the run: the categories from unchecked boxes (locked) and any category the FTO adds (removable until Finalize).
- The box holds what happened (the "PO failed to..." sentences, editable, plus the FTO's own additions), the corrective training, and the total corrective-training minutes for the run (5, 10, 15, 20, 30 or Other). Minutes have no default; the FTO must choose them.
- For each category, the box offers "Same issue as" the latest earlier UA in that category for this PO and phase, including an earlier run the same day, even while the current run is still being entered. The link feeds the NRT recommendation (PO-NRT-1).
- The box text is appended under the run narrative, so it is written once.

### Abbreviations

The manual allows only "FTO" and "PO". At Finalize, the portal quietly underlines likely abbreviations and offers the full word with one tap. The FTO can keep the original wording. No rule text is shown.

## 8. Page numbers and the W#D#P# tag

- **Format:** W#D#P#, for example W3D5P10, following the manual's Weekly Log example.
  - **W#** is the FTO Week #, the week within the phase.
  - **D#** is the worked day within that week: D1 to D5, or D1 to D4 on Midwatch, restarting each week.
  - **P#** is the page in that day's packet.
- **Page order:**
  - On a normal day, P1 is Reporting for Duty, then the runs in run order, each followed by its supplements.
  - On W1D1 of each phase, P1 is Substation Orientation, P2 is Reporting for Duty, and runs start at P3.
  - Narrative Addition pages take the next number after the page they continue.
  - The Daily Performance Log has no page number.
- Page numbers lock at Finalize.

## 9. Daily ratings

### The 30 categories (owner decision: keep 30, not the manual's 38)

The numbering and order match the original workbook and the current `SEG_CATEGORIES`.

| # | Category | Group | Starts at | RT allowed |
| --- | --- | --- | --- | --- |
| 1 | Report/Prepared for Duty | Duty Readiness | A | No (strict) |
| 2 | Comprehension/Usage | Communications/Computer | A | Yes |
| 3 | Public/Police Interaction | Interpersonal Skills | A | Yes |
| 4 | Feedback Acceptance | Interpersonal Skills | A | Yes |
| 5 | Precinct Orientation | Geographic Skills | A | Yes |
| 6 | Routine | Driving Skills | A | No (strict) |
| 7 | EVO | Driving Skills | NO | No (strict) |
| 8 | Policies/Procedures | Knowledge | A | Yes |
| 9 | Criminal/Traffic Offenses | Knowledge | A | Yes |
| 10 | Arrest, Search, Seizure | Knowledge | A | Yes |
| 11 | Information Gathering | Knowledge | A | Yes |
| 12 | Resource/Equipment Usage | Knowledge | A | Yes |
| 13 | Form Usage | Official Report | A | Yes |
| 14 | Grammar/Legibility | Official Report | A | Yes |
| 15 | Content Accuracy | Official Report | A | Yes |
| 16 | Completion Time | Official Report | A | Yes |
| 17 | Response to Enforcement | Engagement | A | Yes |
| 18 | Threat Assessment | Officer Safety | A | No (strict) |
| 19 | Initiating Arrests | Officer Safety | NO | No (strict) |
| 20 | Handling Prisoners | Officer Safety | NO | No (strict) |
| 21 | Vehicle Stops | Officer Safety | NO | No (strict) |
| 22 | Run Approach | Officer Safety | A | No (strict) |
| 23 | Building Search | Officer Safety | NO | No (strict) |
| 24 | Pat Down/Searches | Officer Safety | NO | No (strict) |
| 25 | Low Stress Situations | Judgment Decisions | A | Yes |
| 26 | High Stress Situations | Judgment Decisions | NO | Yes |
| 27 | Arrest Situations | Judgment Decisions | NO | Yes |
| 28 | Problem Solving | Judgment Decisions | A | Yes |
| 29 | Motivational Traits | Judgment Decisions | A | Yes |
| 30 | Task Management | Judgment Decisions | A | Yes |

The rating codes are NO (Not Observed), A (Acceptable), RT (Responding to Training), UA (Unacceptable) and NRT (Not Responding to Training). NRT is always recorded together with UA.

### How a day's ratings are set

1. Every row starts at its default from the table above.
2. A row is overridden when a run today suggests UA or RT, or when RT carries over from an earlier UA. An acceptable run in a category that defaults to NO moves it to A.
3. The daily rating is the lowest result of the day. The manual allows one rating per category per day, and in Officer Safety failing any listed practice "will result in an unacceptable performance rating for the day."
4. The FTO reviews the rows, can override any suggestion with a reason, and taps CONFIRM RATINGS.

### RT progression (categories where RT is allowed)

- After a UA in a category, the 1st and 2nd acceptable performances are RT, and the 3rd returns to A.
- Each run counts, so the progression can advance more than once in a shift.
- A new UA while the PO is in RT restarts the progression: two more RTs, then A.
- The count resets at the start of each phase.
- When the portal changes an A to RT, the FTO sees a data-only alert on that row and again at CONFIRM RATINGS, for example: "Vehicle Stops: RT · UA on Mon, Nov 23 (Run 1, Traffic Stop) · Acceptable 1 of 2." Only the FTO sees these alerts.

### Strict categories (1, 6-7, 18-24)

- These ratings are A, UA or NRT only, and the category must be acceptable.
- Anything else is a UA with the FTO's documentation.
- There is no RT, so the next acceptable performance is A.
- UAs still count toward the NRT review.
- This follows the hatched RT cells in the original workbook and the manual's SEGs, which have no "Responding" level for Driving or Officer Safety.

### NRT review

- **Trigger:** the 3rd UA in the same category within the same phase opens an NRT review on that row, even with acceptables between the UAs.
- **Pre-fill:** the three UAs, their narratives, the corrective training and the minutes.
- **FTO decision:** the FTO confirms NRT, as the manual requires ("The FTO reviews prior documentation and decides").
- **After confirmation:**
  - The Coordinators and the FTO Sergeant are alerted automatically.
  - A meeting is suggested with the FTO, PO, Coordinators, FTO Sergeant and precinct sergeant.

### Limbo

- Limbo days fall at the start of each phase:
  - Phase I: all of week 1.
  - Phase II: days 1-2 of week 5.
  - Phase III: day 1 of week 9.
  - Phase IV: day 1 of week 13.
- Checklists are still completed, but no ratings are entered.
- The portal writes "Limbo Period – PO not evaluated" in the FTO comment automatically.
- **Marking (owner decision):** a limbo day shows a hatched grey banner "Limbo Period – PO not evaluated", a "Limbo Day 1 of 2" chip, and "LIMBO · NOT RATED" on every category row. Ratings are locked, and the comment line is auto-filled and locked. The Daily Activity Summary and checklists stay open.
- **Unlock (owner decision: "uneditable without multiple layers asking why"):**
  1. The FTO clicks REQUEST RATING UNLOCK, picks a reason and writes at least 25 characters. Reasons: Directed by FTO Coordinator; Phase start date entered wrong; Critical safety incident that must be documented; Other.
  2. The FTO reviews a summary and types UNLOCK to send it. The day shows "Unlock Pending Coordinator".
  3. The FTO Coordinator approves or denies, with a required note.
  - An approved day shows an amber "Limbo override" banner and an orange border on the ratings, and keeps an unlock record (reason, explanation, who approved, when, note). Every step is logged in the packet history.

## 10. Daily activity summary (owner decision: original workbook list exactly)

There are 27 rows in four columns, counted automatically from completed runs and editable. The FTO adds only activity that was not a logged run.

| Column 1 | Column 2 | Column 3 | Column 4 |
| --- | --- | --- | --- |
| PremierOne Reports | Traffic Stops | Misdemeanor Summons | Prisoners Slated |
| F.I. Reports | Traffic Citations | Misdemeanor Arrests | Suspicious Person/Stops |
| Accident Reports | Parking Citations | Felony Packet/Direct Ind. | Prisoner Searches |
| Impound Slips | First Responder Letters | Felony Arrests | Pat Downs |
| Probable Cause Affidavit | U-10.100 | D.V. Charges/Arrest | Attempted/Warrants Served |
| Property Slips | Criminal Complaints | OVI Process | EVO |
| Summons Re-Issued | Use of Force/Taser Firearm Display | Vehicle Extractions | |

The workbook listed "Summons Re-Issued" twice, so it appears once here. Solve Citation/Summons, Arrest Process Forms and Completed Payouts are removed from the activity totals. The Arrest Process supplement form itself is unchanged.

## 11. Finalizing the daily packet

- FINALIZE AND SUBMIT TO COORDINATOR is blocked until all of the following are true:
  - every run is complete,
  - Substation Orientation is complete (on W1D1),
  - the ratings are confirmed,
  - the previous-tour UA review is recorded.
- **PO comments:** the PO can type on the FTO laptop or use their own account.
  - The FTO can finalize without a PO comment.
  - The PO can add one until that week's packet is signed.
  - Comments are stamped with the date and time, and the FTO's content never changes.
- **After Finalize:** the daily is `submitted_complete` and appears in the Coordinator's view right away.

## 12. Weekly packet

**Contents (manual):**

- Weekly Performance Summary
- Weekly Performance Log, with Addition pages as needed (1 of N)
- a Daily Performance Summary for each day
- the Weekly Packet Acknowledgement (Comment and Signature)
- the daily checklist forms and supplemental checklist forms
- any additional supplements

| Topic | Decision |
| --- | --- |
| Weekly Performance Summary | Totals the daily ratings and activity automatically. The header has Phase, Phase Week # (of 15), FTO Week # and "Week of", all auto-filled and locked. |
| Weekly Performance Log | Auto-drafted from reviewed daily logs, grouped like manual page 42: one entry per run category set (for example "5, 6/17/24, 25"), with the W#D#P# tag, the deficiency and corrective training, and that run's total minutes. Same-day runs with the same category share one entry. A UA that is documented but not counted gets its own entry marked "Not counted" with the reason. No default minutes. Strengths are suggested from categories rated A all week. The FTO edits and adds a brief overall comment. Per the manual, the Weekly Log date is the Sunday of that training week. |
| Day-count check | Replaces the workbook's fixed 4 or 5 "!" check. Expected days = the PO's scheduled days, minus Limbo days, minus days marked PO not working. Coverage-day dailies count toward the regular FTO's week. A red "!" shows on a category row only when a scheduled rated day has no finalized daily, and hovering shows the missing day (e.g. "W2D4 not submitted"). The weekly cannot go to the PO for signature until no "!" remains. |
| PO review and signature | On the FTO laptop or in the PO's own account. The packet cannot go to the Coordinator until the PO signs, because the manual requires the PO to review before upload. |
| Deadline | Due 3 days after the workweek ends (manual). The FTO home page shows the due date, with a notice on day 2. On day 4 the Coordinator's Packet Monitor shows the packet as overdue. |

### Week 15 recommendation (must mirror the manual exactly)

The Phase IV FTO must choose one of the following statements in the "Field Training Officer Comments" section of the Week 15 Weekly Packet Acknowledgement. They are reproduced word for word. The blank is the PO's last name, auto-filled and locked.

> "On Phase four PO _______ demonstrated they could perform at an acceptable level in the 38 categories that make up the Standard Evaluation Guidelines and have shown they can operate as a safe efficient one officer unit with little to no FTO assistance."
>
> -or-
>
> "On Phase four PO _______ did not demonstrate they could perform at an acceptable level in the 38 categories that make up the Standard Evaluation Guidelines and have not shown they can operate as a safe efficient one officer car without significant FTO assistance."

- **Exact wording:** the statements are not reworded or "corrected", even though the portal uses 30 categories and the two statements say "unit" and "car".
- **Required:** the Week 15 weekly cannot be sent until a statement is chosen.
- **Reminders:** the Phase IV FTO is prompted 2 weeks before W15, 1 week before, and 2 days before. Prompts stop once a statement is selected.
- **Non-release notice:** selecting the non-release statement alerts the Coordinators and FTO Sergeant immediately, even in a draft. This meets the manual's rule that "The FTO Office must be made aware in advance any time a Phase IV FTO plans to recommend a PO not be released." The notice date is recorded.
- **Optional termination:** a "Recommend termination" with documentation is available on any weekly, because the manual allows it in any phase.

## 13. Exports: daily, weekly and phase ("monthly") summaries

**Owner decisions (Set 11d), which update this section:**
- **Who exports:** the Coordinator exports any PO or the whole class; an FTO exports only their own PO.
- **Periods:** DAILY (one tour of duty, the manual's Daily Performance Summary), WEEKLY, MONTHLY (owner: "4 FTO weeks"; Phase IV has 3 weeks per the manual) and ALL PHASES (each phase plus a program total).
- **Class workbook (Coordinator):** seven sheets: CLASS SUMMARY, HEAT MAP, ACTIVITY, COMPARE, PO VS CLASS (one printable page per PO), PO REPORTS and DATA. Every PO number can be compared to the class, with and without Not Observed. See the Class Grid Workbook Sample.

This replaces the former Excel workbook and the current four-tab monthly workbook.

- **Structure:** one workbook per PO per phase, so the five- and six-week calendar month problem no longer exists.
- **Tabs, in this order:** W1D1, W1D2 … W1D5, W1 Summary, W2D1 … W2 Summary, and so on, then the Phase Total. Limbo days get their own tabs labelled as Limbo, for example "W1D1 Limbo".
- **Day tabs:** the same layout as the weekly summary, showing only that day's ratings and activity totals.
- **Totals:** days add up to the week summaries, and the weeks add up to the Phase Total.
- **Format:** U-10.174 layout, landscape, one page per tab, 0.5-inch margins, with the City wordmark, patch and badge.
- **Updates:** a day tab is added when each daily is finalized, and the week and phase totals update when each weekly is signed.
- **Access:** FTOs download their own PO's workbook, and Coordinators download any.
- **Excluded:** raw incident, location, charge and narrative text stay out of the aggregate workbook.

## 14. Coordinator review

| Topic | Decision |
| --- | --- |
| What is reviewed | The weekly packet is the formal review unit. Finalized dailies appear as they arrive and can be opened or returned. |
| Actions | MARK REVIEWED or RETURN FOR CORRECTION. Opening a packet records receipt automatically, so there is no separate Acknowledge step. RETURN requires a note. |
| Corrections | The Coordinator flags pages by tag, e.g. W2D3P4. Only those pages unlock. The FTO edits and resubmits, and the earlier version is kept with a timestamp. |
| After review | The FTO and PO both see REVIEWED with the date and any Coordinator note. The packet is read-only for everyone. |
| Phase goals | Tracked automatically (see section 16). In the phase's final weekly, any unmet goal opens a required explanation (manual). |

### PO Progress page (owner decision)

- A Coordinator sidebar page, PO PROGRESS, with two views on tabs:
  - **Cards:** one card per PO with a 15-week color strip (Phases I-IV), four phase tiles (total UAs and A%), a status chip, a UA% vs class chip and a trend label. BELOW STANDARD PO's sort first.
  - **Class Board:** one row per PO, weeks 1-15, phase UA% next to the class, and trend arrows, with a class average row.
- Clicking a PO opens a detail panel: a weekly UA% chart against the class with NRT weeks marked, the 15-week strip, a by-phase table against the class, the top UA categories, and EXPORT PO.
- **Status (owner standard PO-STD-1, November 25, 2026, sets 22-28):** each rated week is banded by its UA count.
  - MEETS STANDARD: 0-9 UA's, fewer than 3 in any one category, and no NRT.
  - EMERGING CONCERN: 10-19 UA's.
  - BELOW STANDARD: 20 or more UA's, 3 or more UA's in one category in the week, or an NRT.
  - A worse week raises the status to that band. Each rated week that meets standard lowers it one level. A flag can last the whole program. A cleared PO shows PREVIOUSLY FLAGGED with the week it cleared.
  - Counts only, the same for every PO and schedule; no class comparison or weighting. Limbo weeks do not count. Late packets never affect PO status; they count toward the FTO late score.
  - Defensibility: finalized (submitted_complete) Daily Performance Summaries only; dated, versioned formula, never retroactive; every flag reproducible from the Daily Performance Summaries; advisory only, release decisions stay with the Field Training Board. Documented in HANDOVER_MANUAL.md and the Chain of Command Brief.
  - Server audit log of every status change (planned); SHOW CALCULATION in the drawer for the Coordinator and FTO Sergeant; hover and Help Desk definitions end "Based on documented ratings; not a release recommendation."
- **Week colors:** green 0, light green 1-9, yellow 10-19, red 20+, purple NRT or 3+ in one category, limbo week hatched grey, weeks with limbo days marked in the corner, weeks not yet worked dashed.
- **UA counting:** each box counts total UAs, not days. The manual's Weekly Performance Summary (U-10.174) "displays the total number of performance ratings the PO received for each performance category for the week." A PO gets one rating per category per day, so one day can hold many UAs in different categories, but repeat failures in the same category on the same day count once.
  - A separate red chip shows when the PO's UA% is above the class.

## 15. Phase setup and sign-up

This section combines two approved designs:

- the Phase Setup and portal page layout approved on November 25, 2026 (visual reference `attached_assets/Phase-Setup-Approved-Preview.html`; full build prompt `docs/rebuild/PHASE_SETUP_REPLIT_PROMPT.md`), and
- the rebuild decisions in Sets 8 to 10b.

Where the two differ, the item is listed under "Still awaiting owner decision" below. Neither version may be built for that item until the owner decides.

### Approved Phase Setup layout (Coordinator)

One page, three steps: 1 IMPORT CLASS, 2 PHASE WEEKS, 3 ASSIGN FTOS. Each step stays dimmed and locked until the step before it is complete.

- **Step 1, import the class:**
  - Choose an Academy class ("Class 135", newest first) and import every PO in it at once.
  - PO identity (name, badge, work email, work phone, class) is read from the PO's own account. Phase Setup stores PO ids only.
  - The roster sits behind VIEW ROSTER, with search and a fixed-height scroll window for classes of 80 or more.
- **Step 2, phase weeks:**
  - The start date is blank until the Coordinator enters it, and it must be a Sunday. Weeks run Sunday through Saturday.
  - A new setup defaults to 4/4/4/3 weeks (`DEFAULT_PHASE_WEEKS`, with `MIN_PHASES = 4` and `MAX_PHASES = 10` in `src/config/phaseConfiguration.ts`).
  - Weeks are editable, which covers lateral classes. An added phase starts blank.
  - Phases run back to back, and the page shows the total weeks and projected completion.
- **Step 3, assign FTOs:**
  - A grid with one row per PO, one column per phase and a per-PO COMPLETION date.
  - All phases are visible at once, with a sticky header and a sticky PO column, search, and a SHOW filter (All / Unassigned / Conflicts · Withdrawn).
  - Each cell lists the FTOs signed up for that phase first, then all other FTOs.
- **1 PO per FTO per phase:** an FTO is disabled for any cell whose dates overlap another PO they already have, across all classes. The server enforces this too.
- **Auto assign:** AUTO ASSIGN PHASE (primary) and AUTO ASSIGN ALL PHASES (secondary). The fill mode is FILL EMPTY ONLY or REPLACE ALL. Only signed-up FTOs are used, and unfilled cells stay empty (amber outline).
- **Activation:**
  - ACTIVATE PHASE works one phase at a time, in order, and only when every PO has an FTO for that phase.
  - It writes the assignment roster used by the Finalize roster check and the daily form headers.
  - Later edits apply going forward only. Submitted packets keep their frozen headers.
  - The footer has SAVE DRAFT (SAVE CHANGES once a phase is active) and ACTIVATE PHASE.
- **Extensions card:** ADD EXTENSION takes a class, phase, days, a PO checklist and an optional reason.
  - The selected POs' later phases shift.
  - Overlaps created by an extension are saved anyway, but flagged red and listed in ASSIGNMENT CONFLICTS.

### Approved FTO Phase Sign-Up page

- Lists every phase of every class that has not ended, including active phases. The columns are CLASS, PHASE, DATES, WEEKS, PROBATIONARY OFFICERS, SIGNED UP, ASSIGNMENT, and a SIGN UP or WITHDRAW button.
- An FTO may sign up for several phases.
- **Withdrawing:** an FTO can withdraw at any time, and the Coordinator is notified.
  - An existing assignment is kept, so the PO is never left without an FTO.
  - The cell and the FTO's page then show the red WITHDRAWN bubble until the Coordinator reassigns.
- **Day-off coverage:** this sign-up stays separate and unchanged. A silent server check blocks an FTO from covering on a date when they have their own PO.

### Approved portal shell and pages

- **Shell:** a navy sidebar with the City of Columbus wordmark, the badge and the patch. Every sidebar link opens its own page.
- **Bottom action bars:** only Phase Setup and Daily Packet have one.
- **Coordinator pages:** Coordinator Dashboard, Review Desk, Phase Setup, Probationary Officers, FTO Directory, Monthly Reports, Account Settings.
- **FTO pages:** Daily Packet, Phase Sign-Up, Day-Off Coverage, My Probationary Officer, Account Settings.

### Items the rebuild has since answered

| Approved-layout PENDING item | Rebuild answer |
| --- | --- |
| Review Desk actions | MARK REVIEWED or RETURN FOR CORRECTION (section 14). |
| Monthly Reports workbook contents | One workbook per PO per phase (section 13). The page keeps the name MONTHLY REPORTS. The MONTH picker is replaced by PHASE and PO pickers (CLASS, then PHASE, then PO), and EXPORT EXCEL downloads that PO's phase workbook. The PACKETS SUBMITTED table stays (Set 11a, question 5). **Required (owner, high priority):** the Coordinator can also export the monthly for an entire class at once. Owner design: a grid with one row per PO (full name in one cell, badge in the next), then labeled total columns across. There are no per-PO tabs. The column set and week breakdown are pending in Set 11c. **Export periods (owner):** both EXPORT PO and EXPORT CLASS offer DAILY, WEEKLY, MONTHLY, PHASE and ALL PHASES (combined for all phases). The definitions of each period are pending in Set 11d. |
| Daily packet default forms | The W#D#P# page rules (section 8): P1 is Reporting for Duty, and on W1D1 P1 is Substation Orientation. |
| Coordinator Dashboard stat cards | Still pending (Set 11). |

### Conflicts resolved by the owner (Set 11a, November 25, 2026)

1. **Sign-up timing:** always open. The Coordinator runs AUTO ASSIGN when ready, and the FTOs signed up at that moment are matched in Rested First order. There is no sign-up window.
2. **Auto-assign PO choice:** the dialog keeps RANDOM and SELECTED PO's. RANDOM shuffles the PO order only; Rested First still picks the FTO.
3. **What the FTO sees:** CONFIRMED with the PO's name, or WAITLISTED #n.
4. **Repeat FTO:** never chosen by auto assign. A Coordinator may pick one by hand, and the cell shows REPEAT FTO.

### Owner decisions, November 25, 2026 (Replit build)

- **Roster writer:** the FTO Sergeant writes the official FTO-to-PO roster through Phase Setup (Coordinator-only, audited server route; 1 PO per FTO per phase enforced in the database).
- **FTO Phase Setup page:** replaced by the read-only MY PROBATIONARY OFFICER view.
- **Phase sign-ups:** stored on the server (replaces device-only sign-ups).
- **Phase count:** up to 10 phases (server rule widened from 1-4).
- **Coordinator groups:** each Coordinator is assigned a group of PO's at the beginning of the Academy, and keeps it. The FTO Sergeant (above all Coordinators; there are no LEAD Coordinators) sets groups and runs Phase Setup; Coordinators see it read-only. Review Desk: MY PO's first, ALL PO's tab for coverage. FTOs and PO's see a MY COORDINATOR card (name, work phone, work email).
- **FTO Sergeant role (built now):** sees every PO, class, PO Progress and submitted packet (ratings read-only); runs Phase Setup, Auto Assign, Activate Phase and coordinator groups; REASSIGN PO, ADD NOTE, CLOSE ALERT. Home: open alerts first, then PO Progress. Receives NRT and non-release alerts in the portal inbox and by work email. No precinct sergeant alert.
- **Alerts:** portal inbox plus City work email, no case details in email.
- **Mid-phase reassignment:** same packet, split by date.
- **Rested First at launch:** everyone counts as rested; earliest sign-up breaks ties.
- **Grammar:** plurals display as PO's and UA's, including in all-caps labels (the 's stays lowercase).

### Still awaiting owner decision

5. **New screens without an approved preview:**
   - the Senior FTO claim (the FTO enters 5 POs) and the Coordinator's confirmation,
   - RETURN FOR CORRECTION on the Review Desk,
   - the PHASE and PO pickers on Monthly Reports (decided in Set 11a; still needs a preview).

### Timeline

- **Default program:** 15 weeks, split 4/4/4/3 and run back to back: Phase I is weeks 1-4, Phase II weeks 5-8, Phase III weeks 9-12, and Phase IV weeks 13-15. The Coordinator may edit weeks and add phases, as in the approved Phase Setup.
- Limbo falls inside each phase, as described in section 9.
- The PO moves to the next phase automatically unless the FTO recommends ceasing training (manual).
- Each phase gives the PO a new FTO and assignment (manual).

### Extensions (owner decision)

- The Coordinator enters extension days directly, and there is no FTO request step. The manual has no extension procedure.
- Later dates, W# numbering and sign-up dates shift automatically.

### Sign-up fairness: "Rested First" (owner decision; no Sergeant approval)

- **Purpose:** fairness in coaching and less FTO fatigue, without blocking FTOs who want to coach.
- **One PO per FTO per phase.**
- **Timing (owner, Set 11a):** sign-up is always open. Matching runs when the Coordinator presses AUTO ASSIGN; sign-up time is only the last tie-breaker.
- **Rested FTOs first:** an FTO who did not coach the phase immediately before is matched first. A gap resets this: an FTO who coached Phase 1, skipped Phase 2 and signs up for Phase 3 counts as rested.
- **Back-to-back FTOs next:** an FTO who coached the previous phase is matched only if POs remain. They are never blocked, and they can sign up for the following phase in advance.
- **Tie-breaker within each group:**
  1. the longest time since their last phase ended,
  2. the fewest phases coached this calendar year (this spreads the escalating phase stipends),
  3. the earliest sign-up time.
- **Phase IV:** senior FTOs are matched first, then non-senior FTOs if POs remain. Rested-first applies within each group. This reflects the manual's "Generally, only senior FTOs will be able to coach during Phase IV."
- **Never the same FTO:** auto assign never matches a PO with an FTO they already had. A Coordinator may override by hand (cell shows REPEAT FTO).
- **Variety:** after the fairness order, the portal prefers an FTO whose watch and precinct the PO has not had yet. This never overrides fairness.
- **What the FTO sees:** CONFIRMED with the PO's name, or WAITLISTED #n. The waitlist moves up automatically when a slot opens.
- **Coordinator override:** a Coordinator can change any match.

### Senior FTO

- **Threshold:** 4 completed full phases as the assigned FTO (manual).
- **Full phase:** the FTO was the assigned FTO and met the manual's incentive day threshold.
  - 5x8 schedule: 17 of 20 days (Phase IV: 14 of 15).
  - 4x10 schedule: 13 of 16 days (Phase IV: 11 of 12).
  - Coverage days count toward the covering FTO's day totals, but not as a phase.
- **Seeding at launch (owner decision):** the FTO self-reports and a Coordinator verifies.
  - To claim senior status, the FTO enters the name and badge number of at least 5 POs they have coached. Five gives a buffer in case one was not a full phase.
  - The Coordinator confirms each entry or marks it as not a full phase.
  - Senior status needs 4 confirmed entries, and after launch the portal promotes FTOs automatically.

## 16. Phase Specific Goals (manual)

| Phase | Goals |
| --- | --- |
| I | PremierOne Reports 15-20; Crash Reports 6-8; Traffic Enforcement 12-16 |
| II | PremierOne Reports 12-16; Crash Reports 6-8; Traffic Enforcement 10-15; Suspension Packets 2; OVI 1; DV Packets 2 |
| III | Crash Reports 4-5; Traffic Enforcement 12-16; OVI 1; DV Packets 3-5; Suspicious Person Stops/Self-Initiated Contacts/FIs 8-10; On-View Criminal Arrest with Slate 2 |
| IV | Traffic Enforcement 5; OVI 1; Suspicious Person Stops/Self-Initiated Contacts/FIs 6; On-View Criminal Arrest with Slate 2; High-Solvability Misdemeanor Investigation 2; Attempted Warrants Served 5 |

- Progress bars appear on the FTO home page and the PO page, for example "PremierOne Reports 9 of 15-20".
- Goals are counted from the daily activity totals, plus the run tags for goals that have no activity row.

## 17. Current behavior superseded by this specification

| Current portal behavior | Rebuild behavior |
| --- | --- |
| The Coordinator has three steps: ACKNOWLEDGE PACKET, APPROVE PACKET and RETURN FOR CORRECTION. The screen shows "Acknowledge receipt before approving. Acknowledgement is not approval." | Two actions, MARK REVIEWED or RETURN FOR CORRECTION. Receipt is recorded when the packet is opened, and the on-screen rule sentence is removed. |
| The monthly workbook has exactly 4 week tabs selected by calendar month (`YYYY-MM`), and export stops for five- or six-week months. | One workbook per phase, with day tabs, week summary tabs and a Phase Total. |
| The activity summary has 30 fields, including Solve Citation/Summons, Arrest Process Forms and Completed Payouts. | 27 rows from the original workbook. |
| `isRtRestricted` blocks RT for the whole Duty Readiness, Driving Skills and Officer Safety groups. | Same categories (1, 6-7, 18-24), now documented as strict A/UA/NRT. NRT review is added on the 3rd UA. |
| UA explanations are written in articulation groups on the daily ratings. | Written once, in the run narrative, and reused on the rating row and the weekly log. |
| The narrative outline is seeded from the selected checklist labels. | Seeded from pre-written "PO failed to..." sentences for items unchecked as Not Acceptable. |
| Extensions are requested by the FTO and approved by the Coordinator. | The Coordinator enters extension days directly. |
| There is no Week 15 recommendation workflow. | The manual's verbatim statements are required, with reminders and a non-release alert. |
| Weekly training time is left blank on source-linked entries. | Minutes come from the run narratives. |
| The fixed-count "!" check exists only in the old workbook. | The schedule-based day-count check blocks the weekly. |

## 18. Open items (not yet decided)

- **Phase Setup:** conflicts 1-4 resolved (Set 11a). New screens still needing a preview: see section 15, "Still awaiting owner decision".

- **Set 11, Coordinator tools:**
  - the first-window "rested" status at launch,
  - Coordinator home page layout,
  - alert delivery (portal inbox, email),
  - the FTO incentive and stipend report,
  - paperwork when a PO is reassigned mid-phase.
- **Set 12, look and feel:** printing, and confirmation that every export keeps its official one-page layout.
- **FTO Sergeant alerts:** NRT and non-release alerts go to the FTO Sergeant, but the Sergeant role is deferred. The delivery path (email or a minimal Sergeant inbox) needs a decision.
- **Sentence library:** the "PO failed to..." sentence for every checklist item, to be drafted for the owner's approval.
- **Dispatch codes:** the form mapping for the 6 ambiguous codes.
- **Phase goal:** whether "Self-Initiated Contacts" in the Phase III and IV goals needs its own run tag.
- **Week of date:** the workbook header uses the W#D1 date, while the manual's Weekly Log uses the Sunday of the week. Confirm both are wanted on their respective forms.

## 19. Implementation notes for the builder

The rebuild code lives in this pnpm workspace, but it is built in Perplexity and delivered through GitHub `main` (see the build workflow section of `replit.md`). Replit Agent does not implement these notes; it hands requests off to Perplexity. Read `.replit-context.md`, `HANDOVER_MANUAL.md`, `PROJECT_MANIFEST.md`, `docs/PROJECT_STRUCTURE.md` and `src/config/phaseConfiguration.ts` before changing anything.

### Protected files

- `.replit-context.md`, `HANDOVER_MANUAL.md`, `src/config/phaseConfiguration.ts`, `tsconfig.base.json`, `pnpm-workspace.yaml`, `package.json` and `artifacts/api-server/package.json` are protected (`scripts/src/snapshot-context.ts`).
- Change them only through `pnpm context:write <target> <prepared-text-file>`. This takes the `local-history-snapshots/` snapshot before writing. The prepared file must be a non-hidden file inside the repository.
- `pnpm run snapshot:context` takes a snapshot on its own. `prebuild:api` runs it automatically before `pnpm run bundle:production`.

### Where rebuild rules live in code

- **Phase durations and Limbo policy:** stay in the workspace-root `src/config/phaseConfiguration.ts` (`PHASE_TIMELINE_REGISTRY`). The artifact copy only re-exports it.
- **Categories and activity fields:** keep the 30-category keys in `artifacts/field-training/src/lib/model.ts` (`SEG_CATEGORIES`).
  - Update `DAILY_ACTIVITY_FIELDS` to the 27-row list.
  - Keep records saved with the removed fields readable, and do not delete their history.
  - Do not reuse the removed keys.
- **Monthly export:** replace the logic in `lib/exportWorkbook.ts` with the per-phase workbook. Keep Zod validation at the export boundary, and update `monthly-summary.test.ts`.
- **Review actions:** replace them in `pages/packet-submissions.tsx` and its API routes. Keep the two-stage gate: `local_draft_pending` is never visible to the Coordinator.

### Documentation that must stay in step

- `HANDOVER_MANUAL.md`, via `pnpm context:write`. It ships inside `dist-production.zip`.
- `PROJECT_MANIFEST.md`, `README.md` and `docs/PROJECT_STRUCTURE.md`.
- `docs/COLUMBUS_FTO_PORTAL_BRIEFING.md`. After any change to it, run `pnpm run export:executive-brief` (Chromium must be on `PATH`) to refresh `generated-artifacts/website-records/`, then run `pnpm run test:executive-brief-export`.

### Gates for every change (all must pass)

1. Snapshot: `pnpm context:write` for protected files, otherwise `pnpm run snapshot:context`.
2. `pnpm typecheck`, with zero errors and zero warnings.
3. `pnpm --filter @workspace/field-training run build`, with zero errors and zero warnings.
4. `pnpm test:field-training:regressions`, the same as the GitHub workflow `field-training-regressions.yml`.
5. `pnpm test:maintenance-guardrails`.
6. `pnpm run bundle:production`. It fails if `dist-production.zip` exceeds 26,214,400 bytes, so report the byte size.

### Working rules

- Build the UI as a preview first, and integrate only after the project owner approves it.
- Every rule in this document runs in background hooks. Nothing in this document may appear as on-screen text.
- If the code and this document conflict, stop and ask the project owner before deciding.
