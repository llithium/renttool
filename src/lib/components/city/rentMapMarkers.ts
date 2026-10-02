import { money } from '$lib/format';
import type { City } from '$lib/types';
import { housingRent, type HousingChoice } from '$lib/planning';

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
  fit: 'fits budget' | 'over budget' | 'rent data unavailable' | 'enter salary to check budget';
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
  city: Pick<City, 'name' | 'r1'> & Partial<Pick<City, 'r2'>>,
  maxRent: number | null,
  selectedName: string | null,
  palette: MarkerPalette,
  housing: HousingChoice = '1br'
): MarkerPresentation {
  const rent = housingRent({ r1: city.r1, r2: city.r2 ?? null }, housing);
  const rentLabel = housing === '1br' ? '1BR' : housing === '2br' ? '2BR' : 'Half a 2BR';
  const accessibleLabel =
    housing === '1br'
      ? '1 bedroom'
      : housing === '2br'
        ? '2 bedrooms'
        : 'half of a shared 2 bedroom';
  const selected = city.name === selectedName;
  const hasBudgetAndRent = maxRent != null && rent != null;
  const fits = maxRent != null && rent != null ? rent <= maxRent : false;
  const fit =
    rent == null
      ? 'rent data unavailable'
      : maxRent == null
        ? 'enter salary to check budget'
        : fits
          ? 'fits budget'
          : 'over budget';

  return {
    radius: selected ? 9 : 5.5,
    weight: selected ? 3 : 1.5,
    color: selected ? palette.accent : palette.card,
    fillColor: !hasBudgetAndRent ? palette.neutral : fits ? palette.fits : palette.over,
    fillOpacity: 0.9,
    fit,
    tooltipDetail: `${rentLabel} ${money(rent)} · ${fit}`,
    ariaLabel: `${city.name}, ${accessibleLabel} ${money(rent)}, ${fit}`
  };
}
