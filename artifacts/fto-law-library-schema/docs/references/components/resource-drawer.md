# Resource drawer

- Source: `artifacts/mockup-sandbox/src/components/mockups/ResourceLibraryPreview.tsx:22,29,43-45,69`.
- Source behavior: controlled selected resource; closed on backdrop/close button;
  right-hand fixed inspector; unavailable content, collection metadata, explicit
  not-connected notice, disabled document-open button.
- Export: `ResourceDrawer`; `resource:null` renders no overlay.
- Dependencies: React, Lucide, resource type from the card family.
- Fidelity: maximum 430px width; full dynamic viewport height; source header,
  24px desktop/18px mobile inset; 220ms slide; reduced-motion override.
- Accessibility adaptation: Escape dismissal, Tab containment, generated title
  ID and focus restoration. No new document-access behavior.
