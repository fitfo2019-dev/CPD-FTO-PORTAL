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
times. The incident lookup occurs only after the FTO enters an incident number
and explicitly starts it. Use the editable Unit / cruiser assignment from
Reporting for Duty to match the FTO/PO's own unit. Each PO may query the same
incident independently; never consume a shared incident record or return another
unit's row. Apply incident-wide times to that unit when supplied; unit-specific
times take precedence. Keep all prefilled values editable and require review.
Never infer a primary form from a 10-code; an absent or ambiguous type needs an
explicit FTO choice. Manual entry remains available. The uploaded PatrolView
screen is a visual example, not an API contract, and no live feed is configured.

**Why:** The user specified explicit incident-number lookup, editable cruiser/
assignment matching, multiple POs on a shared incident, dispatch and clear times,
and FTO review/type selection. The real upstream JSON contract is still pending.

**How to apply:** Query only on FTO action; match incident plus the entered
assigned unit on the server, return only that unit's record, preserve shared and
unit-specific time semantics, and allow manual fallback. Do not enable live
access until agency IT validates the upstream endpoint, JSON mapping, credentials,
and authorization allowlist.
