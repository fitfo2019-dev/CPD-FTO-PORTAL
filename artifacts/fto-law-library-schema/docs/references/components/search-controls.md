# Search controls

- Source: `artifacts/mockup-sandbox/src/components/mockups/ResourceLibraryPreview.tsx:19-28,41,61`.
- Source behavior: controlled query; source consumer matches lowercased trimmed
  Reference/title/group/note text. Boolean `sort` toggles an alphabetical view;
  its displayed label is Filter when off and A–Z when on.
- Export: `SearchControls`, `SearchControlsProps`.
- Dependencies: React, Lucide. No backend calls and no new filter menu.
- Fidelity: search shell 12px padding/10px radius; 39px input and button height;
  6px control radius; source search icon, placeholder, focus border and halo.
- Added disabled story is an explicitly documented reusable control state.
- Consumer owns filtered data; this primitive emits query/sort callbacks only.
