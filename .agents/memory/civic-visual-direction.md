---
name: Civic visual direction
description: The requested Columbus public-service visual reference and portal branding.
---

The user renamed the site “Field Training Officer Portal.” Use the Columbus public police page's navy masthead, blue navigation and content accents, a restrained red active indicator, and white and light-gray surfaces. The City logo belongs on the left, the site name in the middle, and the supplied badge and patch on the right. The badge is silver; the patch eagle is white, while the rest of the patch retains its colors and transparent background. Keep the City logo's “US” red in day mode and blue in dark mode. The “Division of Police: Field Training Officer Portal” masthead line is white by day and bright blue (#4da3ff) in night mode. The user supplied the exact body styling: Arial, Helvetica, sans-serif; 1em; #57575B; line-height 1.5. Preserve readable contrast in dark mode. Keep the prototype and no-approval notices distinct; do not imply agency endorsement. Preview mockups should reuse the portal's real fonts, palette, masthead assets, and shell rather than approximating them.

**Why:** The user explicitly specified the portal name, supplied the body font styling, corrected the header's asset positions, requested separate masthead text colors for day and night, and specified a white eagle on the patch. They also asked that copy-review previews match the site styling after the first mockup diverged.
Printed PDF forms follow the user's reformatted Substation Orientation PDF, which supersedes the earlier curved-band example: thin navy/gold top rule; City wordmark left; vertical divider; “DIVISION OF POLICE” above “FIELD TRAINING OFFICE” beside the wordmark; patch upper right; large navy form title; light-blue section bars; thin gray field borders; badge bottom left beside the local-copy/not-signed notice. Keep the red “US” in the City wordmark.

**Why:** The user supplied a reformatted PDF, explicitly asked to extract its design and apply it to all exported run forms, then approved the complete set of form previews. Preserve this approved direction rather than returning to the earlier letterhead experiments.

**How to apply:** Use the shared printed header on every PDF/print form and continuation page; do not imply that a locally generated copy is an approved official Division form.

The shared print family includes daily and weekly logs, weekly and monthly
summaries, acknowledgements, orientation, run forms, supplements, and
continuations—not unrelated reports or interactive screens. The reference
provides visual styling, not another form's title, fields, or column count.
Use fixed sections from the revised checklist source; answers must not hide,
merge, or reorder sections.

**Why:** The user requested uniform fixed sections, explicitly included daily
and monthly summaries/logs, and instructed that every form retain its own
content and workflow.

**How to apply:** Keep atomic saved answers intact when combining display rows.
Use shared print tokens/components, preserve landscape forms, and show actual
PDF previews before integrating layout changes.

Use a button-based popup for Traffic Violator, Solve Citation/Summons, and
Additional Forms. Unselected optional items and unnecessary attached forms
must not print.

**Why:** The user explicitly requested selectable popup buttons instead of
always-printed optional fields.

**How to apply:** Keep these optional run details separate from the fixed source
checklist sections; do not hide original tasks when an optional item is absent.

The latest requested print proportions are a 122 × 27 pt City wordmark,
32 × 50 pt upper-right patch, and 32 × 42 pt lower-left badge, all contained
without stretching. Reserve 64 pt for the masthead and 54 pt for the footer;
footer text begins at least 12 pt beyond the badge. Letter forms use 30 pt
side margins and about 25 pt top/bottom margins, with Lato, navy headings,
muted borders, light section bands, and a thin gold accent.

**Why:** The user explicitly enlarged the insignia and supplied page/type/
spacing requirements after approving the earlier, smaller-insignia design.

**How to apply:** Give assets space rather than overlapping or scaling the
whole form. Fit each form to its own content and inspect the physical PDFs.

Revision dates mean the date that form's content or layout changed, not the
date someone printed it. Preserve original agency revision markings and track
portal-template revisions separately.

**Why:** The user said “all forms revision dates are when we make changes to it”
and subsequently required preservation of the forms' original revision dates.

**How to apply:** Change the affected template revision when making edits;
never replace source agency dates with today's print date.

**How to apply:** Use this direction for future screens and components while retaining the persistent fictional-demo and not-approved notices.

Use ALL CAPS or Title Case for portal wording, keeping short connector words
such as “of” and “or” lowercase in Title Case. The user approved the Title Case
packet-control preview before integration. Titles and preview headings must use
ALL CAPS or Title Case, not sentence case.

**Why:** The user explicitly requested either all capitals or capitalization of
all words except short connector words, and reiterated, “TITLES SHOULD BE ALL CAPS OR CAPITAL FIRST LETTERS.”

**How to apply:** Preserve acronyms and identifiers; do not uppercase user-entered records.

The user likes the Law Library design-system preview's layout, but not its text
or fonts. Its color scheme must match the current portal. They do not like
"run on pages that just keep going."

**Why:** The user distinguished approval of the layout direction from approval
of the preview's typography, wording and palette.

**How to apply:** Use the layout as a reference, not an approved replacement
theme. Preserve current portal branding and avoid stacking whole forms into
one continuous page.
Website-shell controls and structural labels should display in ALL CAPS or
initial capitalization. This applies to navigation, settings headings, profile
links, dashboard controls, and action-button labels. Inner manual forms
U-10.173 through U-10.192 and user-entered narratives, CAD values, and charges
must retain their exact raw case.

**Why:** The user requested shell capitalization while explicitly protecting
non-destructive logging and administrative legal audits.

**How to apply:** Use narrowly scoped CSS presentation rules on shell elements,
not string transformations or changes to stored values. Do not let inherited
capitalization reach the manual-form sheets or their input fields. Preview
visible changes and obtain approval before integrating them.

Do not display programming commentary, developer instructions, or task summaries
on the portal's mounted screens. Selector and checkbox logic should run without
printing implementation explanations into the form.

**Why:** The user explicitly requested removal of commentary from the visible UI.

**How to apply:** Preserve functional field labels, official manual checklist
instructions, required confirmations, validation, and truthful data-status
warnings. Keep implementation details in source comments or handover documents,
not next to controls. Never alter entered text or persisted assignment values
as part of a copy cleanup.

Printed category boxes must be equal-sized and use the page area evenly while
the base form stays on one sheet. Keep tasks with their similar fixed sections.

**Why:** The user rejected uneven category boxes and unused page space, then
explicitly required all category boxes to be the same size.

**How to apply:** Keep existing task membership and saved keys; adjust the print
grid and spacing instead of creating answer-dependent categories.

Checkbox rows need clear separation and must not be crowded, even when the
category boxes are equal-sized and the base form fills one sheet.

**Why:** The user rejected the larger-type preview because the checkboxes were
too close together for easy reading.

**How to apply:** Use available space inside the cards for row spacing and
separate each checkbox from its wrapped label. Do not treat filling the page
or enlarging type alone as proof of readability.

Keep the Daily Performance Log landscape in its original layout. The monthly
Excel export must likewise remain landscape with its original worksheet layout.

**Why:** The user explicitly corrected the portrait daily redesign and added
“same with the monthly excel.”

**How to apply:** Preserve each export's original arrangement; show the actual
landscape daily PDF and a fictional monthly workbook before integration.

“Training Only” is a run classification, not a boxed task category. Show it as
an unboxed checkmark in a logical header position to distinguish PO training
from an actual run.

**Why:** The user explicitly clarified the purpose and rejected the boxed
“Header Option” presentation.

**How to apply:** Preserve the existing saved choice and review logic; keep the
marker out of task panels and carry the classification onto related run pages.

Weekly acknowledgements need evenly spaced, equally enlarged comment boxes
that use the page. Top fields must have a clear purpose and show the correct
original saved data; align corresponding signature and date fields.

**Why:** The user rejected uneven acknowledgement areas and unclear top boxes.

**How to apply:** Pair each role’s comments with that role’s signature, label
actual metadata explicitly, and keep the base acknowledgement on one sheet.
