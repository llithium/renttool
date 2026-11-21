import { money } from '$lib/format';
import type { City } from '$lib/types';
import { housingRent, type HousingChoice } from '$lib/planning';
import { readRent, type Fit } from '$lib/postcard';

export interface MarkerKeyReconciliation {
  added: string[];
  retained: string[];
  removed: string[];
}

/** Return the marker-key changes needed for the currently located city set. */
export function reconcileMarkerKeys(
  previousKeys: Iterable<string>,
  cities: readonly Pick<City, 'name' | 'lat' | 'lng'>[]
): MarkerKeyReconciliation {
  const previous = [...new Set(previousKeys)];
  const next = [
    ...new Set(
      cities.filter((city) => city.lat != null && city.lng != null).map((city) => city.name)
    )
  ];
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  return {
    added: next.filter((name) => !previousSet.has(name)),
    retained: next.filter((name) => previousSet.has(name)),
    removed: previous.filter((name) => !nextSet.has(name))
  };
}

export type MarkerState = Fit | 'checking' | 'no-salary';

export interface MarkerPresentation {
  state: MarkerState;
  selected: boolean;
  /** Short rent text drawn beside the pin, e.g. "$1,043". */
  rentText: string;
  /** What the pin means, in words. */
  status: string;
  ariaLabel: string;
}

const STATUS: Record<MarkerState, string> = {
  within: 'fits your ceiling',
  near: 'within 5% of your ceiling',
  above: 'over your ceiling',
  unknown: 'no rent estimate',
  checking: 'checking area rent',
  'no-salary': 'add a salary to check'
};

/** Everything a map pin shows, for one city at the current plan. */
export function markerPresentation(
  city: Pick<City, 'name' | 'r1'> & Partial<Pick<City, 'r2'>>,
  ceiling: number | null,
  selectedName: string | null,
  housing: HousingChoice = '1br',
  checking = false
): MarkerPresentation {
  const rent = housingRent({ r1: city.r1, r2: city.r2 ?? null }, housing);
  const state: MarkerState =
    rent == null
      ? checking
        ? 'checking'
        : 'unknown'
      : ceiling == null
        ? 'no-salary'
        : readRent(rent, ceiling).fit;
  const selected = city.name === selectedName;
  const rentText = rent == null ? '' : money(rent);
  const status = STATUS[state];
  const bedrooms =
    housing === '1br' ? '1-bed' : housing === '2br' ? '2-bed' : 'half of a shared 2-bed';
  return {
    state,
    selected,
    rentText,
    status,
    ariaLabel: `${city.name}${rent == null ? '' : `, ${bedrooms} ${rentText}`}, ${status}${
      selected ? ', showing now' : ''
    }`
  };
}
