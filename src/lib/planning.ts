import type { Budget, City } from '$lib/types';
import { rentMetricLabel, sentenceLabel } from '$lib/format';

export const HOUSING_CHOICES = {
  '1br': '1-bedroom',
  '2br': '2-bedroom',
  'shared-2br': 'Shared 2-bedroom'
} as const;
export type HousingChoice = keyof typeof HOUSING_CHOICES;

export interface PlanningOptions {
  housing: HousingChoice;
  monthlyExpenses: number;
  monthlySavings: number;
}

export const DEFAULT_PLANNING_OPTIONS: Readonly<PlanningOptions> = {
  housing: '1br',
  monthlyExpenses: 0,
  monthlySavings: 0
};

export function normalizeMonthlyAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000
    ? Math.round(value * 100) / 100
    : null;
}

export function normalizePlanningOptions(value: unknown): PlanningOptions {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    housing:
      typeof record.housing === 'string' && Object.hasOwn(HOUSING_CHOICES, record.housing)
        ? (record.housing as HousingChoice)
        : '1br',
    monthlyExpenses: normalizeMonthlyAmount(record.monthlyExpenses) ?? 0,
    monthlySavings: normalizeMonthlyAmount(record.monthlySavings) ?? 0
  };
}

/** Shared housing assumes two people splitting a two-bedroom equally. */
export function housingRent(city: Pick<City, 'r1' | 'r2'>, housing: HousingChoice): number | null {
  const rent = housing === '1br' ? city.r1 : city.r2;
  if (rent == null || !Number.isFinite(rent) || rent <= 0) return null;
  return housing === 'shared-2br' ? rent / 2 : rent;
}

export function housingShortLabel(housing: HousingChoice): string {
  return housing === '1br' ? '1BR' : housing === '2br' ? '2BR' : 'half a 2BR';
}

export function housingRentLabel(city: Pick<City, 'rentMetric'>, housing: HousingChoice): string {
  const label = rentMetricLabel(city.rentMetric, housing === '1br' ? '1BR' : '2BR');
  return housing === 'shared-2br' ? `Half of the ${sentenceLabel(label)}` : label;
}

export function housingSearchBudget(target: number, housing: HousingChoice): number {
  return housing === 'shared-2br' ? target * 2 : target;
}

export function computeSpendingRoom(
  budget: Budget,
  city: Pick<City, 'r1' | 'r2'>,
  options: PlanningOptions,
  actualTakeHomeMonthly: number | null = null
) {
  const takeHomeMonthly = normalizeMonthlyAmount(actualTakeHomeMonthly) ?? budget.takeHomeMonthly;
  const rent = housingRent(city, options.housing);
  return {
    takeHomeMonthly,
    rent,
    afterRent: rent == null ? null : takeHomeMonthly - rent,
    available:
      rent == null
        ? null
        : takeHomeMonthly - rent - options.monthlyExpenses - options.monthlySavings
  };
}

/** Explain when a comparison combines different statistics, geographies, or releases. */
export function comparisonQualification(
  cities: readonly Pick<City, 'source' | 'rentMetric' | 'rentYear'>[]
): string | null {
  const known = cities.filter((city) => city.source !== 'none');
  if (new Set(known.map((city) => city.rentMetric)).size > 1) {
    return 'This comparison mixes city median estimates with area-level HUD 40th-percentile Fair Market Rents. Their geography and rent definitions differ; treat the ranking as a planning comparison.';
  }
  if (new Set(known.map((city) => city.rentYear)).size > 1) {
    return 'Rent estimates in this comparison come from different reporting periods.';
  }
  return null;
}
