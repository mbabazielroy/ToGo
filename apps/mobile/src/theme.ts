// ToGo mobile design tokens.
// Visual language inspired by everyday transit apps (map + bottom sheet, bold
// timing hierarchy, compact rows) but with ToGo's own identity:
//   deep forest green branding · warm white surfaces · lime for selection/primary
//   actions · charcoal text · restrained amber/red for service issues.
export const colors = {
  // Brand greens
  forest900: '#0f2619',
  forest800: '#173a26',
  forest700: '#1f4d31', // primary brand
  forest600: '#2a6640',
  forest500: '#3a7f51',
  forest200: '#bbd9c2',
  forest100: '#dcecdf',
  forest50: '#f0f7f2',
  // Lime accents (selection + primary action)
  lime500: '#7cc00d',
  lime400: '#a3e635',
  lime300: '#bef264',
  lime200: '#d9f99d',
  lime100: '#ecfccb',
  lime50: '#f7fee7',
  // Warm white / sand surfaces
  sand100: '#f5f2e9',
  sand50: '#fbfaf6',
  sand200: '#eae4d3',
  white: '#ffffff',
  // Charcoal text ramp
  ink: '#1b241f',       // charcoal (primary text)
  inkSoft: '#455049',   // secondary text
  muted: '#6b7a70',     // tertiary / meta text
  // Neutral structure
  separator: '#e6ebe6', // subtle hairline separators
  surfaceAlt: '#f1f4f0',
  // Service status (restrained)
  amber600: '#c77f0a',
  amber100: '#fdf0d5',
  amber800: '#7c4a03',
  red600: '#d64545',
  red100: '#fbe4e4',
  red700: '#a12f2f',
  blue100: '#dbeafe',
  blue800: '#1e40af',
  // Map schematic
  mapBase: '#eaf1ea',
  mapLine: '#c4d6c8',
  border: '#d3ddd5',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 26, pill: 999 };
export const font = {
  // Bold timing hierarchy: `time` is the large departure figure.
  time: 30,
  h1: 26,
  h2: 20,
  title: 17,
  body: 15,
  small: 13,
  tiny: 11,
};

export const shadow = {
  card: {
    shadowColor: '#0f2619',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sheet: {
    shadowColor: '#0f2619',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -3 },
    elevation: 16,
  },
};

// Minimum comfortable touch target.
export const HIT = { minHeight: 48, minWidth: 48 };
