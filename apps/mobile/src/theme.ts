// ToGo mobile design tokens, in a light and a dark palette.
//
// Transit-inspired: calm grouped background, cards a step lighter (light mode) or
// raised grey (dark mode), bold tabular times, and a green brand for primary
// actions, "live" signals and selected states. Each operator gets its own line
// colour (src/lib/lines.ts) the way transit apps colour routes.
//
// Screens read colours through hooks so they follow the system appearance, or the
// person's choice in Account → Appearance (src/appearance/AppearanceProvider.tsx):
//
//   const useStyles = makeStyles((colors) => ({ ... }));   // at module level
//   const styles = useStyles();                            // in the component
//   const colors = useColors();                            // for inline colours
//
// Text colours keep at least 4.5:1 contrast on their usual background in both
// palettes (WCAG 2.2 AA; checked in src/palette.test.ts). Values are logical RN units.

import { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

import { palettes, type AppearancePreference, type Colors, type Scheme } from './palette';

export { palettes };
export type { Colors, Scheme, AppearancePreference } from './palette';


export interface ThemeValue {
  /** The palette in use right now. */
  scheme: Scheme;
  /** What the person chose; "system" follows the phone. */
  preference: AppearancePreference;
  setPreference: (p: AppearancePreference) => void;
}

export const ThemeContext = createContext<ThemeValue>({ scheme: 'light', preference: 'system', setPreference: () => {} });

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function useColors(): Colors {
  return palettes[useContext(ThemeContext).scheme];
}

type StyleInput = Parameters<typeof StyleSheet.create>[0];

/**
 * Module-level stylesheet that follows the theme: built once per palette and
 * cached, so switching is cheap and re-renders reuse the same objects.
 */
export function makeStyles<S extends StyleInput>(build: (colors: Colors) => S & StyleInput): () => Readonly<S> {
  const cache: Partial<Record<Scheme, Readonly<S>>> = {};
  return function useStyles(): Readonly<S> {
    const { scheme } = useContext(ThemeContext);
    return (cache[scheme] ??= StyleSheet.create(build(palettes[scheme])));
  };
}

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
