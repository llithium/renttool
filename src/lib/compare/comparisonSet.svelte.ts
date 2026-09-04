import { restoreCity } from '$lib/cityCatalog.svelte';
import { cityIdentity } from '$lib/cityIdentity';
import { normalizeSalary } from '$lib/salary';
import type { City } from '$lib/types';

export const DEFAULT_COMPARISON_SALARY = 80_000;
export const MAX_COMPARISON_ENTRIES = 5;
export const COMPARISON_STORAGE_KEY = 'rentToolComparison.v1';
export const LEGACY_PLAN_STORAGE_KEY = 'rentToolLast.v3';
export const LEGACY_PLAN_V2_STORAGE_KEY = 'rentToolLast.v2';
export const LEGACY_SALARIES_STORAGE_KEY = 'rentToolCompareSalaries.v1';

export interface ComparisonEntry {
  readonly city: City;
  readonly salary: number;
}

export interface ComparisonStorage {
  read: (key: string) => string | null;
  write: (key: string, value: string) => void | boolean;
}

export interface ComparisonSetOptions {
  storage?: ComparisonStorage;
}

export type ComparisonAddResult =
  | {
      status: 'added';
      name: string;
      city: City;
      salary: number;
      rentAvailable: boolean;
    }
  | { status: 'already-compared'; name: string; city: City; salary: number }
  | { status: 'full'; name: string };

export interface RestoreComparisonOptions {
  resolveCity: (name: string) => City | null;
}

export type RestoreComparisonResult = {
  source: 'current' | 'migrated' | 'none' | 'failed';
  entries: readonly ComparisonEntry[];
};

function isValidCommittedSalary(value: unknown): value is number {
  return normalizeSalary(value) != null;
}

function committedSalary(value: number | null | undefined): number {
  return normalizeSalary(value) ?? DEFAULT_COMPARISON_SALARY;
}

export const browserComparisonStorage: ComparisonStorage = {
  read: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
};

function cloneEntry(entry: ComparisonEntry): ComparisonEntry {
  return { city: { ...entry.city }, salary: entry.salary };
}

function validEntry(value: unknown): value is {
  city?: unknown;
  salary: unknown;
  name?: unknown;
} {
  return Boolean(value && typeof value === 'object' && 'salary' in value);
}

function readObject(raw: string | null): Record<string, unknown> | null {
  if (raw == null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readSalaryRecord(raw: string | null): Record<string, number> {
  const value = readObject(raw);
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] =>
      isValidCommittedSalary(entry[1])
    )
  );
}

function salaryForName(salaries: Record<string, number>, name: string): number | null {
  const exact = salaries[name];
  const exactNormalized = normalizeSalary(exact);
  if (exactNormalized != null) return exactNormalized;
  const key = cityIdentity(name);
  const match = Object.entries(salaries).find(([storedName]) => cityIdentity(storedName) === key);
  return match ? normalizeSalary(match[1]) : null;
}

function legacyPlan(raw: string | null): { names: string[]; salary: number | null } | null {
  const value = readObject(raw);
  if (!value) return null;
  const names = Array.isArray(value.compare)
    ? value.compare.filter((name): name is string => typeof name === 'string')
    : [];
  return {
    names,
    salary: normalizeSalary(value.salary)
  };
}

function currentEntries(
  raw: string | null,
  resolveCity?: (name: string) => City | null
): ComparisonEntry[] | null {
  const value = readObject(raw);
  if (!value || !Array.isArray(value.entries)) return null;
  const entries: ComparisonEntry[] = [];
  const seen = new Set<string>();
  for (const candidate of value.entries) {
    if (!validEntry(candidate)) continue;
    const salary = normalizeSalary(candidate.salary);
    if (salary == null) continue;
    const city =
      restoreCity(candidate.city) ??
      (typeof candidate.city === 'string' ? resolveCity?.(candidate.city) : null) ??
      (typeof candidate.name === 'string' ? resolveCity?.(candidate.name) : null);
    if (!city || seen.has(cityIdentity(city.name))) continue;
    seen.add(cityIdentity(city.name));
    entries.push({ city, salary });
    if (entries.length >= MAX_COMPARISON_ENTRIES) break;
  }
  return entries;
}

/**
 * Owns the complete comparison set: city membership, committed salaries,
 * lifecycle rules, persistence, restoration, and migration.
 */
export class ComparisonSet {
  private entriesValue = $state<ComparisonEntry[]>([]);
  private readonly storage: ComparisonStorage;

  constructor(options: ComparisonSetOptions = {}) {
    this.storage = options.storage ?? browserComparisonStorage;
  }

  get entries(): readonly ComparisonEntry[] {
    return this.entriesValue;
  }

  get cities(): readonly City[] {
    return this.entriesValue.map((entry) => entry.city);
  }

  get names(): readonly string[] {
    return this.entriesValue.map((entry) => entry.city.name);
  }

