// ToGo mobile design tokens — deep green, warm white, lime accents (matches web).
export const colors = {
  forest900: '#0f2619',
  forest800: '#173a26',
  forest700: '#1f4d31', // primary
  forest600: '#2a6640',
  forest500: '#3a7f51',
  forest200: '#bbd9c2',
  forest100: '#dcecdf',
  forest50: '#f0f7f2',
  lime400: '#a3e635',
  lime300: '#bef264',
  lime200: '#d9f99d',
  lime100: '#ecfccb',
  lime50: '#f7fee7',
  sand100: '#f5f2e9',
  sand50: '#fbfaf6',
  sand200: '#eae4d3',
  white: '#ffffff',
  ink: '#173a26',
  muted: '#5c9d70',
  red600: '#dc2626',
  red100: '#fee2e2',
  red700: '#b91c1c',
  amber100: '#fef3c7',
  amber800: '#92400e',
  blue100: '#dbeafe',
  blue800: '#1e40af',
  border: '#bbd9c2',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
export const font = {
  h1: 26,
  h2: 20,
  title: 17,
  body: 15,
  small: 13,
  tiny: 11,
};

/** UGX + Kampala-time formatters live in shared @shared/lib/time; this is only visual. */
export const shadow = {
  card: {
    shadowColor: '#0f2619',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};
