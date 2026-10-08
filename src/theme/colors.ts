/**
 * Brand color constants shared across screens. Sourced from the Figma exports
 * "01 - Login" and "02 - Projektübersicht" / "04 - Postfach".
 */
export const colors = {
  /** Signal color for buttons, links, FABs and active tab icons. */
  brandOrange: '#E85A1A',
  /** App background. */
  warmCream: '#F5F2EB',
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

export type ColorName = keyof typeof colors;

/**
 * Palette for user avatar badges. Assigned per-user via
 * `profiles.avatar_color`; this array is only the set of choices offered
 * when a user picks/receives a color, not a lookup table.
 */
export const avatarColors = [
  '#6249FF',
  '#1A9D00',
  '#E85A1A',
  '#2C2C2C',
  '#8E8D8F',
  '#FF5252',
] as const;
