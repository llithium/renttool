import { computeBudget } from '$lib/budget';
import { money } from '$lib/format';
import { MAX_SALARY } from '$lib/salary';
import type { City } from '$lib/types';
import {
  toComparisonCity,
  type ComparisonCity,
  type ComparisonEntryInput
} from './comparisonModel';

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
        city: toComparisonCity(input.city),
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
