---
name: FTO manual source conflicts
description: Conflicts between the attached Columbus FTO Manual, the user's form mapping, and SEG headings.
---

The uploaded Final FTO Manual updated 03/10/2026 is internally inconsistent: its glossary labels both the Daily and Weekly Performance Summaries U-10.174, while its procedure section labels the Daily Performance Summary U-10.173 and the Weekly Performance Summary U-10.174. The macro-enabled workbook labels U-10.174 (05/2020), and the separate 2014 Weekly Performance Log sample carries U-10.174. The user's current portal mapping is Daily Performance Log U-10.174, Weekly Performance Summary U-10.173, and Weekly Performance Log Supplement U-10.174S. Preserve this user-directed mapping in the portal, but do not claim it matches every historical source.

The user subsequently supplied a newer Weekly Performance Summary photograph and said “these are the new SEGS- remove any not listed on this.” That 30-category source supersedes the older 38-category manual index. Do not reintroduce old categories by re-reading the older manual. The user explicitly requests new evaluations default to Acceptable, with a PO review prompt before submission; this overrides the attached general prompt's instruction not to prefill ratings. Existing recorded evaluations must not be silently rewritten.

Class view and class-wide exports are restricted to FTOs and FTO Office Admins only, not Sergeants or POs. A demo role picker is not authorization; actual operational access must await verified server-side roles.

All FTOs need class access, not only the regularly assigned FTO, because they cover for one another. A “Sub in for an FTO” workflow must create a single day using the substitute's information without replacing the regular phase assignment.

NRT is an exclusive current rating, not simultaneous UA and NRT. Link at least one earlier reviewed UA for the same PO/category and record corrective training. The NRT workflow should make earlier UA references easy to browse and select in W#D#P# form, including a select-all action for that category. The user explicitly confirmed “Yes, link prior UA.” The newest prompt clarifies P is the source page, with W5D4P4 as an example; do not infer P from the phase or daily log. Prefill only the known week/day and require the FTO to confirm the source page before print export. Printed Page X of Y numbering is distinct. Narrative fields have no character limit; printed continuations must preserve all text and use “Page X of Y.” Run review should use one save confirmation, not per-item verification or another review checkbox.

**Why:** The user corrected these workflow rules explicitly; older assumptions about pairing current NRT with UA must not override that clarification.

**How to apply:** Keep current ratings exclusive, preserve earlier UA records as links, and support temporary FTO coverage without changing regular assignments.

The Weekly Packet Acknowledgement sample on page 48 has PO comments/signature, FTO comments/signature, and Field Training Office comments/signature. Pages 49–53 instruct staff to create a self-signed certificate-based Digital ID in Adobe Acrobat, using rank/name/badge, assignment, “Columbus Police,” and work email, then sign the PDF and validate the green-check indicator. A self-signed certificate protects document integrity but does not independently prove agency employment; that identity-to-certificate binding still needs an approved roster or identity provider.

The manual's workflow distinguishes the once-per-day Daily Performance Summary from one primary checklist for each applicable run. Reporting for Duty (U-10.191) is also completed each day. Run primary forms include Call for Service, Self-Initiated Run/Training, Domestic Incident, Traffic Crash Investigation, Traffic Stop, High Risk Traffic Stop, and Building Search. Arrest Process and OVI Process are conditional supplements; Traffic Data Collection is additionally required for self-initiated motor-vehicle or bicycle stops. Use the printed form names in the UI rather than calling these documents “DORs.”

The user's newer operational pipeline request requires an Arrest Process child
sheet whenever Arrest Made is selected, even if transport is not selected. Keep
this requested attachment rule distinct from the older manual's transported-arrest
criteria. An attached sheet does not prove a completed form or justify an
automatic activity count.

The user clarifies that daily summaries carry the statistics, while the weekly performance log consolidates UA articulations and corrective retraining. The uploaded 2014 weekly log continuation includes category, total time, narrative, and a W5D4P4 reference. Default new corrective-training time to 15 minutes but let the FTO change it; preserve the actual source narrative and time in PDF and Excel exports.

**Why:** The user clarified the different daily and weekly paperwork purposes and specified the editable 15-minute retraining default.

**How to apply:** Keep daily activity statistics separate from the weekly UA/corrective-training log; carry reviewed UA articulations and references forward without overwriting FTO edits.

The user explicitly requests every run checklist selection to start checked for faster input; this is a UI default, not evidence that the item occurred. Require the FTO to review the prechecked items and clear any item that did not apply or was not completed acceptably before marking that run form complete. Weekly Performance Summary rating counts are based on reviewed daily summaries, while run checklist totals remain a separate weekly aggregate.

No Patrol View connector, supported public API contract, or usable redacted export schema was verified. A system path or hostname alone is not an integration contract; keep data import disabled until an authorized source and export/API format are supplied and protected data access is approved.

**Why:** The user clarified that the current daily form is U-10.174 and its supplement is U-10.174S, while the revised prompt assigns U-10.173 to the weekly summary. Submitted historical materials conflict, including within the 2026 manual. The signature chapter defines the manual's intended PDF-signing workflow but does not establish an external trust root for its self-signed certificates.

**How to apply:** Keep the user's current portal mapping for generated forms and exports. Treat the manual, workbook, and 2014 paper examples as historical sources with conflicting identifiers; preserve their original labels when displaying source copies. Prefer the newest user-approved worksheet for categories and counts. Keep weekly packet signatures in the PO → FTO → Field Training Office order shown on page 48; do not substitute Sergeant for Field Training Office. Preserve the Acrobat certificate-signing workflow and separately bind each signer to an approved account/roster; do not claim legal validity or agency identity from a self-signed certificate alone.

**Why:** The user explicitly requested checked defaults despite the manual's instructions to leave non-applicable or unacceptable checklist items blank.

**How to apply:** Preserve the user's speed-oriented checked defaults only with a required review-and-clear step. Never count an unreviewed daily rating default as a weekly evaluation.

Traffic Data Collection is referenced as a checklist item on primary run forms, but there is no separate submitted form example. Do not generate a separate printable Traffic Data Collection supplement or invent its fields.

**Why:** The user requires submitted form checkboxes and names to match the supplied forms and rejects synthetic paperwork.

**How to apply:** Keep the Traffic Data Collection checklist item on its source run form; add a separate export only when the user supplies or approves that form.
