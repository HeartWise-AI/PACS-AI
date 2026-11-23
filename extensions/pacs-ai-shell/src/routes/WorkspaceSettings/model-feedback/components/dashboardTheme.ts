import { useEffect, useRef, useState } from 'react';

/** Colours of the Model Feedback dashboard (Figure 3b). */
export const FEEDBACK_COLORS = {
  up: '#8DB61C',
  down: '#E5484D',
  // Accent from @pacs-ai/theme `colors.primary`.
  accent: '#C8F469',
  // Ink for values and labels on the dark cards.
  grid: 'rgba(255,255,255,0.08)',
  axis: 'rgba(255,255,255,0.45)',
  threshold: 'rgba(255,255,255,0.45)',
  surface: '#1A1D1A',
};

export const cardClassName = 'rounded-xl border border-white/10 bg-white/[0.03] p-5';
export const cardTitleClassName =
  'text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70';
export const cardSubtitleClassName = 'mt-1 text-[13px] text-white/55';

/** Percent with one decimal: 0.781 → "78.1%"; null → "—". */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || Number.isNaN(value)
    ? '—'
    : `${(value * 100).toFixed(digits)}%`;
}

/** A signed number with an arrow glyph so direction never rests on colour: "▲4.2". */
export function formatDelta(value: number, digits = 1): string {
  const rounded = Number(Math.abs(value).toFixed(digits));
  if (rounded === 0) {
    return `±${(0).toFixed(digits)}`;
  }
  return `${value > 0 ? '▲' : '▼'}${rounded.toFixed(digits)}`;
}

export function deltaClassName(value: number | null): string {
  if (value === null || Number(Math.abs(value).toFixed(1)) === 0) {
    return 'text-white/55';
  }
  return value > 0 ? 'text-[#C8F469]' : 'text-[#F2777B]';
}

/** "3 Aug" in English, "3 août" in French. */
export function shortDate(date: Date, language?: string): string {
  const locale = language?.toLowerCase().startsWith('fr') ? 'fr-CA' : 'en-GB';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
}

export function longDate(date: Date, language?: string): string {
  const locale = language?.toLowerCase().startsWith('fr') ? 'fr-CA' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** "2h ago" from unix seconds. */
export function relativeTime(seconds: number, now: Date, language?: string): string {
  if (!seconds) {
    return '—';
  }
  const locale = language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'narrow' });
  const diff = seconds - now.getTime() / 1000;
  const abs = Math.abs(diff);
  if (abs < 3600) {
    return format.format(Math.round(diff / 60), 'minute');
  }
  if (abs < 86400) {
    return format.format(Math.round(diff / 3600), 'hour');
  }
  if (abs < 86400 * 60) {
    return format.format(Math.round(diff / 86400), 'day');
  }
  return format.format(Math.round(diff / (86400 * 30)), 'month');
}

/** The rendered width of an element; a fallback until measured (and in jsdom). */
export function useMeasuredWidth<T extends HTMLElement>(fallback = 800) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const next = element.getBoundingClientRect().width;
      if (next > 0) {
        setWidth(Math.round(next));
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A bar path with a 4px rounded data end and a square baseline end. */
export function barPath(
  x: number,
  width: number,
  baseline: number,
  end: number,
  radius = 4
): string {
  const height = Math.abs(end - baseline);
  if (height <= 0) {
    return '';
  }
  const r = Math.min(radius, width / 2, height);
  const up = end < baseline;
  const right = x + width;
  if (up) {
    return `M${x},${baseline}V${end + r}Q${x},${end} ${x + r},${end}H${right - r}Q${right},${end} ${right},${end + r}V${baseline}Z`;
  }
  return `M${x},${baseline}V${end - r}Q${x},${end} ${x + r},${end}H${right - r}Q${right},${end} ${right},${end - r}V${baseline}Z`;
}
