---
name: Print verification
description: Chromium print layout pitfalls when validating training packet exports.
---

Verify physical PDF sheets, not just visible page labels or the on-screen print preview.

Every base form must fit on one physical sheet, including run forms, supplements,
orientation, and daily/weekly/monthly summaries and logs. Only narrative
attachments may continue onto additional sheets. Reserve letterhead space once
and check the entire checklist, notes, signatures, and footer together; a
footer-only overflow is not a narrative continuation.

**Why:** The user explicitly clarified “all forms on one page” after rejecting
multi-sheet base forms. Earlier permission for flowing records does not override
that later instruction. Letterhead spacing and unbalanced columns previously
pushed base content or only the footer onto another sheet.

**How to apply:** Check every primary and supplemental form's actual PDF, including all checklist text and footer marks. Keep long-narrative preservation checks separate from short-form page-fit checks.

Chromium's `beforeprint` event can still expose screen-style geometry for
screen-hidden print forms, including zero-size bounds, even when the PDF prints
correctly.

**Why:** A geometry diagnostic returned hidden-screen measurements for a valid
print export.

**How to apply:** Use exported PDF page counts and text bounds as the final
evidence, not `beforeprint` measurements alone.

**Why:** Chromium can insert blank sheets when named-page styles begin or end inside an unnamed wrapper. Fixed-height page containers can also push a footer onto an unlabeled sheet even when the narrative itself fits.

**How to apply:** For packet print changes, compare actual PDF page counts with the expected form references and inspect the final sheet for footer-only overflow. Include long narratives and explicit blank lines; short sample text does not expose these failures.

Print the live portal route as well as any isolated form fixture, including the
fictional-preview route when it is the user's review surface.

**Why:** A form can fit correctly in isolation while a hidden preview banner
still reserves top-margin space or a viewport-height wrapper creates a blank
extra sheet.

**How to apply:** Measure actual PDF text/border bounds and page count from the
live route; do not treat `visibility:hidden` as removal from print flow. Verify
that genuine narrative continuations remain present rather than hiding overflow.

Measure orientation and repeated headers/footers on the exported sheets, not
only from the requested CSS page name. Legacy absolute-position print roots
can prevent the intended named-page layout from applying. Empty writing rows
and doubled row gap/margins can also create nearly empty continuation sheets.

**Why:** The shared-template rollout exposed portrait output from intended
landscape layouts and spillover consisting only of blank writing rows or a
short final notice.

**How to apply:** Keep document roots in normal flow, check actual PDF paper
dimensions and inspect every sheet (not just page one). Preserve the daily
log's original grouping; where other layouts permit rebalancing, use content
rather than heading counts. Keep all original data, signatures, and citations.

Equal-height checklist grids repeat the tallest card's height in every row.
Long wrapped tasks or review details inside one card can therefore expand the
whole grid, even when most cards contain little text.

**Why:** Making category boxes uniform exposed overflow that task counts alone
did not predict.

**How to apply:** Budget metadata, instructions, the tallest wrapped card,
notes, and footer together at the actual print width. Verify physical sheets
after changing the grid rather than relying on nominal row counts.

Reporting for Duty should use a full Letter sheet with readable checklist text
and balanced sections, rather than inheriting the compact incident-run density.

**Why:** The user rejected the compact duty export because it did not fill the page.

**How to apply:** Scope sizing to the duty form, keep every item and its page
reference, and verify that its footer remains on the same physical PDF sheet.

Verify Excel page settings in the serialized workbook, not just the worksheet
object in memory. The spreadsheet writer can silently omit print setup metadata.

**Why:** A monthly worksheet object declared landscape and one-page fitting, but
the saved workbook contained no page setup and could open with portrait defaults.

**How to apply:** Check the actual saved worksheet XML and round-trip its values
and merged cells when changing spreadsheet print settings.

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
rules. Preserve the original Example B printed rows, including separate safety
items. The user later requested consolidating all on-screen tasks into the most
similar existing categories; that screen request supersedes separate single-task
cards, not the saved individual task values. A mixed category must not become
fully covered merely because the display is grouped.

Asset-dependent print markup tests need the same JSX and asset transformations
as the application. Raw Node rendering may fail on SVG imports or use a
different JSX runtime before it ever checks the form data.

**Why:** Direct component imports and an asset-only loader both failed despite
the application and actual PDF exports rendering correctly.

**How to apply:** Render these components through the app’s bundling transforms
in isolated tests; avoid global React shims or replacing the actual branding.
Keep the test cache separate from the live preview and disable unnecessary
dependency discovery so closing a short-lived renderer does not interrupt a scan.
