/**
 * Brand color constants shared across screens. Sourced from the Figma exports
 * "01 - Login" and "02 - Projektübersicht" / "04 - Postfach".
 */
export const lightColors = {
  /** Signal color for buttons, links, FABs and active tab icons. */
  brandOrange: '#E85A1A',
  /** App background. */
  warmCream: '#F5F2EB',
  /** Cards, sheets, inputs and other raised surfaces. */
  surface: '#FFFFFF',
  /** Text/icons on top of brandOrange or other saturated fills; identical in both themes. */
  onBrand: '#FFFFFF',
  /** Primary text color. */
  ink: '#2C2C2C',
  /** Secondary text (dates, section labels, inactive icons). */
  textMuted: '#8E8D8F',
  /** Placeholder text / lighter inactive icons. */
  textMutedLight: '#A2A2A2',
  /** Hairline dividers. */
  borderLight: '#E0DAD0',

  /** Priority badge — high. */
  priorityHighText: '#FF5252',
  priorityHighBg: 'rgba(255, 0, 0, 0.2)',
  /** Priority badge — medium. */
  priorityMediumText: '#2C2C2C',
  priorityMediumBg: 'rgba(247, 255, 29, 0.5)',
  /** Priority badge — low. */
  priorityLowText: '#1A9D00',
  priorityLowBg: 'rgba(123, 255, 66, 0.3)',

  /** Phase progress bar. */
  phaseActive: '#E8520A',
  phaseDone: '#006E10',
  phaseUpcoming: '#DFDFDF',

  /** Phase badge — Briefing. */
  phaseBriefingText: '#2C6ADE',
  phaseBriefingBg: 'rgba(44, 106, 222, 0.12)',
  /** Phase badge — Planung. */
  phasePlanungText: '#6249FF',
  phasePlanungBg: 'rgba(98, 73, 255, 0.14)',
  /** Phase badge — Umsetzung. */
  phaseUmsetzungText: '#E8520A',
  phaseUmsetzungBg: 'rgba(232, 82, 10, 0.14)',
  /** Phase badge — Review. */
  phaseReviewText: '#B8860B',
  phaseReviewBg: 'rgba(247, 190, 29, 0.25)',
  /** Phase badge — Abschluss. */
  phaseAbschlussText: '#006E10',
  phaseAbschlussBg: 'rgba(26, 157, 0, 0.14)',
  /** Phase badge — fallback for unrecognized phase names. */
  phaseNeutralText: '#8E8D8F',
  phaseNeutralBg: 'rgba(142, 141, 143, 0.14)',
} as const;

/** Semantic color set; every theme provides a value for each name. */
export type Palette = { [K in keyof typeof lightColors]: string };
export type ColorName = keyof Palette;

export const darkColors: Palette = {
  brandOrange: '#EE6422',
  warmCream: '#151412',
  surface: '#211F1D',
  onBrand: '#FFFFFF',
  ink: '#F2EFE9',
  textMuted: '#9B9A9C',
  textMutedLight: '#706F72',
  borderLight: '#363330',

  priorityHighText: '#FF6B6B',
  priorityHighBg: 'rgba(255, 82, 82, 0.2)',
  priorityMediumText: '#F2E45C',
  priorityMediumBg: 'rgba(247, 255, 29, 0.15)',
  priorityLowText: '#5BD143',
  priorityLowBg: 'rgba(123, 255, 66, 0.15)',

  phaseActive: '#EE6422',
  phaseDone: '#2FA84A',
  phaseUpcoming: '#3A3835',

  phaseBriefingText: '#7BA4FF',
  phaseBriefingBg: 'rgba(92, 140, 255, 0.2)',
  phasePlanungText: '#9C8DFF',
  phasePlanungBg: 'rgba(130, 110, 255, 0.2)',
  phaseUmsetzungText: '#FF7F45',
  phaseUmsetzungBg: 'rgba(255, 110, 50, 0.2)',
  phaseReviewText: '#E3B336',
  phaseReviewBg: 'rgba(247, 190, 29, 0.2)',
  phaseAbschlussText: '#4CC463',
  phaseAbschlussBg: 'rgba(60, 200, 80, 0.18)',
  phaseNeutralText: '#9B9A9C',
  phaseNeutralBg: 'rgba(155, 154, 156, 0.18)',
};

/** Light palette; kept under the old name for non-themed code. */
export const colors: Palette = lightColors;

/** `#RRGGBB` → `rgba(r, g, b, alpha)`. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Palette for user avatar badges. The database assigns one to every new
 * profile (see supabase/avatar-colors.sql, which must list the same values)
 * and it never changes afterwards. All entries keep white initials readable
 * (contrast of at least 4.5:1), so only darker tones belong here. Orange
 * is reserved for the app's accent color and must not be used.
 */
export const avatarColors = [
  '#B3261E',
  '#3F6212',
  '#0369A1',
  '#15803D',
  '#0F766E',
  '#0E7490',
  '#1D4ED8',
  '#4338CA',
  '#6D28D9',
  '#A21CAF',
  '#BE185D',
  '#475569',
] as const;

/** Used when a profile has no color (e.g. a deleted user); also readable with white text. */
export const avatarFallbackColor = '#475569';
