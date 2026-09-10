// ToGo mobile design tokens — a quiet, neutral system.
//
// Principles: a neutral off-white background, white surfaces, near-black primary
// text, forest-green for actions, and lime used sparingly (selected state only).
// No widespread mint tint; separators and hairlines carry structure instead of
// stacked cards and heavy shadows. Values are logical RN units, not screenshot pixels.

export const colors = {
  // Brand / action greens
  forest900: '#12241a',
  forest800: '#1a3324',
  forest700: '#1f4d31', // primary action
  forest600: '#2a6640',
  forest500: '#3c7a52',
  forest200: '#c3d4c8',
  forest100: '#e4ebe6', // quiet neutral-green tint (use sparingly)
  forest50: '#f1f4f1',  // barely-there tint for pressed/selected backgrounds
  // Lime accent — selection / primary emphasis only
  lime600: '#6aa30c',
  lime500: '#7cc00d',
  lime400: '#a3e635',
  lime300: '#bef264',
  lime200: '#d9f99d',
  lime100: '#eaf2d8',
  lime50: '#f4f8ea',
  // Neutral surfaces (off-white ground, white cards)
  bg: '#f4f4f2',
  surface: '#ffffff',
  surfaceAlt: '#efefec',
  white: '#ffffff',
  // Neutral text ramp (near-black → muted)
  ink: '#18191b',      // primary text
  inkSoft: '#40444a',  // secondary text
  muted: '#6c7075',    // tertiary / meta (>= 4.5:1 on white)
  // Structure
  separator: '#e6e7e3',
  border: '#d7d9d4',
  // Status (restrained)
  amber600: '#b6790f',
  amber100: '#f6ecd4',
  amber800: '#7a4d05',
  red600: '#c53b3b',
  red100: '#f7e2e2',
  red700: '#9c2b2b',
  blue100: '#dbe7f5',
  blue800: '#20487e',
  // Schematic map surface (neutral, faintly green)
  mapBase: '#eceeea',
  mapLine: '#cdd6cf',
  // Legacy warm-name aliases kept pointing at neutral values (back-compat)
  sand50: '#fbfbfa',
  sand100: '#f4f4f2',
  sand200: '#e9e9e6',
};

// Spacing scale: 4, 8, 12, 16, 24, 32. Screen padding is 20 (SCREEN).
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const SCREEN = 20;

// Corners: 12–16 for ordinary surfaces; larger only for the main sheet.
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999 };

export const font = {
  time: 34,   // prominent times (30–36)
  h1: 26,     // screen titles (24–28)
  h2: 20,
  title: 17,
  body: 16,   // body text (16–17)
  small: 14,  // secondary (13–14)
  tiny: 12,   // labels / meta
};

// Comfortable control + touch-target heights (48–52).
export const control = { height: 50, small: 44 };
export const HIT = { minHeight: 48, minWidth: 48 };

// Restrained elevation — a single soft shadow, used only where a surface must lift.
export const shadow = {
  card: {
    shadowColor: '#0b1a10',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sheet: {
    shadowColor: '#0b1a10',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
};
