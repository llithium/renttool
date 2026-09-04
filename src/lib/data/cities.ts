import type { City, CitySnapshot } from '$lib/types';
import { COORDS } from './coordinates';
import apartmentListData from './apartment-list-rents.json';
import acsCityData from './acs-city-facts.json';
import { cityIdentity } from '$lib/cityIdentity';

/** Curated context layered over the bundled Apartment List city estimates. */
interface ApartmentListData {
  meta: {
    source: string;
    period: string;
    label: string;
    dataUrl: string;
    termsUrl: string;
  };
  cities: Record<string, { r1: number; r2: number; yoy: number; population: number }>;
}

interface AcsCityData {
  meta: {
    source: string;
    year: number;
    label: string;
    geography: string;
    dataUrl: string;
  };
  cities: Record<string, CitySnapshot>;
}

const RENT_DATA = apartmentListData as ApartmentListData;
export const RENT_DATA_META = RENT_DATA.meta;
const ACS_DATA = acsCityData as AcsCityData;
export const ACS_DATA_META = ACS_DATA.meta;

const TAX_OVERRIDES: Record<string, string> = {
  'Tampa, FL': 'None (FL has no state income tax)',
  'St Petersburg, FL': 'None (FL has no state income tax)',
  'Clearwater, FL': 'None (FL has no state income tax)',
  'Orlando, FL': 'None (FL has no state income tax)',
  'Fort Lauderdale, FL': 'None (FL has no state income tax)',
  'Tallahassee, FL': 'None (FL has no state income tax)',
  'Charlotte, NC': '3.99% flat (NC, 2026)',
  'Raleigh, NC': '3.99% flat (NC, 2026)',
  'Durham, NC': '3.99% flat (NC, 2026)',
  'Philadelphia, PA': '3.07% flat (PA) + ~3.74% Philadelphia city wage tax',
  'Pittsburgh, PA': '3.07% flat (PA) + ~3% local earned income tax in city',
  'Washington, DC': 'DC brackets 4%–10.75%',
  'Alexandria, VA': 'VA 2%–5.75%',
  'Baltimore, MD': 'MD 2%–5.75% + ~3.2% local county/city tax',
  'Richmond, VA': 'VA 2%–5.75%',
  'Dallas, TX': 'None (TX has no state income tax)',
  'Fort Worth, TX': 'None (TX has no state income tax)',
  'Irving, TX': 'None (TX has no state income tax)',
  'Houston, TX': 'None (TX has no state income tax)',
  'Nashville, TN': 'None (TN has no state income tax)',
  'Knoxville, TN': 'None (TN has no state income tax)',
  'Chattanooga, TN': 'None (TN has no state income tax)',
  'Memphis, TN': 'None (TN has no state income tax)',
  'Atlanta, GA': '4.99% flat (GA, 2026)',
  'Cincinnati, OH': '2.75% flat (OH, 2026) + ~1.8% city earnings tax',
  'Columbus, OH': '2.75% flat (OH, 2026) + 2.5% city earnings tax',
  'Cleveland, OH': '2.75% flat (OH, 2026) + 2.5% city earnings tax',
  'Akron, OH': '2.75% flat (OH, 2026) + 2.5% city earnings tax',
  'Toledo, OH': '2.75% flat (OH, 2026) + 2.5% city earnings tax',
  'St Louis, MO': 'MO 2%–4.7% + 1% city earnings tax',
  'Indianapolis, IN': '2.95% flat (IN, 2026) + ~2% county tax',
  'Milwaukee, WI': 'WI 3.5%–7.65%',
  'Phoenix, AZ': '2.5% flat (AZ)',
  'Oklahoma City, OK': 'OK top rate ~4.5% (cut in 2026)',
  'Omaha, NE': 'NE top rate ~4.55% (cutting annually)',
  'Sioux Falls, SD': 'None (SD has no state income tax)',
  'Birmingham, AL': 'AL 2%–5% + ~1% occupational tax in city',
  'Des Moines, IA': '3.8% flat (IA, 2026)',
  'New York, NY': 'NY 4%–10.9% + NYC city tax ~3–3.9%',
  'Providence, RI': 'RI 3.75%–5.99%',
  'Hartford, CT': 'CT 2%–6.99%',
  'Stamford, CT': 'CT 2%–6.99%',
  'Charleston, SC': 'SC top rate 6.2% (phasing down)',
  'Columbia, SC': 'SC top rate 6.2% (phasing down)'
};

