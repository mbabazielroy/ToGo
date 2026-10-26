// ToGo mobile design tokens.
//
// Transit-inspired: calm light-grey canvas, white cards, bold tabular times, and a
// vivid green brand used for primary actions, "live" signals and selected states.
// Each operator gets its own line colour (see src/lib/lines.ts) the way transit
// apps colour routes. Values are logical RN units.

export const colors = {
  // Grouped-list system backgrounds
  bg: '#f2f2f7',        // grouped background (screens)
  surface: '#ffffff',   // cells / cards
  surfaceAlt: '#e7e7ec', // segmented tracks, subtle fills
  white: '#ffffff',

  // Text ramp (near-black → readable greys; kept above ~4.5:1 on white)
  ink: '#111114',       // primary label
  inkSoft: '#3c3c43',   // secondary label
  muted: '#6c6c72',     // tertiary label (still readable)
  faint: '#b3b3ba',     // chevrons / decorative only

  // Structure
  separator: '#c9c9ce',
  border: '#c9c9ce',

  // Forest accent (primary actions, tint, selected)
  forest900: '#0b2e1c', // hero surfaces (next-trip card, crew header)
  forest800: '#0f3d25',
  forest700: '#0c7a43', // primary / tint (AA with white text)
  forest600: '#0f8f4f',
  forest500: '#13a85c', // live / bright accent
  forest200: '#b6e3c8',
  forest100: '#e1f4e8', // subtle green tint (status only)
  forest50: '#eeeef1',  // neutral pressed highlight
  live: '#13a85c',
  onDark: '#ffffff',
  onDarkSoft: 'rgba(255,255,255,0.72)',

  // Legacy lime tokens retained for back-compat but no longer used as fills
  lime600: '#5f8f10', lime500: '#6f9f14', lime400: '#89b93a', lime300: '#a9cf6a',
  lime200: '#cfe4a6', lime100: '#e6efd4', lime50: '#f2f6e8',

  // Status (muted, iOS-like)
  amber600: '#a86a00', amber100: '#f6ecd6', amber800: '#7a4d05',
  red600: '#c0392b', red100: '#f7e0dd', red700: '#b3261e',
  blue100: '#e0e9f6', blue800: '#20487e',

  // Unused map tokens (kept for back-compat)
  mapBase: '#eceeea', mapLine: '#cdd6cf',
  // Warm-name aliases → neutral values (back-compat)
  sand50: '#fbfbfc', sand100: '#f2f2f7', sand200: '#e7e7ec',
};

// Spacing scale: 4, 8, 12, 16, 24, 32. Screen gutter is 16 (iOS margin).
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const SCREEN = 16;

// Corners: 10 grouped cells, 12–14 cards/buttons; larger only for sheets.
export const radius = { sm: 8, md: 10, lg: 12, xl: 14, xxl: 20, pill: 999 };

export const font = {
  time: 34,   // prominent times
  h1: 28,     // screen title (restrained large title)
  h2: 22,
  title: 17,  // nav title / row title
  body: 17,
  small: 15,  // secondary
  tiny: 13,   // footnote / caption
};

// Comfortable control + touch-target heights.
export const control = { height: 50, small: 44, row: 44 };
export const HIT = { minHeight: 44, minWidth: 44 };

// Minimal elevation — used only for floating footers / nav where layering matters.
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sheet: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -1 },
    elevation: 8,
  },
};
