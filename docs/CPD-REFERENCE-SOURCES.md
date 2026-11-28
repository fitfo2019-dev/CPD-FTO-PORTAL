# Field Training Officer Portal reference sources

## Current SEG source

The current Weekly Performance Summary worksheet supersedes the older manual's 38-category list for the current UI and exports.
The current list contains 30 categories, with RT shaded out for Duty Readiness,
Driving Skills and Officer Safety. New evaluations default to Acceptable by owner
decision; defaults are unreviewed and are never inferred from runs.
Existing saved ratings are not rewritten to Acceptable. Superseded values are
preserved separately and excluded from current totals.

The worksheet repeats “Summons Re-issued” in its activity grid. FieldReady
collects and counts that activity once rather than counting the same fact twice.
Activity counters remain factual counts, not performance scores.

## Branding

- Source page: https://www.columbus.gov/Services/Public-Safety/Police
- City logo: the SVG asset linked in that page's header. The original sprite's
  viewBox is cropped to display its primary white/red wordmark.
- Badge and patch: Division insignia. The left badge is shown in grayscale
  as the silver version; the right patch keeps its colors.

The marks do not imply agency approval. The fictional-demo warning remains.

## Radio code reference

Public reference inspected: https://www.broadcastify.com/listen/feed/11208

The feed notes list Columbus radio codes and the following dispositions:

- 1: Report and/or Citation
- 2: Party Advised or No Report Needed
- 3: Arrest Made
- 4: Non-Arrest Situation / Errand Completed
- V: video recording

FieldReady displays 1V–4V per the owner's code list, and combines these descriptions.
This is a third-party scanner reference, **not an approved or current CPD code
table**. Other public lists disagree (including on 10-17 and 10-25). No definitive
official code table was located. Descriptions must remain labeled reference-only
until the department provides its current approved table.

Code suffixes are stored independently of descriptions. FTOs enter numbers and
letters without a repeated 10- prefix; unknown well-formed codes are retained
without inventing a meaning. Codes never automatically assign a form, rating,
or activity count. Patrol View is not connected.

Citation shortcuts are the owner's mapping: S → Served, W → Verbal Warning,
H → Hand Written. Counts represent recorded run dispositions, not an inferred
number of tickets. Supplemental forms do not add additional run counts.

## Official directives used as run-form prompts

The official [Directives index](https://www.columbus.gov/Services/Public-Safety/Police/About-the-Columbus-Division-of-Police/Directives) links the current public directive PDFs. A focused review of directives 2.01, 3.01–3.03, 4.05, 5.03, 5.05–5.07, 6.01–6.02, 9.01, 9.03, 10.02, 10.04, and 11.07 informed contextual reminders for force, arrest/slating, domestic incidents, traffic/crashes, OVI, towing/property, training, records, and video systems.

- Arrest runs prompt review of Directive 3.01; its public text identifies Form U-10.100 for arrest/slating paperwork and supervisor review before slating. Transported arrests also point to 3.03.
- Domestic incidents link Directive 4.05; crashes link 5.05 to confirm whether OH-1 criteria apply; traffic stops link 5.07; OVI processing links 5.06.
- Impound and property/evidence selections link 6.01 and 6.02. Every run links 11.07 for applicable BWC/CVS checks.
- Every run also shows a conditional 2.01 reminder for force or weapon display; traffic and high-risk stop runs show a conditional 5.03 reminder for any used or attempted stopping tactic (U-10.194).
- Directives 9.01 and 9.03, plus 10.02 and 10.04, are relevant to training, evaluations, records, and form control; they are not encoded as run-level outcome rules.

These are event-driven reference prompts, not a complete transcription of every directive, an official checklist, or a compliance attestation. The linked current directive controls; FTO Office review is needed before any prompt becomes a mandatory production workflow. Public directives can be revised independently of this app.

## Assignment conventions set by the owner

For day companies, mapped cruiser-district assignments can have a two-officer `1` or `2` suffix. PTV wagon car numbers use the precinct number plus `8` (for example, precincts 15, 8, and 19 yield 158, 88, and 198); wagon assignments have two seats such as `88C1` and `88C2`. Midwatch has no wagon assignment and retains D1/D2 or E1/E2 conventions.

## Cruiser districts, universal assignment codes, and reporting starts

Reviewed the Patrol Subdivision SOP compilation revised through
06/30/26, preferring it to the older compilation revised through 12/30/24.
In SOP 1.01 E.2 (section revision 06/30/23; printed page 1, PDF page 3),
each patrol zone is divided into precincts and each precinct into cruiser
districts. SOP 1.01 E.6 (same revision; printed page 2, PDF page 4) directs
personnel to the Division intranet cruiser maps and makes Communications the
final authority for boundary discrepancies. Its zone/precinct table is on
printed page 2 (PDF page 4).

The Division Directives compilation is revised through 09/30/26.
Directive 10.03 (revised 09/30/26) I.5.b(1) says cruiser district maps are
distributed to Communications; J.1.a(1)–(2) says the Division Database
Administrator formulates them and the R&D Unit distributes and maintains
them (printed page 2 of Directive 10.03, PDF page 632 of the compilation).
These sources support using the mapped patrol area and directing map-boundary
questions to Communications; they do not establish a universal `80` district.

`80C-1` and `80C-2` are the owner's universal assignment requirement,
not codes verified in either reviewed publication. Searches of the reviewed
SOP and Directives text did not verify a sergeant-side 1/2 definition or
connect those suffixes to the existing two-officer assignment suffixes. Do not
infer geographic boundaries, passenger seats, or authorization from the code;
agency confirmation is needed for any sergeant-side interpretation.

SOP 1.01 F.1–3 (section revision 06/30/23; printed page 2, PDF page 4) lists
early-reporting precincts 4, 5, 7, 8, 9, 10, 11, 13, 17, 18, and 20 at
06:00/14:00/22:00; late-reporting precincts 1, 2, 3, 6, 12, 14, 15, 16, and
19 at 07:00/15:00/23:00; and DMW/EMW starts at 09:00/19:00. These are
documented reporting starts only, not an independently verified A/B/C-to-watch
mapping or an end-time schedule.
