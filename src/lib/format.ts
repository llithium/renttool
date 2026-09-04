/** Formatting + parsing helpers, migrated from the original artifact. */
import type { RentMetric } from '$lib/types';

/** "$1,234" — rounded, no decimals. */
export function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return '$' + Math.round(n).toLocaleString();
}

/** Percent with sign, e.g. "+4.3%" / "-6.2%" / "flat". */
export function pctTrend(yoy: number | null | undefined): string {
  if (yoy == null) return '—';
  if (yoy === 0) return 'flat';
  return (yoy > 0 ? '+' : '') + yoy + '% YoY';
}

export function rentMetricLabel(metric: RentMetric, bedrooms: '1BR' | '2BR' = '1BR'): string {
  if (metric === 'estimated-median') return `Estimated median ${bedrooms} rent`;
  if (metric === 'fair-market-rent') return `${bedrooms} Fair Market Rent`;
  return `${bedrooms} rent`;
}

/** Lower only the first character when a metric label starts a sentence. */
export function sentenceLabel(label: string): string {
  return label ? label[0].toLowerCase() + label.slice(1) : label;
}

/** Population fact text for a place-level estimate. */
