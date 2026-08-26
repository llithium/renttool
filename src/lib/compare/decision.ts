import { computeBudget, salaryForRent } from '$lib/budget';
import { money, pctTrend, rentMetricLabel } from '$lib/format';
import { MAX_SALARY } from '$lib/salary';
import type { Budget, City } from '$lib/types';

/** The numeric input that crosses the comparison-decision seam. */
export interface ComparisonEntryInput {
  city: City;
  salary: number;
}

/** City identity and navigation fields that are safe for comparison views to expose. */
export interface ComparisonCity {
  name: string;
  source: City['source'];
  lat?: number;
  lng?: number;
}

export interface ComparisonRent {
  oneBedroom: number | null;
  twoBedroom: number | null;
  metricLabel: string;
}

const METRIC_KEYS = [
  'salary',
  'takehome',
  'tax',
  'budget',
  'rent1',
  'rent2',
  'after',
  'needed',
  'trend',
  'income',
  'commute',
  'renters',
  'vacancy'
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

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

export type DecisionCriterion = 'afterRent' | 'rent' | 'takeHome';

export interface DecisionCriterionDefinition {
  key: DecisionCriterion;
  label: string;
  title: string;
  metricKey: 'after' | 'rent1' | 'takehome';
}

/** Fixed product criteria keep the external interface small and stable. */
export const DECISION_CRITERIA: readonly DecisionCriterionDefinition[] = [
  {
    key: 'afterRent',
    label: 'Most left after rent',
    title: 'Most room after 1BR rent',
    metricKey: 'after'
  },
  {
    key: 'rent',
    label: 'Lowest 1BR rent',
    title: 'Lowest typical 1BR rent',
    metricKey: 'rent1'
  },
  {
    key: 'takeHome',
    label: 'Highest take-home',
    title: 'Highest estimated take-home',
    metricKey: 'takehome'
  }
];

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

export interface SalaryEquivalenceEntry {
  city: ComparisonCity;
  committedSalary: number;
  committedSalaryValue: string;
  requiredSalary: number | null;
  requiredSalaryValue: string;
  unavailableReason: string | null;
  isReference: boolean;
}

export interface SalaryEquivalenceView {
  referenceName: string | null;
  targetMonthly: number | null;
  targetMonthlyValue: string;
  entries: readonly SalaryEquivalenceEntry[];
}

interface ComparisonEntryBase {
  city: City;
  salary: number;
  budget: Budget;
  rentGap: number | null;
  afterRent: number | null;
}

interface MetricDefinition extends ComparisonMetric {
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

function displayMoney(value: number | null | undefined): string {
  return finiteOrNull(value) == null ? '—' : money(value);
}

function monthlyDisplay(value: number | null | undefined): string {
  const display = displayMoney(value);
  return display === '—' ? display : `${display}/mo`;
}

function minimumSalaryForTarget(targetMonthly: number, city: City): number | null {
  const rent = finiteOrNull(city.r1);
  if (rent == null || !Number.isFinite(targetMonthly)) return null;

  const leavesAfterRent = (salary: number): number => {
    const takeHome = computeBudget(salary, city).takeHomeMonthly;
    return Number.isFinite(takeHome) ? takeHome - rent : Number.NEGATIVE_INFINITY;
  };

  if (leavesAfterRent(MAX_SALARY) < targetMonthly) return null;

  let low = 1;
  let high = MAX_SALARY;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (leavesAfterRent(middle) >= targetMonthly) high = middle;
    else low = middle + 1;
  }
  return leavesAfterRent(low) >= targetMonthly ? low : null;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function monthlyMoney(value: number): string {
  return `${money(value)}/mo`;
}

const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    key: 'salary',
    label: 'Annual salary',
    direction: 'high',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.salary),
    format: (value) => money(value),
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  {
    key: 'takehome',
    label: 'Est. take-home',
    direction: 'high',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.budget.takeHomeMonthly),
    format: monthlyMoney,
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  {
    key: 'tax',
    label: 'Effective tax rate',
    direction: 'low',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.budget.effRate),
    format: pct,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  {
    key: 'budget',
    label: '30% rent budget',
    direction: 'high',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.budget.maxRent),
    format: monthlyMoney,
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  {
    key: 'rent1',
    label: '1BR rent',
    direction: 'low',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.city.r1),
    format: monthlyMoney,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  {
    key: 'rent2',
    label: '2BR rent',
    direction: 'low',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.city.r2),
    format: monthlyMoney,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  {
    key: 'after',
    label: 'Take-home after 1BR',
    direction: 'high',
    group: 'affordability',
    read: (entry) => finiteOrNull(entry.afterRent),
    format: monthlyMoney,
    bestLabel: 'Most left',
    worstLabel: 'Lowest'
  },
  {
    key: 'needed',
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
  {
    key: 'trend',
    label: 'Rent trend',
    direction: 'low',
    group: 'city-context',
    read: (entry) => finiteOrNull(entry.city.yoy),
    format: pctTrend,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  {
    key: 'income',
    label: 'Median household income',
    direction: 'high',
    group: 'city-context',
    read: (entry) => finiteOrNull(entry.city.citySnapshot?.householdIncome),
    format: (value) => money(value),
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  {
    key: 'commute',
    label: 'Average commute',
    direction: 'low',
    group: 'city-context',
    read: (entry) => finiteOrNull(entry.city.citySnapshot?.commuteMinutes),
    format: (value) => `${value} min`,
    bestLabel: 'Lowest',
    worstLabel: 'Highest'
  },
  {
    key: 'renters',
    label: 'Renter households',
    direction: 'high',
    group: 'city-context',
    read: (entry) => finiteOrNull(entry.city.citySnapshot?.renterShare),
    format: (value) => `${value}%`,
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  },
  {
    key: 'vacancy',
    label: 'Rental vacancy',
    direction: 'high',
    group: 'city-context',
    read: (entry) => finiteOrNull(entry.city.citySnapshot?.rentalVacancy),
    format: (value) => `${value}%`,
    bestLabel: 'Highest',
    worstLabel: 'Lowest'
  }
];

function metricDescriptor({ key, label, direction }: MetricDefinition): ComparisonMetric {
  return { key, label, direction };
}

/** The values that answer the affordability decision before city context. */
export const AFFORDABILITY_METRICS: readonly ComparisonMetric[] = METRIC_DEFINITIONS.filter(
  (definition) => definition.group === 'affordability'
).map(metricDescriptor);

/** Secondary city facts, available after the core rent decision is understood. */
export const CITY_CONTEXT_METRICS: readonly ComparisonMetric[] = METRIC_DEFINITIONS.filter(
  (definition) => definition.group === 'city-context'
).map(metricDescriptor);

function metricNumber(entry: ComparisonEntryBase, definition: MetricDefinition): number | null {
  return definition.read(entry);
}

function metricTone(
  entries: readonly ComparisonEntryBase[],
  entry: ComparisonEntryBase,
  definition: MetricDefinition
): MetricTone {
  const values = entries
    .map((candidate) => metricNumber(candidate, definition))
    .filter((value): value is number => value != null);
  const value = metricNumber(entry, definition);
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

function completeMetricRecord(
  entries: readonly (readonly [MetricKey, MetricCell])[]
): Readonly<Record<MetricKey, MetricCell>> {
  const cells: Partial<Record<MetricKey, MetricCell>> = {};
  for (const [key, cell] of entries) {
    if (cells[key]) throw new Error(`Duplicate comparison metric: ${key}`);
    cells[key] = cell;
  }
  for (const key of METRIC_KEYS) {
    if (!cells[key]) throw new Error(`Missing comparison metric: ${key}`);
  }
  return cells as Record<MetricKey, MetricCell>;
}

function buildMetrics(
  entry: ComparisonEntryBase,
  entries: readonly ComparisonEntryBase[]
): Readonly<Record<MetricKey, MetricCell>> {
  return completeMetricRecord(
    METRIC_DEFINITIONS.map((definition) => {
      const number = metricNumber(entry, definition);
      const tone = metricTone(entries, entry, definition);
      return [
        definition.key,
        {
          value: number == null ? '—' : definition.format(number),
          number,
          tone,
          toneLabel:
            tone === 'best' ? definition.bestLabel : tone === 'worst' ? definition.worstLabel : null
        }
      ] as const;
    })
  );
}

function comparisonCity(city: City): ComparisonCity {
  return {
    name: city.name,
    source: city.source,
    lat: city.lat,
    lng: city.lng
  };
}

function comparisonRent(city: City): ComparisonRent {
  return {
    oneBedroom: finiteOrNull(city.r1),
    twoBedroom: finiteOrNull(city.r2),
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
    city: comparisonCity(base.city),
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
  const value = leaders.length ? metricNumber(leaders[0].base, metric) : null;
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

function buildBrief(
  entries: readonly ComputedEntry[],
  definition: DecisionCriterionDefinition
): DecisionBrief {
  const metric = METRIC_DEFINITIONS.find((candidate) => candidate.key === definition.metricKey);
  if (!metric) throw new Error(`Unknown decision metric: ${definition.metricKey}`);

  const eligible = entries.filter((entry) => metricNumber(entry.base, metric) != null);
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
    .map((entry) => metricNumber(entry.base, metric))
    .filter((value): value is number => value != null);
  const target = metric.direction === 'high' ? Math.max(...values) : Math.min(...values);
  const leaders = eligible.filter((entry) => metricNumber(entry.base, metric) === target);
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
  const criterion = (key: DecisionCriterion): DecisionCriterionDefinition => {
    const definition = DECISION_CRITERIA.find((candidate) => candidate.key === key);
    if (!definition) throw new Error(`Unknown decision criterion: ${key}`);
    return definition;
  };

  return {
    entries: entries.map((entry) => entry.view),
    affordabilityMetrics: AFFORDABILITY_METRICS,
    cityContextMetrics: CITY_CONTEXT_METRICS,
    briefs: {
      afterRent: buildBrief(entries, criterion('afterRent')),
      rent: buildBrief(entries, criterion('rent')),
      takeHome: buildBrief(entries, criterion('takeHome'))
    }
  };
}

/**
 * Compare the salary needed in each city to leave the reference entry's
 * estimated monthly spending room after a typical one-bedroom rent.
 */
export function analyzeSalaryEquivalence(
  inputs: readonly ComparisonEntryInput[],
  requestedReferenceName?: string | null
): SalaryEquivalenceView {
  const reference =
    inputs.find(
      (input) =>
        requestedReferenceName != null &&
        input.city.name.toLowerCase() === requestedReferenceName.toLowerCase()
    ) ?? inputs[0];
  const referenceName = reference?.city.name ?? null;
  const referenceSalary = finiteOrNull(reference?.salary);
  const referenceRent = finiteOrNull(reference?.city.r1);
  const targetMonthly =
    reference && referenceSalary != null && referenceRent != null
      ? finiteOrNull(computeBudget(referenceSalary, reference.city).takeHomeMonthly - referenceRent)
      : null;
  const baseReason = !reference
    ? 'No comparison entries are available.'
    : referenceSalary == null
      ? 'The reference salary is unavailable.'
      : referenceRent == null
        ? 'The reference 1BR rent is unavailable.'
        : targetMonthly == null
          ? 'The reference spending room is unavailable.'
          : null;

  return {
    referenceName,
    targetMonthly,
    targetMonthlyValue: monthlyDisplay(targetMonthly),
    entries: inputs.map((input) => {
      const isReference = reference === input;
      const requiredSalary =
        baseReason != null
          ? null
          : isReference
            ? input.salary
            : minimumSalaryForTarget(targetMonthly as number, input.city);
      const unavailableReason =
        baseReason ??
        (finiteOrNull(input.city.r1) == null
          ? 'The target city’s 1BR rent is unavailable.'
          : requiredSalary == null
            ? 'No salary up to the modeled maximum reaches this spending room.'
            : null);
      return {
        city: comparisonCity(input.city),
        committedSalary: input.salary,
        committedSalaryValue: displayMoney(input.salary),
        requiredSalary,
        requiredSalaryValue: displayMoney(requiredSalary),
        unavailableReason,
        isReference
      };
    })
  };
}
