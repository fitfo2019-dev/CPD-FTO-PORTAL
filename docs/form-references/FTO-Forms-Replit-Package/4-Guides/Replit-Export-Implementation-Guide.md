# Field Training Office Forms: Replit Export Implementation Guide

Use the 17-page review PDF as the design reference and the individual PDFs as form-by-form acceptance samples. The PDFs are static design proofs populated with the existing fictional records. The application must generate the same layout from live record data rather than using these PDFs as backgrounds or templates with baked-in values.

## Copy and paste into Replit Agent

> Update the existing Field Training Officer Portal export code for all 17 forms. Use the attached review PDF and individual PDFs as layout references. Make the changes in the project, generate test exports, and verify the actual PDFs before reporting completion. **Every individual form export must be exactly one page. The all-forms packet must be exactly 17 pages for these fixtures.**
>
> **Inventory first.** Locate the print routes, export actions, existing renderers, data model, brand assets, and form versions. Map one stable export key to each form and variant. In particular, do not merge the standalone and supplemental Building Search exports: both print `U-10.190`, but the supplemental form binds to a related primary run. Keep the existing filenames and form IDs where consumers depend on them.
>
> **Centralize the print shell.** Implement a shared masthead, form-title block, metadata grid, checklist card, reference/narrative panel, table, notes or signature block, and footer. Store sizes and colors centrally. Let each form supply its own content, variant, and section plan. Update the print/export surface rather than replacing the app screens, record storage, workflows, or export controls.
>
> **Retain exact source semantics.** Read saved records through the existing data adapters. Keep existing checkbox states, including partially completed and not applicable, as distinct states. Keep ratings, counts, reviewed-only logic, notes, references, assignment fields, date/time values, draft and signature notices, and form/revision identifiers unchanged. Preserve a blank as blank, zero as zero, and “Not recorded” as “Not recorded.” Do not hard-code the fictional proof data or infer approval from a printed name or signature sample.
>
> **Enforce the one-page contract before download.** Give sections intrinsic height, span long headings across more width, use the approved compact variant for dense checklists, and reserve the footer area. Do not rely on browser auto-shrink, hidden overflow, text ellipses, or continuation pages. If a live record still cannot fit without clipping, show a specific export validation message and keep the record unchanged. If the app already supports a separately exported narrative continuation form, preserve that workflow and its cross-reference; do not append a second page to the original form automatically.
>
> **Pilot and roll out.** Implement one moderate run form, the dense Arrest Process form, one landscape rating summary, and the Weekly Packet Acknowledgement first. Compare their rendered PDFs with the reference. Then apply the shared components and per-form layout configuration to the rest. Complete the regression and page-count checks below before calling the work done.

## Layout specification

| Element | Target for the export |
| --- | --- |
| Paper | US Letter portrait, 612 × 792 pt, for 14 forms. US Letter landscape, 792 × 612 pt, for the Daily Performance Log, Weekly Performance Summary, and Monthly Performance Summary. |
| Insets | 30 pt left and right, with the top rule at about 25 pt. Reserve a bottom zone for the existing status notice and the badge. Use a 552 pt content width in portrait and 732 pt in landscape. |
| Masthead | City wordmark upper left, around 122 × 28 pt; vertical separator around x = 164 pt; division and office stacked beside it. Color patch upper right, fitted proportionally into about 32 × 50 pt. Keep the actual template revision date by form. |
| Footer | Silver badge at bottom left, fitted proportionally into about 32 × 42 pt. Start notice text around x = 74 pt, with a line above and room for two lines if needed. Never place the larger badge behind text. |
| Type | Lato or a bundled equivalent. Form titles about 21 pt; section headings 9.5–11 pt; most checklist text about 9–10.5 pt. Use the compact proof for dense forms rather than shrinking every form or changing the paper size. |
| Color | Navy `#122D4C`, ink `#1C2631`, secondary text `#435468`, border `#AAB7C3`, section fill `#EEF3F7`, thin gold top accent `#CC9E47`. Keep rating codes readable without color. |
| Cards | About 6–8 pt between cards. Let band height grow with wrapped titles. Align top and bottom edges within each row, but don't stretch every row to the same height. Wider cards belong to longer sections. Indent wrapped lines to the text, not to the box. |
| Dense run metadata | Use a short staff strip, a compact incident grid, then a status strip and checklist key. Allow a full-width row only when additional activity actually prints. Avoid narrow cells that wrap a label when that row can instead be redistributed. |
| Supporting details | In run forms, put training materials and the run or related-primary narrative side by side below the main checklist. Preserve the original narrative heading and linked record reference. |
| Rating tables | Keep the NO / A / RT / UA / NRT order and all actual selections or counts in their corresponding columns. Keep landscape orientation, visible column labels, and separate performance and activity sections. |
| Writing areas | Keep the weekly log's printed lines and the acknowledgement's three comment/signature areas. Do not replace the certificate-signing notice with a claim that a browser export was signed. |

## Wiring it into the export

