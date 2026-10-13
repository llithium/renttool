import type { ComparisonCity } from './comparisonModel';
import { rentPlanHref } from '$lib/planRepresentation';
import type { PlanningOptions } from '$lib/planning';

type NavigationCity = Pick<ComparisonCity, 'name' | 'source' | 'lat' | 'lng'>;

interface RentPlanLinkInput {
  salary: number | null;
  comparisons: readonly {
    city: NavigationCity;
    salary: number;
    actualTakeHomeMonthly?: number;
    monthlyExpenses?: number;
  }[];
  options?: PlanningOptions;
  selectedName?: string | null;
  actualTakeHomeMonthly?: number | null;
}

/** Build a city link while retaining every committed comparison salary. */
export function cityHref(entry: { city: NavigationCity }, plan: RentPlanLinkInput): string {
  return rentPlanHref('/', {
    salary: plan.salary,
    selected: entry.city,
    comparisons: plan.comparisons,
    options: plan.options,
    actualTakeHomeMonthly: entry.city.name === plan.selectedName ? plan.actualTakeHomeMonthly : null
  });
}
