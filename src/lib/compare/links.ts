import type { ComparisonCity } from './decision';
import type { ComparisonEntry } from './comparisonSet.svelte';
import {
  appendComparisonParameters,
  COMPARISON_SALARY_PARAM,
  comparisonSalaryLink,
  parseComparisonSalaryLink,
  rentPlanHref,
  type PlanComparisonInput
} from '$lib/planRepresentation';

export interface CityLinkInput {
  city: Pick<ComparisonCity, 'name' | 'source' | 'lat' | 'lng'>;
}

export interface RentPlanLinkInput {
  salary: number | null;
  comparisons: readonly (ComparisonEntry | ComparisonLinkInput)[];
}

export type ComparisonCityLink = Pick<ComparisonCity, 'name' | 'source' | 'lat' | 'lng'> & {
  salary?: number;
};

export interface ComparisonLinkEntry {
  city: Pick<ComparisonCity, 'name' | 'source' | 'lat' | 'lng'>;
  salary?: number;
}

type ComparisonLinkInput = ComparisonCityLink | ComparisonLinkEntry;

export { COMPARISON_SALARY_PARAM, comparisonSalaryLink, parseComparisonSalaryLink };

function representationEntries(
  entries: readonly (ComparisonEntry | ComparisonLinkInput)[]
): PlanComparisonInput[] {
  return entries.map((input) =>
    'city' in input
      ? { city: input.city, salary: input.salary }
      : { city: input, salary: input.salary }
  );
}

/** Append canonical comparison parameters to an existing query. */
export function appendComparisonLinks(
  search: URLSearchParams,
  entries: readonly (ComparisonEntry | ComparisonLinkInput)[]
): void {
  appendComparisonParameters(search, representationEntries(entries));
}

/** Browser navigation stays outside comparison analysis. */
export function cityHref(entry: CityLinkInput, plan: RentPlanLinkInput): string {
  return rentPlanHref('/', {
    salary: plan.salary,
    selected: entry.city,
    comparisons: representationEntries(plan.comparisons)
  });
}
