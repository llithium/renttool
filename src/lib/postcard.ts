import { money } from '$lib/format';
import { rentTargetFit, type HousingChoice } from '$lib/planning';

/** How a rent reads against a ceiling: the stamp's colour and the verdict line. */
export type Fit = 'within' | 'near' | 'above' | 'unknown';

export interface RentReading {
  fit: Fit;
  /** Rent as a share of the ceiling (1 = exactly at the ceiling). */
  share: number | null;
  /** Ceiling minus rent; negative when rent is over. */
  gap: number | null;
  /** Whole-number percentage for the stamp's centre. */
  percentLabel: string;
  /** "Fits, with $366 to spare" style verdict. */
  verdict: string;
  /** Shorter verdict for small cards. */
  shortVerdict: string;
}

/** Read one rent against one ceiling. Either may be missing. */
export function readRent(rent: number | null, ceiling: number | null): RentReading {
  if (rent == null || !Number.isFinite(rent)) {
    return {
      fit: 'unknown',
      share: null,
      gap: null,
      percentLabel: '—',
      verdict: 'No rent estimate here yet',
      shortVerdict: 'No rent estimate'
    };
  }
  if (ceiling == null || !Number.isFinite(ceiling)) {
    return {
      fit: 'unknown',
      share: null,
      gap: null,
      percentLabel: '—',
      verdict: 'Add a salary to see if it fits',
      shortVerdict: 'Add a salary'
    };
  }
  const gap = ceiling - rent;
  const share = ceiling > 0 ? rent / ceiling : Infinity;
  const fit = rentTargetFit(rent, ceiling) as Exclude<Fit, 'unknown'>;
  const percentLabel = Number.isFinite(share) ? `${Math.round(share * 100)}%` : 'Over';
  if (fit === 'above') {
    const verdict = `Over by ${money(-gap)}`;
    return { fit, share, gap, percentLabel, verdict, shortVerdict: verdict };
  }
  if (fit === 'near') {
    const rounded = Math.round(gap);
    const verdict =
      rounded === 0 ? 'Tight, right at your ceiling' : `Tight, only ${money(gap)} to spare`;
    return {
      fit,
      share,
      gap,
      percentLabel,
      verdict,
      shortVerdict: rounded === 0 ? 'Tight, at the ceiling' : `Tight, ${money(gap)} to spare`
    };
  }
  return {
    fit,
    share,
    gap,
    percentLabel,
    verdict: `Fits, with ${money(gap)} to spare`,
    shortVerdict: `Fits, ${money(gap)} to spare`
  };
}

/** Plain words for the selected housing, as used on the stamp and in tables. */
export function housingWords(housing: HousingChoice): { rent: string; short: string } {
  if (housing === '2br') return { rent: '2-bed rent', short: '2-bed' };
  if (housing === 'shared-2br') return { rent: 'Your half of a 2-bed', short: 'Half a 2-bed' };
  return { rent: '1-bed rent', short: '1-bed' };
}

/** "40.76° N, 111.89° W" */
export function formatCoordinates(lat: number | undefined, lng: number | undefined): string {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}° ${
    lng >= 0 ? 'E' : 'W'
  }`;
}

/** Small deterministic generator so a city's fallback ridgeline never changes. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10_000) / 10_000;
  };
}

/**
 * Two ridgeline paths for a city with no photo. The shapes come from the
 * city's name, so each placeholder is distinct but stable between visits.
 */
export function ridgePaths(seed: string, width: number, height: number): [string, string] {
  const random = seeded(seed);
  const ridge = (base: number, spread: number, points: number) => {
    const step = width / points;
    const parts = [`M0 ${Math.round(height * (base + (random() - 0.5) * spread))}`];
    for (let i = 1; i <= points; i++) {
      const y = height * (base + (random() - 0.5) * spread);
      parts.push(`L${Math.round(step * i)} ${Math.round(y)}`);
    }
    parts.push(`L${width} ${height} L0 ${height}Z`);
    return parts.join(' ');
  };
  return [ridge(0.66, 0.16, 7), ridge(0.8, 0.07, 5)];
}

/** Stamp ring geometry: the ring's circumference at r = 86 in a 260 box. */
export const STAMP_RING = 2 * Math.PI * 86;

export function ringDash(share: number | null): string {
  const filled = share == null ? 0 : Math.max(0, Math.min(1, share)) * STAMP_RING;
  return `${filled.toFixed(1)} ${STAMP_RING.toFixed(1)}`;
}

export function googleMapsUrl(place: { city: string; state: string }): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${place.city}, ${place.state}`
  )}`;
}
