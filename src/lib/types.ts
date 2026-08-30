/** Source of the rent figures currently shown for a city. */
export type RentSource = 'apartment-list' | 'hud-fmr' | 'none';

/** What the rent number represents. Sources are not directly interchangeable. */
export type RentMetric = 'estimated-median' | 'fair-market-rent' | 'unknown';

/** Structured city-level facts from a dated ACS 5-year release. */
export interface CitySnapshot {
  population: number;
  householdIncome: number;
  commuteMinutes: number;
  renterShare: number;
  rentalVacancy: number;
}

/** A city record: curated context merged with bundled rent figures. */
export interface City {
  /** Canonical "City, ST" key. */
  name: string;
  city: string;
  state: string;
  /** Median 1BR rent, monthly USD. */
  r1: number | null;
  /** Median 2BR rent, monthly USD. */
  r2: number | null;
  /** 1BR year-over-year change, percent. null = unknown. */
  yoy: number | null;
  /** State/local income-tax note. */
  tax: string;
  /** Display population; ACS place estimate when available. */
  pop: string;
  /** Structured, bundled ACS place facts. */
  citySnapshot: CitySnapshot | null;
  lat?: number;
  lng?: number;
  /** Where r1/r2/yoy came from. */
  source: RentSource;
  /** Statistical meaning, geography, and vintage of the rent figures. */
  rentMetric: RentMetric;
  rentArea: string;
  rentYear: string;
}

/** Autocomplete suggestion returned by /api/city-suggest or the local seed index. */
export interface CitySuggestion {
  label: string; // "City, ST"
  city: string;
  state: string;
  /** Remote suggestions include coordinates; bundled seed matches may not. */
  lat?: number;
  lng?: number;
}

/** A credited Unsplash image from the checked-in city-image manifest. */
export interface CityImage {
  id: string;
  url: string;
  alt: string;
  photoUrl: string;
  photographerName: string;
  photographerUrl: string;
  source: 'unsplash';
  sourceUrl: string;
}

/** A nearby place returned by /api/nearby (OpenStreetMap via Overpass). */
export interface NearbyPlace {
  label: string; // "City, ST"
  city: string;
  state: string;
  lat: number;
  lng: number;
  miles: number;
  /** Urban-population estimate from the bundled places dataset. */
  pop: number | null;
}

/** Result of resolving bundled HUD rent for an off-list city. */
export interface LookupResult {
  r1: number | null;
  r2: number | null;
  yoy: number | null;
  source: RentSource;
  rentMetric: RentMetric;
  rentArea: string;
  rentYear: string;
  lat?: number;
  lng?: number;
}

/** One cell in a StatGrid: a figure with its label and an optional colour cue. */
export interface Stat {
  label: string;
  value: string;
  tone?: 'up' | 'down';
}

/** Computed rent budget for a salary, with an estimated take-home breakdown. */
export interface Budget {
  grossMonthly: number;
  maxRent: number; // 30% rule
  comfyRent: number; // 25% rule
  takeHomeMonthly: number; // after federal + FICA + state tax
  federalMonthly: number; // federal income tax
  ficaMonthly: number; // Social Security + Medicare
  stateMonthly: number; // state income tax
  stateRate: number; // state fraction — for the "no state tax" note
  localMonthly: number; // modeled city/local income tax
  localRate: number; // city/local effective-rate estimate
  localTaxModeled: boolean; // false means a possible local tax is not included
  taxAssumptions: string;
  effRate: number; // total tax / gross, for the summary label
}
