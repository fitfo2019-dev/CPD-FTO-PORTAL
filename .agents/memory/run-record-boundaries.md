---
name: Run record boundaries
description: Rules for checklist narrative drafts, local incident metadata, and separating run evidence from ratings.
---

Generate a checklist-derived run narrative only after the FTO explicitly confirms review of the active checklists. Include exact selected labels from applicable forms, keep the result editable, and never overwrite authored narrative text.

Optional incident number and location fields are approved for local demonstration run records. They appear in printed forms and class workbook exports as plain text, so use fictional values only. Do not copy those identifiers into generated narrative drafts or the monthly Run Support worksheet.

The user defines an applicable unchecked operational task as a failure trigger,
and explicitly requested an immediate UA default. The user approved **named
category meanings**, not literal row numbers, for the routing defaults. Historical
manual references and the consolidated 30-category worksheet have different
numbering. Preserve all 30 named categories and let the FTO override a semantic
default; never assign a Building Search failure to Motivational Traits because
both were described with the same legacy number in different lists.

**Why:** The user confirmed “Use named category meanings (recommended)” after the
numbering conflict was shown, and supplied instructions requiring UA defaults,
one articulation per incident/category, source-page tags, and FTO overrides.

**How to apply:** Keep defaults transparent and reviewable; the approval was for
semantic routing, not independent certification of a manual crosswalk. Preserve
authored text, permit named-category overrides, consolidate source tasks, and
never assert coaching or elapsed training time merely from an unchecked box.
Respect explicit Not Applicable groups and Limbo no-ratings rules. Do not
retroactively reinterpret historical saved checklists without an explicit edit.

Applicable unchecked tasks project UA immediately, but the FTO articulation
editor must not open until the associated checklist review is explicitly
confirmed. Unreviewed daily records do not affect weekly rating counts or the
category's weekly A ceiling; only reviewed, non-Limbo summaries count.

**Why:** The task must have an immediate deficiency marker, while narrative
articulation still depends on an explicit FTO review and weekly totals should not
be affected by unfinished daily records.

**How to apply:** Preserve the immediate UA projection and gate the articulation
editor on the checklist review state. Keep weekly counts and ceilings scoped to
reviewed, non-Limbo reports.

When Shotgun Training is `N`, Resource/Equipment Usage is marked not applicable
outside the five rating values. A concrete checklist deficiency in that category
still takes precedence over the N/A marker and remains UA.

**Why:** The requested N/A state describes applicability, not a sixth rating;
it must not erase an observed checklist failure.

**How to apply:** Keep N/A as separate report applicability metadata, exclude it
from weekly rating counts, and retain any recorded deficiency as UA evidence.

Run event time (call aired or initiated) is distinct from dispatch and cleared
times. Look up only after an FTO enters an incident number and starts the request.
Match against the editable unit/cruiser assignment saved at phase start. Each PO
can query the same incident: return only that unit's row, copy shared incident
metrics into every matching unit result, and prefer that unit's own dispatch and
clear times. Never import officer identity, caller contact, or narrative details.
The editable fields are date/time, dispatch/clear times, dispatched code,
structured address, city/state/ZIP, zone, cruiser district, and clearance code.
Situation Found starts blank. Suggest only the existing unique form mappings:
code 17 to Domestic Incident and code 4 to Traffic Crash; code 6 is ambiguous
between two traffic-stop forms and needs FTO choice. Unmapped codes use Call for
Service unless the FTO selects another form. A 3V clearance triggers the
existing arrest/transport workflow; codes alone do not infer other actions.
The user-uploaded PatrolView screen remains a visual example rather than an API
contract, and no live feed is configured.

**Why:** The user clarified that each PO has an independently assigned cruiser
but can share a run, and specified the incident metrics to import without officer
details. They also required code-only entry, FTO editing, a blank Situation Found
default, and FTO choice for ambiguous codes.

**How to apply:** Keep dispatch access FTO-initiated; exact-match incident and
assigned unit while repeating only approved shared metrics on each result. Keep
Tab behavior accessible and let Enter explicitly open the selected form. Do not
expand the 10-code-to-form/add-on crosswalk beyond verified mappings without an
approved source; keep live access disabled until agency IT approves the endpoint,
field semantics, credentials, and authorization allowlist.
