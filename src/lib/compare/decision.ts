import { computeBudget, salaryForRent } from '$lib/budget';
import { money, pctTrend } from '$lib/format';
import type { Budget, City } from '$lib/types';
import {
  comparisonQualification,
  computeSpendingRoom,
  rentCeiling,
  optionsForExpenses,
  DEFAULT_PLANNING_OPTIONS,
  housingRentLabel,
  housingShortLabel,
  type PlanningOptions
} from '$lib/planning';
import {
  toComparisonCity,
  type ComparisonCity,
  type ComparisonEntryInput
} from './comparisonModel';

export type { ComparisonCity, ComparisonEntryInput } from './comparisonModel';

export interface ComparisonRent {
  amount: number | null;
  metricLabel: string;
}

export type MetricKey = keyof typeof METRIC_DEFINITIONS;

export interface ComparisonMetric {
  key: MetricKey;
  label: string;
  /** Which end of the range counts as the best value. */
  direction: 'high' | 'low';
}

export type MetricTone = 'best' | 'worst' | null;

export interface MetricCell {
  value: string;
  number: number | null;
  tone: MetricTone;
  toneLabel: string | null;
}

export interface FitStatus {
  label: string;
  tone: 'good' | 'bad' | null;
}

export interface ComparisonEntry {
  city: ComparisonCity;
  salary: number;
  actualTakeHomeMonthly?: number;
  monthlyExpenses?: number;
  rent: ComparisonRent;
  rentProvenance: string;
  taxContext: string;
  rentBudget: {
    amount: number | null;
    value: string;
  };
  fit: FitStatus;
  metrics: Readonly<Record<MetricKey, MetricCell>>;
}

export type DecisionCriterion = keyof typeof CRITERIA;

export interface DecisionCriterionDefinition {
  key: DecisionCriterion;
  label: string;
  title: string;
  metricKey: 'after' | 'selectedRent' | 'takehome';
}

/** Fixed product criteria keep the external interface small and stable. */
const CRITERIA = {
  afterRent: {
    label: 'Most left after rent',
    title: 'Most room after 1BR rent',
    metricKey: 'after'
  },
  rent: {
    label: 'Lowest 1BR rent',
    title: 'Lowest typical 1BR rent',
    metricKey: 'selectedRent'
  },
  takeHome: {
    label: 'Highest take-home',
    title: 'Highest estimated take-home',
    metricKey: 'takehome'
  }
} satisfies Record<string, Omit<DecisionCriterionDefinition, 'key'>>;

export const DECISION_CRITERIA = Object.entries(CRITERIA).map(([key, definition]) => ({
  ...definition,
  key: key as DecisionCriterion
}));

export type DecisionStatus = 'decided' | 'tie' | 'not-enough-data';

export interface DecisionBrief {
  criterion: DecisionCriterion;
  title: string;
  leaders: readonly ComparisonEntry[];
  eligibleCount: number;
  status: DecisionStatus;
  detail: string;
}

export interface ComparisonView {
  entries: readonly ComparisonEntry[];
  affordabilityMetrics: readonly ComparisonMetric[];
  cityContextMetrics: readonly ComparisonMetric[];
  briefs: Readonly<Record<DecisionCriterion, DecisionBrief>>;
  options: PlanningOptions;
  qualification: string | null;
}

interface ComparisonEntryBase {
  city: City;
  salary: number;
  budget: Budget;
  options: PlanningOptions;
  actualTakeHomeMonthly?: number;
  monthlyExpenses?: number;
  rentAmount: number | null;
  takeHomeMonthly: number;
  rentGap: number | null;
  afterRent: number | null;
}

interface MetricDefinition {
  label: string;
  direction: 'high' | 'low';
  group: 'affordability' | 'city-context';
  read: (entry: ComparisonEntryBase) => number | null;
  format: (value: number) => string;
  bestLabel: string;
  worstLabel: string;
}

