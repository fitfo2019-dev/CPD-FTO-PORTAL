# Migration is opt-in

No screens are migrated by this extraction. After explicit approval:

1. Read `AGENTS.md`, `consuming-web.md` and the five family references.
2. Add the workspace dependency and import the theme/family stylesheet.
3. Render one `ResourceCard` and verify the consumer build before switching UI.
4. Map existing behavior and data into the actual family props. Do not replace
   real document access with a preview-only drawer or weaken authentication.
5. For the canvas mockup, follow the mockup-sandbox design-system entry/re-homing
   workflow. Preserve the original until all referring frames use the verified
   replacement.
6. Do not delete the portal's existing UI catalog: this extracted system covers
   five law-library families, not the portal's full component set.
