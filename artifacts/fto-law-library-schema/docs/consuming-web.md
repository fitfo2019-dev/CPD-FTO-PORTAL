# Consuming FTO LAW LIBRARY SCHEMA

Apply only after user approval. This is not an application migration by itself.

```sh
pnpm --filter <consumer-package> add @workspace/fto-law-library-schema@workspace:*
```

Import the generated theme once at the consumer's style entry, then family CSS:

```css
@import "@workspace/fto-law-library-schema/styles.css";
@import "@workspace/fto-law-library-schema/library.css";
```

```tsx
import {
  LibraryNavigation, SearchControls, ResourceCard, ResourceDrawer, EmptyState,
} from "@workspace/fto-law-library-schema/components/library";
import type { LibraryResource } from "@workspace/fto-law-library-schema/components/library";
```

Wrap the consuming surface in `className="fls-scope"`. The `dark` class on the
document root selects the **derived** dark palette. Keep tokens and components
imported, not copied. `ResourceDrawer` is controlled by a selected resource or
null; provide a stable close callback. It is an explicitly unavailable-document
preview, not a live document service.

Consumers own resource data, filtering, query state, authentication and routing.
The source match includes lowercase trimmed search over Reference/title/group/note
and optional alphabetical sorting. Nothing here grants backend access.
Source caption contrast needs review before broad operational use.

For approved sandbox adoption, create/use its dedicated design-system entry,
rebuild the mockup with these components under that entry, verify it, and repoint
all referring frames. Keep the original screen unchanged until that approval.
