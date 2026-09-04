import type { Budget, City } from '$lib/types';

/** Rough *effective* state income-tax rate by state, for a typical
 * mid-career salary. This is a deliberate estimate to power the take-home visual — not tax
 * advice. States with no wage income tax are 0. */
export const EST_STATE_RATE: Record<string, number> = {
  AL: 0.045,
  AK: 0,
  AR: 0.039,
  AZ: 0.025,
  CA: 0.06,
  CO: 0.044,
  CT: 0.055,
  DC: 0.075,
  DE: 0.05,
  FL: 0,
  GA: 0.0499,
  HI: 0.079,
  ID: 0.053,
  IL: 0.0495,
  IN: 0.0295,
  IA: 0.038,
  KS: 0.052,
  KY: 0.035,
  LA: 0.03,
  MA: 0.05,
  MD: 0.045,
  ME: 0.065,
  MI: 0.0425,
  MN: 0.068,
  MO: 0.047,
  MS: 0.044,
  MT: 0.055,
  NC: 0.0399,
  ND: 0.02,
  NE: 0.045,
  NV: 0,
  NH: 0,
  NJ: 0.05,
  NM: 0.045,
  NY: 0.06,
  OH: 0.025,
  OK: 0.045,
  OR: 0.085,
  PA: 0.0307,
  RI: 0.045,
  SC: 0.055,
  SD: 0,
  TN: 0,
  TX: 0,
  UT: 0.0455,
  VA: 0.0525,
  VT: 0.06,
  WA: 0,
  WI: 0.055,
  WV: 0.048,
  WY: 0
};

/** Approximate effective local wage-income-tax rates for jurisdictions in the curated set. */
export const EST_LOCAL_RATE: Record<string, number> = {
  'Akron, OH': 0.025,
  'Baltimore, MD': 0.032,
  'Birmingham, AL': 0.01,
  'Cincinnati, OH': 0.018,
  'Cleveland, OH': 0.025,
  'Columbus, OH': 0.025,
  'Indianapolis, IN': 0.02,
  'New York, NY': 0.035,
  'Philadelphia, PA': 0.0374,
  'Pittsburgh, PA': 0.03,
  'St Louis, MO': 0.01,
  'Toledo, OH': 0.025
};

// --- Federal, single filer (official 2026 figures, source: Tax Foundation) ---
// Assumes standard deduction; used only for the take-home estimate, not tax advice.
const FED_STD_DEDUCTION = 16_100; // 2026 single standard deduction
/** 2026 single-filer marginal brackets as [upper-bound of taxable income, rate]; last is the top rate. */
const FED_BRACKETS: [number, number][] = [
  [12_400, 0.1],
  [50_400, 0.12],
  [105_700, 0.22],
  [201_775, 0.24],
  [256_225, 0.32],
  [640_600, 0.35],
  [Infinity, 0.37]
];

// FICA (2026)
const SS_RATE = 0.062;
const SS_WAGE_BASE = 184_500; // 2026 Social Security wage base
const MEDICARE_RATE = 0.0145;
const ADDL_MEDICARE_RATE = 0.009;
const ADDL_MEDICARE_THRESHOLD = 200_000; // single filer

/** Estimated federal income tax on a salary (single filer, standard deduction). */
export function federalTax(salary: number): number {
  const taxable = Math.max(0, salary - FED_STD_DEDUCTION);
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of FED_BRACKETS) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

/** Estimated FICA payroll tax (Social Security + Medicare + additional Medicare surtax). */
export function ficaTax(wages: number): number {
  const ss = Math.min(wages, SS_WAGE_BASE) * SS_RATE;
  const medicare = wages * MEDICARE_RATE;
  const addl = Math.max(0, wages - ADDL_MEDICARE_THRESHOLD) * ADDL_MEDICARE_RATE;
  return ss + medicare + addl;
}

/** Compute the 30%-rule budget plus an estimated take-home breakdown (federal + FICA + state). */
export function computeBudget(
  salary: number,
  location?: Pick<City, 'name' | 'state'> | string
): Budget {
  const grossMonthly = salary / 12;
  const state = typeof location === 'string' ? location : location?.state;
  const cityName = typeof location === 'string' ? '' : (location?.name ?? '');
  const stateRate = (state && EST_STATE_RATE[state.toUpperCase()]) || 0;
  const localTaxModeled = Object.hasOwn(EST_LOCAL_RATE, cityName);
  const localRate = localTaxModeled ? EST_LOCAL_RATE[cityName] : 0;

  const federalMonthly = federalTax(salary) / 12;
  const ficaMonthly = ficaTax(salary) / 12;
  const stateMonthly = grossMonthly * stateRate;
  const localMonthly = grossMonthly * localRate;
  const totalTaxMonthly = federalMonthly + ficaMonthly + stateMonthly + localMonthly;
  const takeHomeMonthly = Math.max(0, grossMonthly - totalTaxMonthly);

  return {
    grossMonthly,
    maxRent: grossMonthly * 0.3,
    comfyRent: grossMonthly * 0.25,
    takeHomeMonthly,
    federalMonthly,
    ficaMonthly,
    stateMonthly,
    stateRate,
    localMonthly,
    localRate,
    localTaxModeled,
    effRate: grossMonthly > 0 ? totalTaxMonthly / grossMonthly : 0
  };
}

/** Salary implied by a given monthly rent under the 30% rule (rent * 12 / 0.3 = rent * 40). */
export function salaryForRent(monthlyRent: number): number {
  return monthlyRent * 40;
}