  get size(): number {
    return this.entriesValue.length;
  }

  isComparing(name: string): boolean {
    return this.entriesValue.some((entry) => cityIdentity(entry.city.name) === cityIdentity(name));
  }

  add(city: City, initialSalary: number | null): ComparisonAddResult {
    const existing = this.entriesValue.find(
      (entry) => cityIdentity(entry.city.name) === cityIdentity(city.name)
    );
    if (existing) {
      return {
        status: 'already-compared',
        name: existing.city.name,
        city: existing.city,
        salary: existing.salary
      };
    }
    if (this.entriesValue.length >= MAX_COMPARISON_ENTRIES) {
      return { status: 'full', name: city.name };
    }

    const entry: ComparisonEntry = {
      city: { ...city },
      salary: committedSalary(initialSalary)
    };
    this.entriesValue = [...this.entriesValue, entry];
    this.persist();
    return {
      status: 'added',
      name: entry.city.name,
      city: entry.city,
      salary: entry.salary,
      rentAvailable: entry.city.r1 != null
    };
  }

  /** Commit one valid salary; presentation drafts never cross this seam. */
  setSalary(name: string, value: number): boolean {
    const salary = normalizeSalary(value);
    if (salary == null) return false;
    const index = this.entriesValue.findIndex(
      (entry) => cityIdentity(entry.city.name) === cityIdentity(name)
    );
    if (index < 0) return false;
    const next = [...this.entriesValue];
    next[index] = { ...next[index], salary };
    this.entriesValue = next;
    this.persist();
    return true;
  }

  /** Keep a complete entry current when the rent-plan resolver hydrates its city. */
  updateCity(city: City): boolean {
    const index = this.entriesValue.findIndex(
      (entry) => cityIdentity(entry.city.name) === cityIdentity(city.name)
    );
    if (index < 0) return false;
    const next = [...this.entriesValue];
    next[index] = { ...next[index], city: { ...city } };
    this.entriesValue = next;
    this.persist();
    return true;
  }

  remove(name: string): boolean {
    const next = this.entriesValue.filter(
      (entry) => cityIdentity(entry.city.name) !== cityIdentity(name)
    );
    if (next.length === this.entriesValue.length) return false;
    this.entriesValue = next;
    this.persist();
    return true;
  }

  clear(): void {
    if (!this.entriesValue.length) return;
    this.entriesValue = [];
    this.persist();
  }

  /** Replace the set atomically with already-resolved, complete entries. */
  replace(entries: readonly ComparisonEntry[]): void {
    const next: ComparisonEntry[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      if (!entry || !entry.city) continue;
      const salary = normalizeSalary(entry.salary);
      if (salary == null) continue;
      const key = cityIdentity(entry.city.name);
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(cloneEntry({ ...entry, salary }));
      if (next.length >= MAX_COMPARISON_ENTRIES) break;
    }
    this.entriesValue = next;
    this.persist();
  }

  /** Restore the current representation, or migrate the two legacy records. */
  restore(options: RestoreComparisonOptions): RestoreComparisonResult {
    const currentRaw = this.safeRead(COMPARISON_STORAGE_KEY);
    const current = currentEntries(currentRaw, options.resolveCity);
    if (current) {
      this.entriesValue = current.map(cloneEntry);
      return { source: 'current', entries: this.entriesValue };
    }

    const legacyRaw =
      this.safeRead(LEGACY_PLAN_STORAGE_KEY) ?? this.safeRead(LEGACY_PLAN_V2_STORAGE_KEY);
    const plan = legacyPlan(legacyRaw);
    if (!plan) return { source: legacyRaw == null ? 'none' : 'failed', entries: this.entriesValue };

    const salaries = readSalaryRecord(this.safeRead(LEGACY_SALARIES_STORAGE_KEY));
    const next: ComparisonEntry[] = [];
    const seen = new Set<string>();
    for (const name of plan.names) {
      const city = options.resolveCity(name);
      if (!city) {
        return { source: 'failed', entries: this.entriesValue };
      }
      const key = cityIdentity(city.name);
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({
        city: { ...city },
        salary: salaryForName(salaries, city.name) ?? plan.salary ?? DEFAULT_COMPARISON_SALARY
      });
      if (next.length >= MAX_COMPARISON_ENTRIES) break;
    }

    this.entriesValue = next;
    const migrated = this.persist();
    return {
      source: migrated ? 'migrated' : 'failed',
      entries: this.entriesValue
    };
  }

  private safeRead(key: string): string | null {
    try {
      return this.storage.read(key);
    } catch {
      return null;
    }
  }

  private persist(): boolean {
    try {
      const value = JSON.stringify({
        version: 1,
        entries: this.entriesValue.map((entry) => ({
          city: entry.city,
          salary: entry.salary
        }))
      });
      return this.storage.write(COMPARISON_STORAGE_KEY, value) !== false;
    } catch {
      return false;
    }
  }
}
