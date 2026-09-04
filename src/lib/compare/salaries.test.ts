import { describe, expect, it, vi } from 'vitest';
import { city } from '../../../tests/fixtures/city';
import { createCompareSalaries } from './salaries.svelte';

function input(value: string): Event {
  return { target: { value } } as unknown as Event;
}

describe('comparison salary presentation', () => {
  it('commits valid numeric edits while invalid drafts leave the committed value alone', () => {
    const onSalaryChange = vi.fn();
    const salaries = createCompareSalaries(onSalaryChange);
    const entry = { city: city('Alpha, ZZ', 1_200), salary: 80_000 };
    salaries.sync([entry]);

    salaries.oninput(entry.city.name, input('60'));
    expect(onSalaryChange).toHaveBeenLastCalledWith(entry.city.name, 60_000);
    expect(salaries.displayed(entry.city.name, entry.salary)).toBe('60');
    expect(salaries.errors[entry.city.name]).toBe('');

    salaries.oninput(entry.city.name, input('10000001'));
    expect(onSalaryChange).toHaveBeenCalledTimes(1);
    expect(salaries.errors[entry.city.name]).toBe('Use $10,000,000 or less.');

    salaries.oninput(entry.city.name, input(''));
    expect(onSalaryChange).toHaveBeenCalledTimes(1);
    expect(salaries.errors[entry.city.name]).toBe('Enter a salary.');
  });

  it('formats a valid draft on blur and drops drafts for removed entries', () => {
    const salaries = createCompareSalaries();
    const entry = { city: city('Alpha, ZZ', 1_200), salary: 80_000 };
    salaries.sync([entry]);

    salaries.oninput(entry.city.name, input('60'));
    salaries.commit(entry.city.name);
    expect(salaries.displayed(entry.city.name, entry.salary)).toBe('60,000');

    salaries.sync([]);
    salaries.sync([entry]);
    expect(salaries.displayed(entry.city.name, entry.salary)).toBe('80,000');
  });
});
