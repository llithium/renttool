import { computeBudget, salaryForRent } from '$lib/budget';
import { money, pctTrend, rentMetricLabel } from '$lib/format';
import type { Budget, City } from '$lib/types';
import {
  toComparisonCity,
  type ComparisonCity,
  type ComparisonEntryInput
} from './comparisonModel';

export type { ComparisonCity, ComparisonEntryInput } from './comparisonModel';

export interface ComparisonRent {
  oneBedroom: number | null;
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
  metricKey: 'after' | 'rent1' | 'takehome';
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
    metricKey: 'rent1'
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
}

interface ComparisonEntryBase {
  city: City;
  salary: number;
  budget: Budget;
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
    read: (entry) => finiteOrNull(entry.budget.takeHomeMonthly),
    format: monthlyMoney,
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  tax: {
    label: 'Effective tax rate',
    direction: 'low',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.budget.effRate),
    format: pct,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  budget: {
    label: '30% rent budget',
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
      const rent = finiteOrNull(entry.city.r1);
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

function comparisonRent(city: City): ComparisonRent {
  return {
    oneBedroom: finiteOrNull(city.r1),
    metricLabel: rentMetricLabel(city.rentMetric)
  };
}

function rentProvenance(city: City): string {
  return `${city.rentArea} · ${city.rentYear.trim() || 'year unavailable'}`;
}

function viewEntry(
  base: ComparisonEntryBase,
  entries: readonly ComparisonEntryBase[]
): ComparisonEntry {
  const rentBudget = finiteOrNull(base.budget.maxRent);
  return {
    city: toComparisonCity(base.city),
    salary: base.salary,
    rent: comparisonRent(base.city),
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
  return leaders.length > 1
    ? `${names} are tied at ${money(value)}/mo after estimated taxes.`
    : `${money(value)}/mo after estimated taxes.`;
}

function noDataDetail(definition: DecisionCriterionDefinition): string {
  if (definition.key === 'rent')
    return 'Add cities with rent estimates to identify a leading option.';
  if (definition.key === 'afterRent')
    return 'Add cities with 1BR rent estimates to compare room after rent.';
  return 'Add cities with salary estimates to identify a leading option.';
}

function buildBrief(entries: readonly ComputedEntry[], key: DecisionCriterion): DecisionBrief {
  const definition = { ...CRITERIA[key], key };
  const metric: MetricDefinition = METRIC_DEFINITIONS[definition.metricKey];

  const eligible = entries.filter((entry) => metric.read(entry.base) != null);
  if (!eligible.length) {
    return {
      criterion: definition.key,
      title: definition.title,
      leaders: [],
      eligibleCount: 0,
      status: 'not-enough-data',
      detail: noDataDetail(definition)
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
    detail: leaderDetail(definition, metric, leaders)
  };
}

function baseEntry({ city, salary }: ComparisonEntryInput): ComparisonEntryBase {
  const budget = computeBudget(salary, city);
  return {
    city,
    salary,
    budget,
    rentGap: city.r1 == null ? null : finiteOrNull(budget.maxRent - city.r1),
    afterRent: city.r1 == null ? null : finiteOrNull(budget.takeHomeMonthly - city.r1)
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
export function analyzeComparison(inputs: readonly ComparisonEntryInput[]): ComparisonView {
  const bases = inputs.map(baseEntry);
  const entries = bases.map((base) => ({ base, view: viewEntry(base, bases) }));

  return {
    entries: entries.map((entry) => entry.view),
    affordabilityMetrics: AFFORDABILITY_METRICS,
    cityContextMetrics: CITY_CONTEXT_METRICS,
    briefs: {
      afterRent: buildBrief(entries, 'afterRent'),
      rent: buildBrief(entries, 'rent'),
      takeHome: buildBrief(entries, 'takeHome')
    }
  };
}