interface ComputedEntry {
  base: ComparisonEntryBase;
  view: ComparisonEntry;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function monthlyMoney(value: number): string {
  return `${money(value)}/mo`;
}

const METRIC_DEFINITIONS = {
  salary: {
    label: 'Annual salary',
    direction: 'high',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.salary),
    format: (value) => money(value),
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  takehome: {
    label: 'Est. take-home',
    direction: 'high',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.takeHomeMonthly),
    format: monthlyMoney,
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  tax: {
    label: 'Est. effective tax rate',
    direction: 'low',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.budget.effRate),
    format: pct,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  budget: {
    label: 'Rent ceiling',
    direction: 'high',
    group: 'affordability',
    read: (entry) =>
      finiteOrNull(rentCeiling(entry.budget, entry.options, entry.actualTakeHomeMonthly)),
    format: monthlyMoney,
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  grossBudget: {
    label: '30% gross-income benchmark',
    direction: 'high',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.budget.maxRent),
    format: monthlyMoney,
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  rent1: {
    label: '1BR rent',
    direction: 'low',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.city.r1),
    format: monthlyMoney,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  rent2: {
    label: '2BR rent',
    direction: 'low',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.city.r2),
    format: monthlyMoney,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  selectedRent: {
    label: 'Selected housing rent',
    direction: 'low',
    group: 'affordability',
    read: (entry) => entry.rentAmount,
    format: monthlyMoney,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  after: {
    label: 'Take-home after 1BR',
    direction: 'high',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.afterRent),
    format: monthlyMoney,
    bestLabel: 'Most left',
    worstLabel: 'Lowest'
  },
  needed: {
    label: 'Salary needed for 1BR',
    direction: 'low',
    group: 'affordability',
    read: (entry) => {
      const rent = entry.rentAmount;
      return rent == null ? null : finiteOrNull(salaryForRent(rent));
    },
    format: (value) => money(value),
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  trend: {
    label: 'Rent trend',
    direction: 'low',
    group: 'city-context',
    read: (entry) => finiteOrNull(entry.city.yoy),
    format: pctTrend,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  income: {
    label: 'Median household income',
    direction: 'high',
    group: 'city-context',
    read: (entry) => finiteOrNull(entry.city.citySnapshot?.householdIncome),
    format: (value) => money(value),
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  commute: {
    label: 'Average commute',
    direction: 'low',
    group: 'city-context',
    read: (entry) => finiteOrNull(entry.city.citySnapshot?.commuteMinutes),
    format: (value) => `${value} min`,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  renters: {
    label: 'Renter households',
    direction: 'high',
    group: 'city-context',
    read: (entry) => finiteOrNull(entry.city.citySnapshot?.renterShare),
    format: (value) => `${value}%`,
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  vacancy: {
    label: 'Rental vacancy',
    direction: 'high',
    group: 'city-context',
    read: (entry) => finiteOrNull(entry.city.citySnapshot?.rentalVacancy),
    format: (value) => `${value}%`,
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  }
} satisfies Record<string, MetricDefinition>;

const metricEntries = Object.entries(METRIC_DEFINITIONS) as [MetricKey, MetricDefinition][];
const metricDescriptors = metricEntries.map(([key, { label, direction, group }]) => ({
  key,
  label,
  direction,
  group
}));
const AFFORDABILITY_METRICS = metricDescriptors.filter(
  (metric) => metric.group === 'affordability'
);
const CITY_CONTEXT_METRICS = metricDescriptors.filter((metric) => metric.group === 'city-context');

function metricTone(
  entries: readonly ComparisonEntryBase[],
  entry: ComparisonEntryBase,
  definition: MetricDefinition
): MetricTone {
  const values = entries
    .map((candidate) => definition.read(candidate))
    .filter((value): value is number => value != null);
  const value = definition.read(entry);
  if (value == null || values.length < 2) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (low === high) return null;
  if (value === (definition.direction === 'high' ? high : low)) return 'best';
  if (value === (definition.direction === 'high' ? low : high)) return 'worst';
  return null;
}

function fitStatus(entry: ComparisonEntryBase): FitStatus {
  if (entry.rentGap == null) return { label: 'Rent unavailable', tone: null };
  if (entry.rentGap >= 0) return { label: `${money(entry.rentGap)} under budget`, tone: 'good' };
  return { label: `${money(Math.abs(entry.rentGap))} over budget`, tone: 'bad' };
}

function buildMetrics(
  entry: ComparisonEntryBase,
  entries: readonly ComparisonEntryBase[]
): Readonly<Record<MetricKey, MetricCell>> {
  return Object.fromEntries(
    metricEntries.map(([key, definition]) => {
      const number = definition.read(entry);
      const tone = metricTone(entries, entry, definition);
      return [
        key,
        {
          value: number == null ? '—' : definition.format(number),
          number,
          tone,
          toneLabel:
            tone === 'best' ? definition.bestLabel : tone === 'worst' ? definition.worstLabel : null
        }
      ] as const;
    })
  ) as Record<MetricKey, MetricCell>;
}

function comparisonRent(base: ComparisonEntryBase): ComparisonRent {
  return {
    amount: base.rentAmount,
    metricLabel: housingRentLabel(base.city, base.options.housing)
  };
}

function rentProvenance(city: City): string {
  return `${city.rentArea} · ${city.rentYear.trim() || 'year unavailable'}`;
}

function viewEntry(
  base: ComparisonEntryBase,
  entries: readonly ComparisonEntryBase[]
): ComparisonEntry {
  const rentBudget = finiteOrNull(
    rentCeiling(base.budget, base.options, base.actualTakeHomeMonthly)
  );
  return {
    city: toComparisonCity(base.city),
    salary: base.salary,
    actualTakeHomeMonthly: base.actualTakeHomeMonthly,
    monthlyExpenses: base.monthlyExpenses,
    rent: comparisonRent(base),
    rentProvenance: rentProvenance(base.city),
    taxContext: base.city.tax,
    rentBudget: {
      amount: rentBudget,
      value: rentBudget == null ? '—' : monthlyMoney(rentBudget)
    },
    fit: fitStatus(base),
    metrics: buildMetrics(base, entries)
  };
}

function leaderDetail(
  definition: DecisionCriterionDefinition,
  metric: MetricDefinition,
  leaders: readonly ComputedEntry[]
): string {
  const names = leaders.map((leader) => leader.view.city.name).join(' and ');
  const value = leaders.length ? metric.read(leaders[0].base) : null;
  if (definition.key === 'afterRent') {
    return leaders.length > 1
      ? `${names} are tied with ${money(value)} left after a typical 1BR.`
      : `${money(value)} left after a typical 1BR each month.`;
  }
  if (definition.key === 'rent') {
    return leaders.length > 1
      ? `${names} are tied at ${money(value)}/mo for a typical 1BR.`
      : `${money(value)}/mo for a typical 1BR.`;
  }
  const payContext = leaders.some((leader) => leader.base.actualTakeHomeMonthly != null)
    ? 'take-home pay'
    : 'after estimated taxes';
  return leaders.length > 1
    ? `${names} are tied at ${money(value)}/mo ${payContext}.`
    : `${money(value)}/mo ${payContext}.`;
}

function noDataDetail(definition: DecisionCriterionDefinition): string {
  if (definition.key === 'rent')
    return 'Add cities with rent estimates to identify a leading option.';
  if (definition.key === 'afterRent')
    return 'Add cities with 1BR rent estimates to compare room after rent.';
  return 'Add cities with salary estimates to identify a leading option.';
}

function buildBrief(
  entries: readonly ComputedEntry[],
  key: DecisionCriterion,
  options: PlanningOptions
): DecisionBrief {
  const housing = housingShortLabel(options.housing);
  const definition = { ...CRITERIA[key], title: CRITERIA[key].title.replace('1BR', housing), key };
  if (
    key === 'afterRent' &&
    entries.some(
      (entry) => entry.base.options.monthlyExpenses + entry.base.options.monthlySavings > 0
    )
  )
    definition.title = 'Most room after rent, expenses & savings';
  if (key === 'takeHome' && entries.some((entry) => entry.base.actualTakeHomeMonthly != null))
    definition.title = 'Highest take-home pay';
  const metric: MetricDefinition = METRIC_DEFINITIONS[definition.metricKey];

  const eligible = entries.filter((entry) => metric.read(entry.base) != null);
  if (!eligible.length) {
    return {
      criterion: definition.key,
      title: definition.title,
      leaders: [],
      eligibleCount: 0,
      status: 'not-enough-data',
      detail: noDataDetail(definition).replace('1BR', housing)
    };
  }

  const values = eligible
    .map((entry) => metric.read(entry.base))
    .filter((value): value is number => value != null);
  const target = metric.direction === 'high' ? Math.max(...values) : Math.min(...values);
  const leaders = eligible.filter((entry) => metric.read(entry.base) === target);
  return {
    criterion: definition.key,
    title: definition.title,
    leaders: leaders.map((entry) => entry.view),
    eligibleCount: eligible.length,
    status: leaders.length > 1 ? 'tie' : 'decided',
    detail: leaderDetail(definition, metric, leaders).replace(
      'a typical 1BR',
      entries.some(
        (entry) => entry.base.options.monthlyExpenses + entry.base.options.monthlySavings > 0
      ) && key === 'afterRent'
        ? 'rent, expenses & savings'
        : options.housing === 'shared-2br'
          ? 'your half of a typical 2BR'
          : `a typical ${housing}`
    )
  };
}

function baseEntry(
  { city, salary, actualTakeHomeMonthly, monthlyExpenses }: ComparisonEntryInput,
  sharedOptions: PlanningOptions
): ComparisonEntryBase {
  const options = optionsForExpenses(sharedOptions, monthlyExpenses);
  const budget = computeBudget(salary, city);
  const spending = computeSpendingRoom(budget, city, options, actualTakeHomeMonthly);
  return {
    city,
    salary,
    budget,
    options,
    actualTakeHomeMonthly,
    monthlyExpenses,
    rentAmount: spending.rent,
    takeHomeMonthly: spending.takeHomeMonthly,
    rentGap:
      spending.rent == null
        ? null
        : finiteOrNull(rentCeiling(budget, options, actualTakeHomeMonthly) - spending.rent),
    afterRent: finiteOrNull(spending.available)
  };
}

/**
 * Analyze a comparison set through one public seam.
 *
 * The implementation owns budget math, missing-value policy, metric display
 * cells, best/worst tones, fit status, provenance, and the fixed decision
 * criteria. Callers only supply city salary entries and arrange the returned
 * view model.
 */
export function analyzeComparison(
  inputs: readonly ComparisonEntryInput[],
  options: PlanningOptions = DEFAULT_PLANNING_OPTIONS
): ComparisonView {
  const bases = inputs.map((input) => baseEntry(input, options));
  const entries = bases.map((base) => ({ base, view: viewEntry(base, bases) }));

  return {
    entries: entries.map((entry) => entry.view),
    options,
    qualification: comparisonQualification(inputs.map((input) => input.city)),
    affordabilityMetrics: AFFORDABILITY_METRICS.filter(
      (metric) => metric.key !== 'selectedRent' || options.housing === 'shared-2br'
    ).map((metric) => ({
      ...metric,
      label:
        metric.key === 'selectedRent'
          ? `${housingShortLabel(options.housing)} rent`
          : metric.key === 'after'
            ? bases.some(
                (entry) => entry.options.monthlyExpenses + entry.options.monthlySavings > 0
              )
              ? 'After rent, expenses & savings'
              : `Take-home after ${housingShortLabel(options.housing)}`
            : metric.key === 'needed'
              ? `Salary needed for ${housingShortLabel(options.housing)}`
              : metric.key === 'takehome' &&
                  inputs.some((input) => input.actualTakeHomeMonthly != null)
                ? 'Take-home (entered or estimated)'
                : metric.label
    })),
    cityContextMetrics: CITY_CONTEXT_METRICS,
    briefs: {
      afterRent: buildBrief(entries, 'afterRent', options),
      rent: buildBrief(entries, 'rent', options),
      takeHome: buildBrief(entries, 'takeHome', options)
    }
  };
}
