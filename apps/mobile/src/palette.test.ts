import { describe, expect, it } from 'vitest';
import { dark, light, type Colors } from './palette';

// WCAG 2.2 relative luminance and contrast ratio for #rrggbb colours.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// [text, background] pairs the screens actually use, each needing 4.5:1 (AA body text).
const PAIRS: [keyof Colors, keyof Colors][] = [
  ['ink', 'bg'], ['ink', 'surface'], ['inkSoft', 'surface'], ['muted', 'surface'], ['muted', 'bg'],
  ['forest700', 'surface'], ['forest700', 'bg'], ['white', 'primary'],
  ['forest800', 'forest100'], ['amber800', 'amber100'], ['red700', 'red100'], ['red700', 'surface'],
  ['blue800', 'blue100'], ['inkSoft', 'surfaceAlt'], ['ink', 'thumb'], ['white', 'forest900'], ['onInverse', 'inverse'], ['forest700', 'forest100'], ['red700', 'red100'],
];

describe.each([['light', light], ['dark', dark]] as const)('%s palette', (_name, c) => {
  it.each(PAIRS)('%s on %s is readable', (fg, bg) => {
    expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it('defines every token', () => {
    expect(Object.keys(c).sort()).toEqual(Object.keys(light).sort());
  });
});
