import { money } from '$lib/format';
import type { City } from '$lib/types';

export type RentMapCity = Pick<City, 'name' | 'r1' | 'lat' | 'lng'>;

export type MarkerPalette = Readonly<{
  neutral: string;
  fits: string;
  over: string;
  accent: string;
  card: string;
}>;

export type MarkerPresentation = Readonly<{
  radius: number;
  weight: number;
  color: string;
  fillColor: string;
  fillOpacity: number;
  fit: 'fits budget' | 'over budget' | 'rent data unavailable';
  tooltipDetail: string;
  ariaLabel: string;
}>;

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

/** Calculate every visual and accessible value for one retained marker. */
export function markerPresentation(
  city: Pick<City, 'name' | 'r1'>,
  maxRent: number | null,
  selectedName: string | null,
  palette: MarkerPalette
): MarkerPresentation {
  const selected = city.name === selectedName;
  const hasBudgetAndRent = maxRent != null && city.r1 != null;
  const fits = maxRent != null && city.r1 != null ? city.r1 <= maxRent : false;
  const fit = !hasBudgetAndRent ? 'rent data unavailable' : fits ? 'fits budget' : 'over budget';

  return {
    radius: selected ? 9 : 5.5,
    weight: selected ? 3 : 1.5,
    color: selected ? palette.accent : palette.card,
    fillColor: !hasBudgetAndRent ? palette.neutral : fits ? palette.fits : palette.over,
    fillOpacity: 0.9,
    fit,
    tooltipDetail: `1BR ${money(city.r1)} · ${fit}`,
    ariaLabel: `${city.name}, 1 bedroom ${money(city.r1)}, ${fit}`
  };
}
