---
name: Master system specification
description: User-requested standing portal guardrails for UI copy, data preservation, submissions, exports, assignment profiles, and validation.
---

# User-requested portal guardrails

The user requested that the following specification remain available as a standing instruction for future portal changes.

Maintain this directive as a permanent, continuous instruction for all code generations, component updates, and file changes while the portal is being built. Do not restrict workspace file updates, but ensure no source layouts or existing features are broken. Preserve functional, visual, and mathematical fidelity under the verified Zod 4.6.7 baseline and pnpm workspace.

## ABSOLUTE BAN ON UI TEXT LEAKAGE AND INSTRUCTION COMMENTARY
- Do not display text summaries of instructions, prompt engineering rules, or programming comments anywhere on the front-facing user interface components (e.g., text blocks saying "the fto selects no and the supplementform doesnt load" or similar must be completely avoided).
- All workflow constraints, feature toggles, and behavioral logic must execute silently behind the scenes inside background TypeScript conditional hooks. The front-facing viewport must render clean, uncluttered, production-grade screens matching the division's official printed documentation layout.

## Continuous clean-room refactoring rules
- For every current and future feature change request, automatically run a background code scan: identify any strikethrough code or deprecated component lines and swap them out for modern, actively supported methods instead of executing destructive row deletions.
- Automatically tree-shake and prune dead or unused imports from modified file header blocks, preventing asset bloat and maintaining an optimized ~1 MB core build package footprint.
- Absolutely prevent any hardcoded instruction text summaries, prompt logs, or programming notes from rendering as visual text components on the screen. All operational rules must process silently inside background TypeScript conditional hooks.

## Fixed municipal schematics and data hooks
- Website shell presentation components, sidebar navigation tabs, and control buttons (specifically "FINALIZE AND SUBMIT TO COORDINATOR") must be displayed in ALL CAPS or with the First Letter Capitalized using CSS properties, leaving the inner data input logs completely untouched.
- All exported form PDFs (U-10.181 through U-10.191) must explicitly retain the hardcoded uppercase "THE CITY OF COLUMBUS" wordmark on the left, the official full-color CPD Star Badge on the right, and strict 0.5-inch margins across all 21 PDF sheets and the horizontal 4-tab monthly Excel exporter.
- Enforce the Two-Stage Manual Submission safe-gate: Background precinct network saves write data strictly as an un-submitted local draft copy ('local_draft_pending'), hidden from the supervisor. The daily packet remains completely blocked from reaching the Coordinator's active queue until the FTO manually clicks the explicit "Finalize and Submit to Coordinator" validation button.

## Universal typography, casing, and interface separation
- Apply a strict `text-transform: uppercase` via CSS selectors across all structural portal component frames, sidebar navigation links, settings tabs, and action control buttons (specifically "FINALIZE AND SUBMIT TO COORDINATOR" and "SAVE LOCAL DRAFT").
- Completely insulate the inner field training data sheets (Forms U-10.173 through U-10.192) from uppercase string filters. User-entered narratives, plain-text editable PatrolView CAD pre-fills, and charge fields must preserve their exact raw case entry punctuation for administrative court audits.

## Geographic profiles and patrol regex indices
- All assignment strings selected at Academy self-signup map strictly to the 6-Zone 20-Precinct model: Late Watch uses a 3-digit token. Midwatch (DMW/EMW) uses a strict 4-number format always starting with a '9' (single-digit precincts 1-9 inject a '0' pad integer immediately following the leading '9', e.g., '9081D-1'). Precinct PTV specialized codes are formed by appending an '8' directly to the precinct number (e.g., '158A-1'). Midwatch never contains PTV units.
- Cache all geographic profile values permanently on the user's central profile after their initial signup. Read this array via active session cache profiles to auto-populate all daily form headers, Page 1 Reporting For Duty logs, and CAD sync matchers natively with zero double-typing required by the FTO in the cruiser. Account Settings must support manual updates for future packets while keeping historical packets safely frozen.

## Two-stage manual submission safeguards
- Background sync (stage 1): Background network synchronization or client auto-saves must write delta data frames to the central server database strictly as an un-submitted draft copy marked 'local_draft_pending' (hidden from the coordinator's review desk).
- Explicit FTO action (stage 2): The packet data stream remains blocked from reaching the Coordinator's active queue until the FTO manually clicks the explicit "Finalize and Submit to Coordinator" validation button, which executes the server-side assignment roster intersection query and locks down the packet locally ('submitted_complete').

## Performance category de-duplication
- Single-incident ceiling: Multiple unchecked task failures mapping to the same parent category row within the same individual run page are capped by the daily reducer to register a maximum of ONE deficiency tick on Form U-10.173.
- Officer safety override: Any single unchecked element inside the Officer Safety sub-matrix (Categories 18–24) acts as an absolute daily override, locking that entire category row strictly to an unacceptable performance deficiency for that shift block.
- De-duplication articulation modal: Multiple task failures consolidate into exactly one unique narrative articulation input popup window hard-pinned with its matching page token string formatting: '(W[Week]D[Day]P[Page])' (e.g., W3D2P3).

## Immutable municipal headers and print margin layouts
- Every generated document or exported PDF sheet must explicitly display the uppercase "THE CITY OF COLUMBUS" branding wordmark on the left, the official full-color CPD Star Badge on the right, and the corresponding template version tracking label: "Template revised 11/24/2026".
- Apply non-destructive 0.5-inch margins uniformly across all 21 PDF sheets and the horizontal 4-tab monthly Excel exporter. The spreadsheet tabs must enforce a strict one printed page per tab layout constraint, completely preventing cell clipping or vertical page overflow loops.

## Persistent swap-don't-delete deprecation shield
- For all continuous feature expansions, code changes, and refactoring passes, automatically trace and sweep for strikethrough code or deprecated syntax. Swap outdated methods with modern, supported equivalents instead of running destructive deletions.
- Tree-shake unused or dead imports from modified file header blocks to continuously preserve an optimized, tree-shaken ~1 MB production package build size footprint.

## Continuous pre-write sanity testing passes
- Prior to committing any workspace edits, ensure the automated 'local-history-snapshots/' visible backup utility runs its automated snapshot pass cloning our active '.replit-context.md', 'HANDOVER_MANUAL.md', and 'src/config/phaseConfiguration.ts' files into a chronologically timestamped subfolder.
- Run 'pnpm typecheck' followed by 'pnpm --filter @workspace/field-training run build' to confirm that the single-source architecture compiles with absolute zero warnings or errors.
- Regenerate the combined distribution archive at 'dist-production.zip' using 'pnpm run bundle:production', enforcing a hard stop validation rule that fails the build instantly if the final zip exceeds 26,214,400 bytes (25 MB).

**Why:** The user explicitly requested that this complete specification be retained as a persistent execution-memory instruction for future portal feature work.

**How to apply:** Treat these as user-specified project guardrails when relevant to a requested portal change; preserve raw entered data and existing saved records, and do not expand a task into unrelated feature work.
