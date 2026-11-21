---
name: Print verification
description: Chromium print layout pitfalls when validating training packet exports.
---

Verify physical PDF sheets, not just visible page labels or the on-screen print preview.

**Why:** Chromium can insert blank sheets when named-page styles begin or end inside an unnamed wrapper. Fixed-height page containers can also push a footer onto an unlabeled sheet even when the narrative itself fits.

**How to apply:** For packet print changes, compare actual PDF page counts with the expected form references and inspect the final sheet for footer-only overflow. Include long narratives and explicit blank lines; short sample text does not expose these failures.
