import { describe, expect, it } from 'vitest';
import {
  formatSalaryInput,
  normalizeSalary,
  parseSalaryInput,
  sanitizeSalaryInput
} from './salary';

describe('salary input', () => {
  it('treats short values as thousands', () => {
    expect(parseSalaryInput('63')).toBe(63_000);
    expect(formatSalaryInput('63')).toBe('63,000');
  });

  it('does not expand full salary values', () => {
    expect(parseSalaryInput('63,000')).toBe(63_000);
    expect(formatSalaryInput('63000')).toBe('63,000');
  });

  it('sanitizes pasted and typed input', () => {
    expect(sanitizeSalaryInput(' $63k / year ')).toBe('63');
    expect(parseSalaryInput('USD 72.5k')).toBe(725_000);
    expect(parseSalaryInput('no salary')).toBeNull();
  });

  it('normalizes before validating committed salaries', () => {
    expect(normalizeSalary(0.1)).toBeNull();
    expect(normalizeSalary(63_000.4)).toBe(63_000);
    expect(normalizeSalary(Infinity)).toBeNull();
  });
});
