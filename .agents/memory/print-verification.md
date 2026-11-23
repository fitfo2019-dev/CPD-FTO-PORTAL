---
name: Print verification
description: Chromium print layout pitfalls when validating training packet exports.
---

Verify physical PDF sheets, not just visible page labels or the on-screen print preview.

**Why:** Chromium can insert blank sheets when named-page styles begin or end inside an unnamed wrapper. Fixed-height page containers can also push a footer onto an unlabeled sheet even when the narrative itself fits.

**How to apply:** For packet print changes, compare actual PDF page counts with the expected form references and inspect the final sheet for footer-only overflow. Include long narratives and explicit blank lines; short sample text does not expose these failures.

The user approved a single-sheet Substation Orientation at Page 1 on Phase Day 1,
then clarified that Reporting for Duty must be retained every day. Phase ingress
therefore has orientation P1, duty P2 and runs P3 onward. Routine days start with
duty P1 and runs P2 onward. Runs, supplements and continuations advance the source
page sequence without a fixed application page cap.

**Why:** The user approved the single-sheet redesign and then stated that every
day must still have its Reporting for Duty page.

**How to apply:** Preserve existing historical citations rather than silently
rewriting them when packet order changes. Require reference reconfirmation before
using an older citation against a newly generated packet. A shift transition is
not permission to delete encrypted records or change the vault's key lifecycle.

Substation Orientation is a checklist for the FTO to go over with the PO, not a
performance evaluation. Checkmarks record which orientation items were covered;
uncovered items must not by themselves imply a performance rating or deficiency.

**Why:** The user clarified: "for that page its just a checklist for fto to go over with po".

**How to apply:** Keep orientation completion separate from daily run evaluation
rules. The user selected Example B's related-item groupings, with safety-specific
items kept separate. Preserve saved individual task values; a mixed group must
not become fully covered merely because the display is grouped.
