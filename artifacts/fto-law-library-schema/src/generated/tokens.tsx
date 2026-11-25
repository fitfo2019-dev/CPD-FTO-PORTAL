/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "primary": "#4f55a5",
      "secondary": "#eeeffb",
      "accent": "#f0f1fb",
      "background": "#f4f6fa",
      "foreground": "#20283c",
      "card": "#ffffff",
      "cardForeground": "#29334d",
      "popover": "#fbfcfe",
      "popoverForeground": "#28314a",
      "primaryForeground": "#ffffff",
      "secondaryForeground": "#4f55a5",
      "muted": "#f8f9fb",
      "mutedForeground": "#768096",
      "accentForeground": "#555d9d",
      "destructive": "#ae3b45",
      "destructiveForeground": "#ffffff",
      "border": "#e1e5ed",
      "input": "#e2e6ee",
      "ring": "#777dc1",
      "chart1": "#4f55a5",
      "chart2": "#397e82",
      "chart3": "#9b7032",
      "chart4": "#91669e",
      "chart5": "#61724b",
      "sidebar": "#fbfcfe",
      "sidebarForeground": "#667087",
      "sidebarBorder": "#e1e5ed",
      "sidebarPrimary": "#4f55a5",
      "sidebarPrimaryForeground": "#ffffff",
      "sidebarAccent": "#eeeffb",
      "sidebarAccentForeground": "#4f55a5",
      "sidebarRing": "#777dc1"
    },
    "dark": {
      "primary": "#b2b7ff",
      "secondary": "#292d4b",
      "accent": "#252b43",
      "background": "#151925",
      "foreground": "#e4e8f2",
      "card": "#1d2332",
      "cardForeground": "#e4e8f2",
      "popover": "#202638",
      "popoverForeground": "#e4e8f2",
      "primaryForeground": "#1d2042",
      "secondaryForeground": "#d6d9ff",
      "muted": "#202638",
      "mutedForeground": "#b0b9cd",
      "accentForeground": "#c9cefb",
      "destructive": "#ffabb3",
      "destructiveForeground": "#48151f",
      "border": "#394258",
      "input": "#46516b",
      "ring": "#a7adff",
      "chart1": "#b2b7ff",
      "chart2": "#80cece",
      "chart3": "#e4bd7f",
      "chart4": "#d8aae5",
      "chart5": "#b7cb98",
      "sidebar": "#1a1f2e",
      "sidebarForeground": "#b0b9cd",
      "sidebarBorder": "#394258",
      "sidebarPrimary": "#b2b7ff",
      "sidebarPrimaryForeground": "#1d2042",
      "sidebarAccent": "#292d4b",
      "sidebarAccentForeground": "#d6d9ff",
      "sidebarRing": "#a7adff"
    }
  },
  "fontFamily": {
    "heading": [
      "Manrope",
      "sans-serif"
    ],
    "sans": [
      "DM Sans",
      "sans-serif"
    ],
    "serif": [
      "Georgia",
      "serif"
    ],
    "mono": [
      "DM Mono",
      "monospace"
    ]
  },
  "radius": "0.5rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
