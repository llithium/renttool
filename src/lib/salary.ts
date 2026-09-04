export const MAX_SALARY = 10_000_000;

/** Round first, then validate the committed salary invariant. */
export function normalizeSalary(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 && rounded <= MAX_SALARY ? rounded : null;
}

/** Keep only decimal digits from a user-entered salary. */
export function sanitizeSalaryInput(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Parse salary input, treating values below 1,000 as shorthand for thousands.
 * For example, "63" becomes 63,000 while "63,000" remains 63,000.
 */
export function parseSalaryInput(value: string): number | null {
  const digits = sanitizeSalaryInput(value);
  if (!digits) return null;

  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed > 0 && parsed < 1_000 ? parsed * 1_000 : parsed;
}

export function formatSalaryInput(value: string): string {
  const parsed = parseSalaryInput(value);
  return parsed == null ? '' : parsed.toLocaleString();
}
