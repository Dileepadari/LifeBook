import { useTheme } from '@/contexts/ThemeContext';

/**
 * Chart palette.
 *
 * Deliberately independent of the user's accent palette. The accent is a
 * preference and can be any of seven values; a series colour has to mean "this
 * is sleep" consistently, so repainting series when someone switches the shell
 * to Rose would break identity. Single-series charts do use the accent, because
 * there is no identity to confuse.
 *
 * Validated with the dataviz validator against this app's real surfaces
 * (light card #ffffff, dark card #181221), adjacent pairlist:
 *   light - CVD ΔE 9.1, normal-vision ΔE 22.9, contrast WARN on aqua (2.82)
 *           and yellow (2.17)
 *   dark  - CVD ΔE 8.4, normal-vision ΔE 19.8, all slots >= 3:1
 * The light-mode contrast warning is discharged by the relief rule: every
 * multi-series chart here ships a legend, a hover tooltip with named values,
 * and Analytics carries a table view - identity is never colour-alone.
 *
 * Four slots is the cap. A fifth would put yellow beside orange, which fails
 * the all-pairs floor; if this app ever needs more series, facet instead.
 */
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500'];

/** Fixed and never themed, so a status colour can never impersonate a series.
 *  Always paired with an icon or a label - never carrying meaning alone. */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

export function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return {
    dark,
    series: dark ? SERIES_DARK : SERIES_LIGHT,
    /** Single-series charts follow the accent - no identity to confuse. */
    accent: 'hsl(var(--primary))',
    grid: dark ? '#2c2c2a' : '#e1e0d9',
    axis: dark ? '#383835' : '#c3c2b7',
    muted: '#898781',
    surface: dark ? '#181221' : '#ffffff',
    text: dark ? '#ffffff' : '#0b0b0b',
    textSecondary: dark ? '#c3c2b7' : '#52514e',
    status: STATUS,
  };
}

/** Recharts axis/grid props shared by every chart, so chrome stays recessive
 *  and identical across pages. */
export function chartChrome(t: ReturnType<typeof useChartTheme>) {
  return {
    grid: { stroke: t.grid, strokeDasharray: '3 3', vertical: false },
    axis: {
      stroke: t.axis,
      tick: { fill: t.muted, fontSize: 11 },
      tickLine: false,
      axisLine: { stroke: t.axis },
    },
    tooltip: {
      contentStyle: {
        background: t.surface,
        border: `1px solid ${t.grid}`,
        borderRadius: 10,
        fontSize: 12,
        color: t.text,
        boxShadow: '0 8px 24px -12px rgba(0,0,0,0.35)',
      },
      labelStyle: { color: t.textSecondary, marginBottom: 4, fontWeight: 600 },
      cursor: { stroke: t.axis, strokeWidth: 1 },
    },
  };
}
