import {
  DEFAULT_COMPARISON_SALARY,
  MAX_COMPARISON_ENTRIES
} from '$lib/compare/comparisonSet.svelte';
import { isValidCoordinates } from '$lib/geo';
import { MAX_SALARY } from '$lib/salary';
import type { RentSource } from '$lib/types';

export const COMPARISON_SALARY_PARAM = 'compare-salary';

export interface PlanCityInput {
  readonly name: string;
  readonly source: RentSource;
  readonly lat?: number;
  readonly lng?: number;
}

export interface PlanComparisonInput {
  readonly city: PlanCityInput;
  readonly salary?: number | null;
}

export interface RentPlanRepresentationInput {
  readonly salary?: number | null;
  readonly selected?: PlanCityInput | null;
  readonly comparisons?: readonly PlanComparisonInput[];
}

export interface RestoredPlanCity {
  readonly name: string;
  readonly kind: 'bundled' | 'off-list' | 'invalid';
  readonly lat?: number;
  readonly lng?: number;
}

export interface RestoredComparisonEntry {
  readonly city: RestoredPlanCity;
  readonly salary: number;
}

export interface RestoredRentPlan {
  readonly salary: number | null;
  readonly selected: RestoredPlanCity | null;
  readonly comparisons: readonly RestoredComparisonEntry[];
  /** True when the URL contains comparison state, even if every value is invalid. */
  readonly hasComparisonState: boolean;
}

type EncodedCityKind = 'bundled' | 'off-list';

interface NormalizedCity {
  name: string;
  kind: EncodedCityKind;
  lat?: number;
  lng?: number;
}

interface ParsedOffListValue {
  city: NormalizedCity;
  salary: number | null;
}

function nameKey(name: string): string {
  return name.toLowerCase();
}

function validName(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) return false;
  const match = value.match(/,\s*([A-Za-z]{2})$/);
  return Boolean(match && value.slice(0, match.index).trim().length);
}

function validCoordinate(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
  );
}

export { isValidCoordinates } from '$lib/geo';

function normalizedSalary(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_SALARY) {
    return null;
  }
  const rounded = Math.round(value);
  return rounded > 0 && rounded <= MAX_SALARY ? rounded : null;
}

function normalizedCity(input: PlanCityInput | null | undefined): NormalizedCity | null {
  if (!input || !validName(input.name)) return null;
  if (input.source === 'apartment-list') {
    return { name: input.name, kind: 'bundled' };
  }
  if (!isValidCoordinates(input.lat, input.lng)) {
    return null;
  }
  return { name: input.name, kind: 'off-list', lat: input.lat, lng: input.lng };
}

function appendCity(search: URLSearchParams, city: NormalizedCity, parameter: string): void {
  if (city.kind === 'bundled') {
    search.append(parameter, city.name);
    return;
  }
  search.append(parameter, JSON.stringify({ name: city.name, lat: city.lat, lng: city.lng }));
}

/** Append the canonical repeated comparison parameters to an existing query. */
export function appendComparisonParameters(
  search: URLSearchParams,
  inputs: readonly PlanComparisonInput[]
): void {
  const seen = new Set<string>();
  let count = 0;
  for (const input of inputs) {
    if (count >= MAX_COMPARISON_ENTRIES) break;
    const city = normalizedCity(input.city);
    if (!city) continue;
    const key = nameKey(city.name);
    if (seen.has(key)) continue;
    seen.add(key);
    appendCity(search, city, city.kind === 'bundled' ? 'compare' : 'compare-offlist');
    const salary = normalizedSalary(input.salary);
    if (salary != null) {
      search.append(COMPARISON_SALARY_PARAM, comparisonSalaryLink(city.name, salary));
    }
    count += 1;
  }
}

/** Serialize the shareable rent plan into a canonical query string. */
export function serializeRentPlan(input: RentPlanRepresentationInput): string {
  const search = new URLSearchParams();
  const salary = normalizedSalary(input.salary);
  if (salary != null) search.set('salary', String(salary));

  const selected = normalizedCity(input.selected);
  if (selected) {
    if (selected.kind === 'bundled') {
      search.set('city', selected.name);
    } else {
      search.set('city', selected.name);
      search.set('lat', String(selected.lat));
      search.set('lng', String(selected.lng));
    }
  }

  appendComparisonParameters(search, input.comparisons ?? []);
  return search.toString();
}

/** Build a path whose query is the canonical shareable rent-plan representation. */
export function rentPlanHref(pathname: string, input: RentPlanRepresentationInput): string {
  const search = serializeRentPlan(input);
  return search ? `${pathname}?${search}` : pathname;
}

