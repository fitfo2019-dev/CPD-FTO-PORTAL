import { lazy, type ComponentType } from "react";
import { ColorsPage, FontsPage, LayoutPage, OverviewPage } from "./foundations.js";

export interface PreviewEntry { id: string; name: string; description: string; Page: ComponentType }
export interface NavGroup { name: string; entries: PreviewEntry[] }
export const DESIGN_SYSTEM = {
  title: "FTO LAW LIBRARY SCHEMA",
  description: "The visual language of field reference.",
};
export const OVERVIEW_ENTRY: PreviewEntry = {
  id: "overview", name: "Overview", description: "Source-derived foundations and five reusable families.", Page: OverviewPage,
};
export const NAV_GROUPS: NavGroup[] = [
  { name: "Colors", entries: [{ id: "colors", name: "Palette & surfaces", description: "Source light palette and derived dark counterpart.", Page: ColorsPage }] },
  { name: "Fonts", entries: [{ id: "fonts", name: "Typography", description: "Manrope, DM Sans and DM Mono.", Page: FontsPage }] },
  { name: "Layout", entries: [{ id: "layout", name: "Spacing & behavior", description: "Source geometry, states and motion.", Page: LayoutPage }] },
  { name: "Navigation", entries: [{ id: "library-navigation", name: "Library navigation", description: "Controlled collection navigation.", Page: lazy(() => import("./demos/library-navigation.js")) }] },
  { name: "Discovery", entries: [
    { id: "search-controls", name: "Search & sort", description: "Text input and source sort control.", Page: lazy(() => import("./demos/search-controls.js")) },
    { id: "resource-card", name: "Resource cards", description: "Keyboard-accessible resource selection.", Page: lazy(() => import("./demos/resource-card.js")) },
  ] },
  { name: "Overlays", entries: [{ id: "resource-drawer", name: "Resource drawer", description: "Controlled safe-preview panel.", Page: lazy(() => import("./demos/resource-drawer.js")) }] },
  { name: "Feedback", entries: [{ id: "empty-state", name: "Empty results", description: "Search recovery and collection feedback.", Page: lazy(() => import("./demos/empty-state.js")) }] },
];
export const ALL_ENTRIES = [OVERVIEW_ENTRY, ...NAV_GROUPS.flatMap(group => group.entries)];
if (new Set(ALL_ENTRIES.map(entry => entry.id)).size !== ALL_ENTRIES.length) throw new Error("Duplicate design-system page identifier.");