1. **Use a form registry.** A registry entry should map a stable form key to its data adapter, orientation, layout variant, and print component. Add a distinct variant key for supplemental Building Search even though the form number is shared. For a batch export, generate each configured page in source order and merge the pages, or render a packet route that is tested to honor mixed page orientation. Do not set one global print orientation for the whole packet.
2. **Keep paper size in one place.** For Chromium-based exports, use page CSS such as `@page { size: letter portrait; margin: 0; }`, with the layout insets inside the page component. Use a landscape route or per-document page style for the three landscape forms. Avoid adding page insets both in the CSS and in the PDF renderer.
3. **Wait for assets before printing.** Bundle the fonts and three approved brand assets in the app. Wait for the document's fonts and images before PDF rendering. In a Chromium renderer, use `preferCSSPageSize: true`, `printBackground: true`, `displayHeaderFooter: false`, `scale: 1`, and zero additional renderer margins where supported. Keep text as text, not as a screenshot of the page.
4. **Measure before and verify after.** Measure against the print layout with the loaded fonts. Try the approved compact style where needed and fail explicitly if content will not fit. Then render the complete PDF and check its actual page count and dimensions before serving it. Do not use `pageRanges: '1'` to make an overflowing output appear to pass.
5. **Keep the current data layer.** Build view models from the saved record. Pass real flags, values, labels, and references to the print components. Make the layout changes independent of the database, evaluation rules, and signed or exported record history.

```js
// Illustrative Chromium sequence. Adapt to the existing export implementation.
const spec = formRegistry[formKey];
await page.goto(renderUrl, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all(Array.from(document.images, image => image.decode()));
});
await assertPrintLayoutFits(page, spec); // Compare measured content with its reserved regions.

const pdfBytes = await page.pdf({
  preferCSSPageSize: true,
  printBackground: true,
  displayHeaderFooter: false,
  scale: 1,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await assertPdfPageCountAndSize(pdfBytes, 1, spec.orientation);
return pdfBytes;
```

## Acceptance checks

- **Page count and orientation:** Assert exactly one page for each individual route and 17 pages for the fixture packet. Assert 14 portrait and three landscape pages. Reject an extra page rather than trimming it.
- **Coverage:** Check that all required strings, form numbers, matched record references, notes, and the four distinct checklist concepts (checked, unchecked, partial, not applicable) remain present where applicable. Include the partial and unchecked examples in Call for Service and the partially checked Arrest Process row.
- **Table truth:** Compare each rating cell by category and rating code, not just by total count of marks. Compare activity totals separately. The fixture intentionally shows unreviewed daily values and summary counts; do not reconcile them by changing the calculation.
- **Visual quality:** Compare print renders of all 17 fixtures at actual Letter size. Test long names, long notes, missing optional fields, and a black-and-white print. Watch the Arrest Process wrapped heading, the dense stop and search checklists, and the three signature rows for overlap.
- **Record history:** The fictional packet is a visual reference. Test that the new template leaves saved records, legacy exports, review states, and certificate-based signature status unchanged.

## Further improvements to consider

- **Make the two Building Search variants easier to distinguish.** The ZIP names them `Primary` and `Supplement` without changing their official printed title. Consider an approved secondary label on the supplemental form, while retaining its existing “Related run” and “Primary run” fields.
- **Make status and signatures harder to misread.** Consider an explicit appearance for “local draft,” “reviewed on this device,” and “signed” using both text and visual styling. Only show a verified signed status when the application has actual signature evidence.
- **Review default-checked workflows separately from design.** An untouched checked row can be mistaken for a reviewed row. Consider requiring an explicit review action or distinguishing default checks from confirmed checks, with approval before changing any workflow.
- **Clean up terminology only after owner review.** Confirm whether “Solve Citation/Summons*” is the approved label and whether the asterisk has a corresponding note. The layout proofs retain the source wording rather than inventing a definition or changing official terminology.
- **Add automated PDF regression fixtures.** Keep a fictional record for each variant and a separate stress fixture for unusually long fields. Fail the build if a form exceeds one page, a rating cell changes position, text falls outside its region, or required notices disappear.
- **Treat accessibility as a separate release check.** Verify text selection, keyboard and screen-reader order where supported, contrast in grayscale, and programmatic associations between fields, labels, and table headers. The reference PDFs are static layout proofs, not verified tagged or accessible PDFs.

## Rebuild addendum (design-only, November 25, 2026)

Approved rebuild decisions that will change exports. The full text is in `docs/REBUILD_SPECIFICATION.md` in the Replit repository. None of it is implemented yet. The one-page US Letter rule, the 0.5-inch margins and the insignia rules above still apply.

- **Page tags:** every page in a daily packet carries W#D#P# (FTO week, worked day within the week, page).
  - P1 is Reporting for Duty.
  - On W1D1 of a phase, P1 is Substation Orientation, P2 is Reporting for Duty, and runs start at P3.
  - Supplements get their own P#. The Daily Log is unnumbered.
- **Overflow pages:** narrative text that does not fit prints on a Narrative Addition page. Weekly log text that does not fit prints on a Weekly Log Addition page. Each is its own one-page sheet within the margins.
- **Activity rows:** use the 27-row list from the original Excel workbook. Solve Citation/Summons, Arrest Process Forms and Completed Payouts are removed. Saved records that use them stay readable.
- **Workbook:** one workbook per PO per phase, with W#D# day tabs (Limbo days labelled), W# Summary tabs and a Phase Total. It replaces the 4-tab monthly workbook.
- **Week 15:** the two release statements print exactly as written in the 2026 FTO Manual, with the PO's last name filled in.
- **Ratings:** RT cells stay hatched for categories 1, 6-7 and 18-24.
