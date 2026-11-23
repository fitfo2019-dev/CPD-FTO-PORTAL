# Source component inventory

Source: `artifacts/mockup-sandbox/src/components/mockups/ResourceLibraryPreview.tsx`.
This monolithic source defines inline visual families, not an exported primitive
library. The inventory normalizes those same five families into controlled
components; product resources, filtering and selection state stay in consumers.
Every family has one source consumer. Order follows visible source composition.
No official logo asset exists in this source; its mark is Lucide ShieldCheck.

| Family | Build reference | Dependencies | Chunk | Status |
|---|---|---|---|---|
| Library navigation | [library-navigation](components/library-navigation.md) | React, Lucide | Pilot | implemented |
| Search controls | [search-controls](components/search-controls.md) | React, Lucide | Pilot | implemented |
| Resource card | [resource-card](components/resource-card.md) | React, Lucide | Pilot | implemented |
| Resource drawer | [resource-drawer](components/resource-drawer.md) | Resource type, React, Lucide | Pilot | implemented |
| Empty state | [empty-state](components/empty-state.md) | React, Lucide | Pilot | implemented |

The pilot is the complete extracted family inventory. There are no later chunks.
The scaffold-only catalog was removed **inside this new package only**. The
portal and sandbox component catalogs are unchanged.

Verification: each module has one lazy-loaded family story and is represented on
the Overview. Typecheck/build and screenshot results are reported in chat.
Interactive source behaviors are covered by local checks before presentation.
