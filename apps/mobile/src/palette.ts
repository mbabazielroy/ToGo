// The light and dark colour palettes. Plain values with no React Native imports,
// so tests can check them (src/palette.test.ts). Screens use them through the
// hooks in src/theme.ts.

export const light = {
  // Grouped-list system backgrounds
  bg: '#f2f2f7',        // grouped background (screens)
  surface: '#ffffff',   // cells / cards / inputs
  surfaceAlt: '#e7e7ec', // segmented tracks, subtle fills
  thumb: '#ffffff',     // selected segment on a surfaceAlt track
  /** Selected chips and map labels: strong fill that flips with the mode. */
  inverse: '#111114',
  onInverse: '#ffffff',
  /** Always white: text and icons on green, red or dark-green fills. */
  white: '#ffffff',

  // Text ramp (near-black → readable greys)
  ink: '#111114',       // primary label
  inkSoft: '#3c3c43',   // secondary label
  muted: '#6c6c72',     // tertiary label (still readable)
  faint: '#b3b3ba',     // chevrons / placeholders / decorative only

  // Structure
  separator: '#c9c9ce',
  border: '#c9c9ce',

  // Brand
  /** Filled primary buttons and selected chips; always carries white text. */
  primary: '#0c7a43',
  /** Brand-dark hero surfaces (next-trip card, crew header, welcome): same in both modes. */
  forest900: '#0b2e1c',
  /** Green text on a forest100 tint. */
  forest800: '#0f3d25',
  /** Tint: links, icons, active tabs, green text on the screen background. */
  forest700: '#0c7a43',
  forest600: '#0f8f4f', // switches, strength meter
  forest500: '#13a85c', // live / bright accent
  forest200: '#b6e3c8',
  forest100: '#e1f4e8', // subtle green tint (status only)
  forest50: '#eeeef1',  // neutral pressed highlight
  live: '#13a85c',
  onDark: '#ffffff',
  onDarkSoft: 'rgba(255,255,255,0.72)',

  // Status
  amber600: '#a86a00', amber100: '#f6ecd6', amber800: '#7a4d05',
  red600: '#c0392b', red100: '#f7e0dd', red700: '#b3261e',
  blue100: '#e0e9f6', blue800: '#20487e',
  /** "You are here" dot on maps. */
  blue600: '#1f5fd1',

  // Maps and overlays
  mapBase: '#e8efe9', mapLine: '#cdd6cf',
  /** Floating labels and buttons over a map. */
  overlay: 'rgba(255,255,255,0.94)',
  /** Dimmed backdrop behind sheets. */
  scrim: 'rgba(15,20,15,0.35)',
};

export type Colors = typeof light;

export const dark: Colors = {
  bg: '#000000',
  surface: '#1c1c1e',
  surfaceAlt: '#2c2c2e',
  thumb: '#5a5a5f',
  inverse: '#f5f5f7',
  onInverse: '#111114',
  white: '#ffffff',

  ink: '#f5f5f7',
  inkSoft: '#d1d1d6',
  muted: '#9a9aa1',
  faint: '#5c5c62',

  separator: '#38383a',
  border: '#48484a',

  primary: '#0c7a43',
  forest900: '#0b2e1c',
  forest800: '#8ee0b0',
  forest700: '#3ccf82',
  forest600: '#2fb86f',
  forest500: '#30d158',
  forest200: '#1f5a3a',
  forest100: '#13301f',
  forest50: '#2c2c2e',
  live: '#30d158',
  onDark: '#ffffff',
  onDarkSoft: 'rgba(255,255,255,0.72)',

  amber600: '#f0a830', amber100: '#3a2a0c', amber800: '#f5c870',
  red600: '#d0453a', red100: '#3d1714', red700: '#ff8a80',
  blue100: '#132540', blue800: '#a9c8f5',
  blue600: '#4a8af0',

  mapBase: '#1a211c', mapLine: '#33403a',
  overlay: 'rgba(28,28,30,0.94)',
  scrim: 'rgba(0,0,0,0.6)',
};

export type Scheme = 'light' | 'dark';
export type AppearancePreference = 'system' | Scheme;
export const palettes: Record<Scheme, Colors> = { light, dark };
