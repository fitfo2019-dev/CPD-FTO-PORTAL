---
name: Print verification
description: Chromium print layout pitfalls when validating training packet exports.
---

Verify physical PDF sheets, not just visible page labels or the on-screen print preview.

**Why:** Chromium can insert blank sheets when named-page styles begin or end inside an unnamed wrapper. Fixed-height page containers can also push a footer onto an unlabeled sheet even when the narrative itself fits.

**How to apply:** For packet print changes, compare actual PDF page counts with the expected form references and inspect the final sheet for footer-only overflow. Include long narratives and explicit blank lines; short sample text does not expose these failures.

Daily packet references must start with Reporting for Duty at Page 1 for each
shift, followed by Substation Orientation on the first scheduled day of a new
phase. Runs, conditional supplements, and continuations each advance the source
page sequence without a fixed application page cap. Source coordinates and
physical print pages must be checked together.

**Why:** The user explicitly requested duty-first, shift-local folder numbering
that can extend beyond Page 147 and restarts at Page 1 on the next training day.

**How to apply:** Preserve existing historical citations rather than silently
rewriting them when packet order changes. Require reference reconfirmation before
using an older citation against a newly generated packet. A shift transition is
not permission to delete encrypted records or change the vault's key lifecycle.
