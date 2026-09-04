import type { ComparisonCity } from './comparisonModel';
import { rentPlanHref } from '$lib/planRepresentation';

type NavigationCity = Pick<ComparisonCity, 'name' | 'source' | 'lat' | 'lng'>;

interface RentPlanLinkInput {
  salary: number | null;
  comparisons: readonly { city: NavigationCity; salary: number }[];
}

/** Build a city link while retaining every committed comparison salary. */
export function cityHref(entry: { city: NavigationCity }, plan: RentPlanLinkInput): string {
  return rentPlanHref('/', {
    salary: plan.salary,
    selected: entry.city,
    comparisons: plan.comparisons
  });
}
