/**
 * Chart colours.
 *
 * Lightweight Charts needs literal colour strings rather than CSS variables, so
 * the terminal's palette is mirrored here. Keep these in step with the tokens in
 * `globals.css` — nothing else should hard-code a chart colour.
 */
export const CHART_COLORS = {
  accent: "#4cb9e8",
  teal: "#3bb0a6",
  amber: "#c9883c",
  violet: "#8e86d6",
  bear: "#ff5a68",
  bull: "#2dd49a",
  slate: "#6f8fbf",
  gold: "#bfa74e",
} as const;

/** Multi-series ordering, chosen so adjacent lines stay distinguishable. */
export const SERIES_PALETTE = [
  CHART_COLORS.accent,
  CHART_COLORS.teal,
  CHART_COLORS.amber,
  CHART_COLORS.violet,
  CHART_COLORS.bear,
  CHART_COLORS.slate,
  CHART_COLORS.gold,
];
