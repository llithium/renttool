import { describe, expect, it } from 'vitest';
import { city } from '../../../tests/fixtures/city';
import {
  COMPARISON_STORAGE_KEY,
  DEFAULT_COMPARISON_SALARY,
  LEGACY_PLAN_STORAGE_KEY,
  LEGACY_SALARIES_STORAGE_KEY,
  MAX_COMPARISON_ENTRIES,
  ComparisonSet
} from './comparisonSet.svelte';

function createMemoryComparisonStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    read: (key: string) => values.get(key) ?? null,
    write: (key: string, value: string) => {
      values.set(key, value);
      return true;
    }
  };
}

const cities = Array.from({ length: MAX_COMPARISON_ENTRIES + 1 }, (_, index) =>
  city(`City ${index}, ZZ`, 1_000 + index * 100)
);

describe('ComparisonSet', () => {
  it('normalizes replacement and restored salaries without committing zero', () => {
    const storage = createMemoryComparisonStorage();
    const set = new ComparisonSet({ storage });
    set.replace([
      { city: cities[0], salary: 0.1 },
      { city: cities[1], salary: 123.8 }
    ]);
    expect(set.entries.map((entry) => entry.salary)).toEqual([124]);
    expect(set.setSalary(cities[1].name, 0.1)).toBe(false);
    storage.write(
      COMPARISON_STORAGE_KEY,
      JSON.stringify({
        entries: [
          { city: cities[0], salary: 0.1 },
          { city: cities[1], salary: 123.8 }
        ]
      })
    );
    const restored = new ComparisonSet({ storage });
    restored.restore({ resolveCity: () => null });
    expect(restored.entries.map((entry) => entry.salary)).toEqual([124]);
  });

  it('commits each added city with an independent initialized salary', () => {
    const storage = createMemoryComparisonStorage();
    const comparison = new ComparisonSet({ storage });

    const first = comparison.add(cities[0], 92_000.4);
    const second = comparison.add(cities[1], null);

    expect(first).toMatchObject({ status: 'added', name: cities[0].name, salary: 92_000 });
    expect(second).toMatchObject({
      status: 'added',
      name: cities[1].name,
      salary: DEFAULT_COMPARISON_SALARY
    });
    expect(comparison.entries.map(({ city, salary }) => ({ name: city.name, salary }))).toEqual([
      { name: cities[0].name, salary: 92_000 },
      { name: cities[1].name, salary: DEFAULT_COMPARISON_SALARY }
    ]);

    expect(comparison.setSalary(cities[0].name, 71_000)).toBe(true);
    expect(comparison.entries.map((entry) => entry.salary)).toEqual([
      71_000,
      DEFAULT_COMPARISON_SALARY
    ]);

    const saved = JSON.parse(storage.read(COMPARISON_STORAGE_KEY) ?? '{}');
    expect(
      saved.entries.map((entry: { city: { name: string }; salary: number }) => entry.salary)
    ).toEqual([71_000, DEFAULT_COMPARISON_SALARY]);

    expect(comparison.remove(cities[0].name)).toBe(true);
    expect(JSON.parse(storage.read(COMPARISON_STORAGE_KEY) ?? '{}').entries).toHaveLength(1);
    comparison.clear();
    expect(JSON.parse(storage.read(COMPARISON_STORAGE_KEY) ?? '{}').entries).toEqual([]);
  });

  it('returns explicit duplicate and full outcomes without resolving or persisting partial entries', () => {
    const storage = createMemoryComparisonStorage();
    const comparison = new ComparisonSet({ storage });

    expect(comparison.add(cities[0], 80_000).status).toBe('added');
    expect(
      comparison.add({ ...cities[0], name: cities[0].name.toLowerCase() }, 90_000)
    ).toMatchObject({
      status: 'already-compared',
      name: cities[0].name
    });

    for (let index = 1; index < MAX_COMPARISON_ENTRIES; index += 1) {
      expect(comparison.add(cities[index], 80_000).status).toBe('added');
    }

    const before = storage.read(COMPARISON_STORAGE_KEY);
    expect(comparison.add(cities[MAX_COMPARISON_ENTRIES], 80_000)).toMatchObject({
      status: 'full',
      name: cities[MAX_COMPARISON_ENTRIES].name
    });
    expect(comparison.entries).toHaveLength(MAX_COMPARISON_ENTRIES);
    expect(storage.read(COMPARISON_STORAGE_KEY)).toBe(before);
  });

  it('keeps in-memory behavior when persistence is unavailable', () => {
    const comparison = new ComparisonSet({
      storage: {
        read: () => null,
        write: () => false
      }
    });

    expect(comparison.add(cities[0], 80_000).status).toBe('added');
    expect(comparison.setSalary(cities[0].name, 81_000)).toBe(true);
    expect(comparison.remove(cities[0].name)).toBe(true);
    expect(comparison.entries).toEqual([]);
  });

  it('migrates legacy comparison cities and salaries into complete entries', () => {
    const legacyPlan = JSON.stringify({
      salary: 72_000,
      compare: [cities[0].name, cities[1].name]
    });
    const storage = createMemoryComparisonStorage({
      [LEGACY_PLAN_STORAGE_KEY]: legacyPlan,
      [LEGACY_SALARIES_STORAGE_KEY]: JSON.stringify({
        [cities[0].name]: 91_000,
        [cities[1].name]: 'bad'
      })
    });
    const comparison = new ComparisonSet({ storage });

    const result = comparison.restore({
      resolveCity: (name) => cities.find((city) => city.name === name) ?? null
    });

    expect(result.source).toBe('migrated');
    expect(comparison.entries.map((entry) => entry.salary)).toEqual([91_000, 72_000]);
    expect(JSON.parse(storage.read(COMPARISON_STORAGE_KEY) ?? '{}').entries).toHaveLength(2);
    expect(storage.read(LEGACY_PLAN_STORAGE_KEY)).toBe(legacyPlan);
  });

  it('does not discard legacy data when migration persistence fails', () => {
    const legacyPlan = JSON.stringify({ compare: [cities[0].name] });
    const storage = {
      read: (key: string) => (key === LEGACY_PLAN_STORAGE_KEY ? legacyPlan : null),
      write: () => false
    };
    const comparison = new ComparisonSet({ storage });

    const result = comparison.restore({ resolveCity: () => cities[0] });

    expect(result.source).toBe('failed');
    expect(comparison.entries[0]).toMatchObject({
      city: { name: cities[0].name },
      salary: DEFAULT_COMPARISON_SALARY
    });
    expect(storage.read(LEGACY_PLAN_STORAGE_KEY)).toBe(legacyPlan);
  });

  it('restores the complete representation before considering legacy records', () => {
    const current = JSON.stringify({
      version: 1,
      entries: [{ city: cities[0], salary: 63_000 }]
    });
    const storage = createMemoryComparisonStorage({
      [COMPARISON_STORAGE_KEY]: current,
      [LEGACY_PLAN_STORAGE_KEY]: JSON.stringify({ compare: [cities[1].name] })
    });
    const comparison = new ComparisonSet({ storage });

    const result = comparison.restore({
      resolveCity: () => {
        throw new Error('legacy state must not be consulted');
      }
    });

    expect(result.source).toBe('current');
    expect(comparison.entries).toMatchObject([{ city: { name: cities[0].name }, salary: 63_000 }]);
  });
});