function parseNumeric(raw: string | null): number | null {
  if (raw == null || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseSalary(raw: string | null): number | null {
  const value = parseNumeric(raw);
  return normalizedSalary(value);
}

function parseCoordinate(raw: string | null, minimum: number, maximum: number): number | null {
  const value = parseNumeric(raw);
  return validCoordinate(value, minimum, maximum) ? value : null;
}

export function comparisonSalaryLink(name: string, salary: number): string {
  return JSON.stringify({ name, salary: Math.round(salary) });
}

export function parseComparisonSalaryLink(raw: string): { name: string; salary: number } | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const salary = normalizedSalary(record.salary);
    if (!validName(record.name) || salary == null) return null;
    return { name: record.name, salary };
  } catch {
    return null;
  }
}

function parseOffListValue(raw: string): ParsedOffListValue | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (
      !validName(record.name) ||
      typeof record.lat !== 'number' ||
      typeof record.lng !== 'number' ||
      !isValidCoordinates(record.lat, record.lng)
    ) {
      return null;
    }
    return {
      city: { name: record.name, kind: 'off-list', lat: record.lat, lng: record.lng },
      salary: normalizedSalary(record.salary)
    };
  } catch {
    return null;
  }
}

function parseSelected(search: URLSearchParams): RestoredPlanCity | null {
  const name = search.get('city');
  if (!validName(name)) return null;
  const lat = parseCoordinate(search.get('lat'), -90, 90);
  const lng = parseCoordinate(search.get('lng'), -180, 180);
  const hasCoordinates = search.has('lat') || search.has('lng');
  return lat != null && lng != null
    ? { name, kind: 'off-list', lat, lng }
    : { name, kind: hasCoordinates ? 'invalid' : 'bundled' };
}

function comparisonSalaries(search: URLSearchParams): {
  byName: Map<string, number>;
  positional: number[];
} {
  const byName = new Map<string, number>();
  const positional: number[] = [];
  for (const raw of search.getAll(COMPARISON_SALARY_PARAM)) {
    const named = parseComparisonSalaryLink(raw);
    if (named) {
      byName.set(nameKey(named.name), named.salary);
      continue;
    }
    const positionalSalary = parseSalary(raw);
    if (positionalSalary != null) positional.push(positionalSalary);
  }
  return { byName, positional };
}

/** Restore and validate the canonical or issue #9-compatible URL representation. */
export function restoreRentPlan(search: URLSearchParams): RestoredRentPlan {
  const salaries = comparisonSalaries(search);
  const comparisons: RestoredComparisonEntry[] = [];
  const seen = new Set<string>();
  let entryIndex = 0;

  for (const [key, value] of search) {
    let city: NormalizedCity | null = null;
    let inlineSalary: number | null = null;
    if (key === 'compare' && validName(value)) {
      city = { name: value, kind: 'bundled' };
    } else if (key === 'compare-offlist') {
      const parsed = parseOffListValue(value);
      city = parsed?.city ?? null;
      inlineSalary = parsed?.salary ?? null;
    }
    if (!city) continue;

    const identity = nameKey(city.name);
    if (seen.has(identity) || comparisons.length >= MAX_COMPARISON_ENTRIES) continue;
    seen.add(identity);
    comparisons.push({
      city,
      salary:
        salaries.byName.get(identity) ??
        inlineSalary ??
        salaries.positional[entryIndex] ??
        parseSalary(search.get('salary')) ??
        DEFAULT_COMPARISON_SALARY
    });
    entryIndex += 1;
  }

  return {
    salary: parseSalary(search.get('salary')),
    selected: parseSelected(search),
    comparisons,
    hasComparisonState:
      search.has('compare') || search.has('compare-offlist') || search.has(COMPARISON_SALARY_PARAM)
  };
}

function restoredCityInput(city: RestoredPlanCity): PlanCityInput | null {
  if (city.kind === 'bundled') return { name: city.name, source: 'apartment-list' };
  if (city.kind !== 'off-list' || city.lat == null || city.lng == null) return null;
  return { name: city.name, source: 'hud-fmr', lat: city.lat, lng: city.lng };
}

/** Normalize a URL through the same representation used for generated links. */
export function canonicalizeRentPlanSearch(search: URLSearchParams): string {
  const restored = restoreRentPlan(search);
  const selected = restored.selected ? restoredCityInput(restored.selected) : null;
  const comparisons = restored.comparisons.flatMap((entry) => {
    const city = restoredCityInput(entry.city);
    return city ? [{ city, salary: entry.salary }] : [];
  });
  return serializeRentPlan({ salary: restored.salary, selected, comparisons });
}