/** Generic 2026 state income-tax notes for cities outside the detailed list. */
export const STATE_TAX: Record<string, string> = {
  AL: 'AL 2%–5%',
  AK: 'None (AK)',
  AR: 'AR top ~3.9% (2026)',
  AZ: '2.5% flat (AZ)',
  CA: 'CA 1%–13.3%',
  CO: '4.4% flat (CO)',
  CT: 'CT 2%–6.99%',
  DC: 'DC 4%–10.75%',
  DE: 'DE 2.2%–6.6%',
  FL: 'None (FL)',
  GA: '4.99% flat (GA, 2026)',
  HI: 'HI up to 11%',
  ID: '~5.3% flat (ID)',
  IL: '4.95% flat (IL)',
  IN: '2.95% flat (IN, 2026) + county',
  IA: '3.8% flat (IA)',
  KS: 'KS up to 5.58%',
  KY: '3.5% flat (KY, 2026)',
  LA: '3% flat (LA)',
  MA: '5% flat (MA, 9% over $1M)',
  MD: 'MD 2%–5.75% + local',
  ME: 'ME 5.8%–7.15%',
  MI: '4.25% flat (MI)',
  MN: 'MN 5.35%–9.85%',
  MO: 'MO 2%–4.7%',
  MS: 'MS ~4.4% flat (phasing down)',
  MT: 'MT top ~5.9%',
  NC: '3.99% flat (NC, 2026)',
  ND: 'ND up to 2.5%',
  NE: 'NE top ~4.55%',
  NV: 'None (NV)',
  NH: 'None on wages (NH)',
  NJ: 'NJ 1.4%–10.75%',
  NM: 'NM 1.7%–5.9%',
  NY: 'NY 4%–10.9%',
  OH: '2.75% flat (OH, 2026) + city',
  OK: 'OK top ~4.5%',
  OR: 'OR 4.75%–9.9%',
  PA: '3.07% flat (PA) + local',
  RI: 'RI 3.75%–5.99%',
  SC: 'SC top 6.2%',
  SD: 'None (SD)',
  TN: 'None (TN)',
  TX: 'None (TX)',
  UT: '4.55% flat (UT)',
  VA: 'VA 2%–5.75%',
  VT: 'VT 3.35%–8.75%',
  WA: 'None on wages (WA)',
  WI: 'WI 3.5%–7.65%',
  WV: 'WV ~4.8%',
  WY: 'None (WY)'
};

function stateOf(name: string): string {
  return (name.match(/,\s*([A-Za-z]{2})$/) || [])[1]?.toUpperCase() || '';
}

function cityOf(name: string): string {
  return name.replace(/,\s*[A-Za-z]{2}$/, '').trim();
}

/** Build the immutable seed city map keyed by canonical "City, ST". */
function buildSeed(): Map<string, City> {
  const map = new Map<string, City>();

  for (const [name, rent] of Object.entries(RENT_DATA.cities)) {
    const citySnapshot = ACS_DATA.cities[name] ?? null;
    const st = stateOf(name);
    const coord = COORDS[name];
    map.set(name, {
      name,
      city: cityOf(name),
      state: st,
      r1: rent.r1,
      r2: rent.r2,
      yoy: rent.yoy,
      tax: TAX_OVERRIDES[name] ?? STATE_TAX[st] ?? 'varies',
      pop: citySnapshot?.population ?? rent.population ?? null,
      populationSource: citySnapshot ? 'acs' : 'apartment-list',
      citySnapshot,
      lat: coord?.[0],
      lng: coord?.[1],
      source: 'apartment-list',
      rentMetric: 'estimated-median',
      rentArea: name,
      rentYear: RENT_DATA.meta.label
    });
  }

  return map;
}

/** The seed cities as an array, sorted by name. */
export const SEED_CITIES: City[] = [...buildSeed().values()].sort((a, b) =>
  a.name.localeCompare(b.name)
);

const SEED_BY_KEY = new Map(SEED_CITIES.map((city) => [cityIdentity(city.name), city]));

/** Punctuation-tolerant lookup of a seed city by "City, ST". */
export function findSeedCity(name: string): City | undefined {
  return SEED_BY_KEY.get(cityIdentity(name));
}

export { stateOf, cityOf };
