# Uploaded FTO form set and export coverage

## Source policy

Operational Help content must cite the supplied FTO manual/forms or documents
published through the [Division Directives index](https://www.columbus.gov/Services/Public-Safety/Police/About-the-Columbus-Division-of-Police/Directives).
Do not present third-party explanations, inferred assignment rules, or interface
instructions as Division policy. Usability research may guide interface design,
but is not a policy source.

The newly supplied manual is `Final_FTO_Manual_updated_3-10-26`.
The associated PDFs contain editable fields, not just scanned paper.
Never execute embedded PDF actions or workbook macros during inspection.

## Required source set

| Original PDF | Pages | Field widgets | Intended use |
| --- | ---: | ---: | --- |
| Arrest Process | 3 | 69 | Conditional supplement |
| Building Search | 2 | 84 | Primary run |
| Call for Service | 2 | 65 | Primary run |
| Domestic Incident | 2 | 76 | Primary run |
| High Risk Traffic Stop | 2 | 70 | Primary run |
| OVI Process | 2 | 70 | Conditional supplement |
| Reporting for Duty | 2 | 44 | Daily |
| Self-Initiated Run / Training | 2 | 65 | Primary run |
| Substation Orientation | 2 | 91 | First day only |
| Traffic Crash Investigation | 2 | 65 | Primary run |
| Traffic Stop | 2 | 78 | Primary run |
| Weekly Comment and Signature | 1 | 16 | Weekly acknowledgement |
| Weekly Performance Log, page 1 | 1 | 65 | Weekly strengths/corrective training |
| Weekly Performance Log, continuation | 1 | 72 | Weekly continuation |

Also supplied: Daily Performance / first-week Limbo `.xlsm` workbook and updated
manual `.docx`. Narrative Addition appears as a continuation page inside multiple
run PDFs.

Run `.agents/scripts/audit-fto-form-sources.py` with Python to enumerate PDF field
names, types, positions, printed text and workbook sheet/label metadata. It also
renders original page previews. Outputs are excluded from Git and deployment.

## Current boundaries — do not describe as complete original-form exports

- The portal's print layouts cover daily reports, duty checklists, primary run
  checklists, required run supplements, and weekly acknowledgement/summary.
  They are reconstructed layouts, not filled copies of the uploaded originals.
- Existing Excel exports contain portal data and aggregates. They are not the
  supplied macro-enabled workbook with all original tabs and formulas preserved.
- Substation Orientation now has first-day local capture for the 82 checkbox
  items visible on page 1, substation/date details, directive review, and
  continuation text. The Weekly Performance Log has weekly PO filtering,
  reviewed-rating suggestions, unlimited narrative inputs, and local workbook
  rows. These remain reconstructed forms, not filled copies of the PDFs.
- Narrative Addition prints numbered U-10.192 continuation pages from the saved
  run narrative without a character limit. The page chunking is designed for
  print readability and must still be checked against each target printer.
- Incident number, location, and run-end fields exist in the data/export model
  but are not yet entered from a protected run editor or Patrol View connection.
  Missing values are not invented.
- Source-specific checklist items and other printed fields not yet represented
  still require explicit capture/mapping. Never silently omit them or infer that
  an action happened.
- Typed names and local confirmations are not identity-verified signatures.
  Never copy a previous signature to a changed form or generate a trusted
  certificate claim.
- The source files contain older 38-category lists and conflicting form numbers.
  Preserve the user's confirmed 30 categories and daily/weekly naming until a
  specific replacement is approved; do not silently rewrite existing ratings.

## Fast-entry approach

1. Enter class, PO, FTO, phase, assignment and schedule once; snapshot them into
   daily and run forms. Correcting a phase must not rewrite historical reports.
2. Keep the daily work in one shift workspace with section shortcuts.
3. Ask for the primary run once. Show supplements only when applicable.
4. Derive activity counts from reviewed, completed runs; keep manual additions
   separate to prevent double-counting.
5. Review preselected checklists in one confirmation, not one confirmation per box.
   A default is never evidence that an action occurred.
6. Use source field mappings to generate reconstructed print forms and
   continuation pages. Do not call an export a filled original form or complete
   until values, unselected checkboxes, long narratives, margins and page
   numbering have been checked.

Interface rationale: [Nielsen Norman Group, Mobile Input Fields](https://www.nngroup.com/articles/mobile-input-checklist/)
recommends removing unnecessary inputs, reusing known information, appropriate
defaults, paste support, autocomplete and automatic formatting. These practices
support reduced entry effort, but no claim of a specific time reduction is
justified without timed officer testing. This research is not operational Help.
