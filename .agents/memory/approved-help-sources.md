---
name: Approved FTO help sources and role scope
description: User limits operational explanations to official directives and the uploaded manual/forms and defines the current roles.
---

Keep routine entry screens concise. The user asked to remove space-consuming
reference paragraphs and put explanations into Help. Operational explanations
throughout the site must come only from the Columbus Police Directives site and
the supplied FTO manual/forms. Interface usability research is not operational
policy and must not be presented as such.

**Why:** The user explicitly said these paragraphs waste space and restricted
the source material.

**How to apply:** Keep a brief contextual Help link rather than repeating long
instructions. Do not expose internal agent/workflow directions, implementation
roadmaps, or redundant page-level caveats. Retain necessary validation,
unsaved-work, and safety/status notices. Do not recast the user's assignment
conventions as published directive text.

Use the official Columbus Directives web page's individual PDF links as the
authoritative list of directive numbers and titles. Do not treat numbered
subsections inside Directive 1.01, such as “Obedience to Laws and Ordinances,”
as separate Division Directives.

**Why:** The official page distinguishes individual directives (for example,
1.01 Rules of Conduct) from numbered rules nested inside a directive.

**How to apply:** Populate directive pickers and library records from the current
official PDF list. Link each listed PDF directly; use the official table of
contents only as a cross-check, not as a separate list of rule-level directives.

The current roles are PO, FTO, FTO Sgt., FTO Coordinator, FTO COC, POLICENET,
and POLICENET ADMIN — SGT. PO access is limited to the PO's own records after
verified account and class/phase activation. FTOs work assigned classes and
coverage without requiring an administrator to be online. The FTO Coordinator
manages rosters, class/phase activation, assignments, schedules, geography,
coverage, setup exceptions, packet completeness, and authorized reports. FTO
COC may review only completed or submitted packets, comment, print/export, and
return them to the FTO Coordinator; it cannot edit source records or setup.
FTO Sgt. is a distinct, scope-limited supervisory role: it may monitor assigned
classes and manage assignments only when specifically permitted. It does not
inherit FTO Coordinator account/roster authority or FTO COC packet-review
authority, and cannot edit narratives, ratings, or statistics by default.
POLICENET roles are technical only and do not receive operational-record access.
Deleting training records is the only action that requires separate approvals
from two POLICENET admin accounts: one with SGT rank and one with LT rank.
Technical roles cannot alter training judgments or bypass operational
permissions.

**Why:** The user replaced the earlier role set, then explicitly added a distinct
FTO Sgt. role with limited, assigned-scope permissions.

**How to apply:** Keep the preview selector distinct from authorization. Enforce
all permissions server-side; do not expose COC drafts or class records. Keep
PO training access unavailable until verified identity and class/phase
activation exist. Apply the two-person SGT/LT rule only to training-record
deletion, verifying distinct admin accounts and ranks.

Class-first activation requires a complete confirmed roster, initial
assignments, a review step, and an explicit Phase I start. The protected server
audit must record the initiating user, timestamp, roster version, phase, all
affected POs, before/after state, and reason; reject direct API/import/bulk
bypasses. Account setup uses department email and one-use activation links,
never badge-number passwords, and requires applicable MFA/SSO controls.

**Why:** The user specified invitation-only early account setup and auditable,
class-wide Phase I activation.

**How to apply:** Do not simulate activation or account verification in local
storage. Keep training access closed until the server confirms the assignment
and phase atomically.

Run media must begin from an active FTO shift/run. Derive PO, class, phase, and
shift from that authorized context; only ask for a run and its documented UA.
Require file descriptions and video timestamps/ranges, review the full
association before saving, and audit uploader, time, source, links, and
descriptions. Never ask the FTO to re-enter PO/class when the active assignment
already supplies them.

**Why:** The user specified that run-media attachment must reuse the active
assignment and be tied to a documented UA.

**How to apply:** Keep the upload disabled until protected identity and secure
media storage are available; do not present a local-only attachment as
uploaded or trusted evidence.

The supplied 03/10/2026 manual and individual forms are the newer reference set.
Some supplied files still contain legacy category lists or conflicting form
numbers. Do not silently undo the user's explicit 30-category and daily/weekly
form corrections merely because those legacy sections recur.

**Why:** The user supplied the complete form set as export requirements, while
their explicit category and form-number corrections remain in force.

**How to apply:** Compare fields and layouts against the supplied originals,
record any conflicts, and distinguish reconstructed exports from verified
original-form exports.

The OPD Criminal Law Casebook states that its contents may not be duplicated
without express permission. Keep the casebook as a direct link to its official
site; do not copy its index or case text into the portal without that
permission.

**Why:** The source page includes an explicit reuse restriction, and the
casebook's embedded reader did not work reliably in the portal.

**How to apply:** Open the official casebook in a new tab and preserve its
source link; do not treat access to the public page as permission to reproduce
its contents.

Build paperwork fields from the actual supplied forms and manual; do not add
invented operational fields or replace required fields with synthetic ones.

**Why:** The user explicitly corrected the project to use actual form content
and said not to substitute synthetic fields.

**How to apply:** When a source field or workflow is unclear, inspect the
provided form/manual and preserve its meaning. Keep local-only/server-sync
limits visible until the protected server pipeline is verified.

The FTO Coordinator posts each class/phase with its dates. FTOs sign up by
choosing the class and phase and see only the count of POs needing an FTO.
Only the Coordinator sees unfilled PO assignments, reviews the PO's records,
and uses professional judgment to choose an FTO based on the PO's needs and
the FTO's strengths; do not invent fixed FTO categories or auto-score matches.
Substation Orientation is
required before the first shift on the first scheduled workday of every phase.
Coverage requests need dates and times, go to all FTOs for accept/decline, and
must be accepted before substitute work starts. An incoming coverage prompt
must not discard an in-progress run sheet.

**Why:** The user specified the class/phase signup, coordinator selection,
per-phase orientation, and substitution workflows.

**How to apply:** Keep signup and coverage status as local unsent drafts unless
the protected shared service confirms posting, delivery, response, and assignment.
Show the FTO's current PO/class/phase automatically. A response prompt should
overlay the open sheet rather than navigate away or reset it.

Use the FTO directory as the single local source for name, badge, and email.
Phase assignments link to an FTO by badge; new forms take their assigned FTO
identity from that directory, while saved reports retain their identity snapshot.
Do not claim account activation, profile approval/history, or server-side
assignment authorization until the protected identity and assignment service exists.

**Why:** The user supplied a profile workflow and requires paperwork to reuse
FTO data without rewriting historical reports.

**How to apply:** Reuse directory-backed identity in forms. Keep missing profiles
visible for Coordinator resolution. Do not create local activation or approval
states that appear official.

Application-use Help Desk topics declare their audiences explicitly. Keep local
save and record-status guidance shared; account activation is PO-only, roster
imports are Coordinator-only, phase requests are for FTOs and Coordinators, and
packet-action help is for PO, FTO, Coordinator, and COC roles. A contextual link
to a topic outside the current role's audience must not reveal that answer.

**Why:** The user approved a preview that keeps role-specific portal guidance
separate while preserving shared save and status help.

**How to apply:** Assign an audience whenever adding a topic, and keep each
contextual link within its audience. When a deep link is out of scope for the
current role, show an available topic instead.
