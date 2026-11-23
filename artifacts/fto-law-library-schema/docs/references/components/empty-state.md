# Empty state

- Source: `artifacts/mockup-sandbox/src/components/mockups/ResourceLibraryPreview.tsx:42,65`.
- Source behavior: shown only when filtered resources are empty; offers alternate
  search/category guidance, not an authorization or server error claim.
- Export: `EmptyState`, with optional title and description.
- Dependencies: React, Lucide.
- Fidelity: dashed border, 9px radius, 48px/20px padding, 39px circular search
  tile, Manrope heading. Default source wording is preserved.
