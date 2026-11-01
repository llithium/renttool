/** Fill missing city photos from the exact Wikipedia city article and Commons.
 * Existing photos are kept unless --city="City, ST" or --repair-duplicates is used.
 * No credentials or runtime image-search requests are needed.
 */
import { decodeHTML } from 'entities';
import { cityIdentity } from '../src/lib/cityIdentity';
import { COORDS } from '../src/lib/data/coordinates';
import { coordinatesForPlace } from '../src/lib/data/places';
import { STATE_NAME } from '../src/lib/data/states';
import { haversineMiles, isValidCoordinates } from '../src/lib/geo';
import type { CityImage } from '../src/lib/types';
import {
  MANIFEST_PATH,
  RENT_DATA_PATH,
  duplicateCities,
  readJson,
  writeManifest
} from './city-image-manifest';

interface WikiPage {
  title: string;
  missing?: boolean;
  pageimage?: string;
  pageprops?: { disambiguation?: string };
  coordinates?: Array<{ lat: number; lon: number; globe: string }>;
  images?: Array<{ title: string }>;
  imagerepository?: string;
  imageinfo?: ImageInfo[];
}

interface ImageInfo {
  width: number;
  height: number;
  mime: string;
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: unknown }>;
}

interface WikiResponse {
  query?: { pages?: WikiPage[] };
  error?: { code?: string; info?: string };
}

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'RentToolCityImages/1.0 (https://github.com/llithium/renttool)';
const NON_PHOTO = /\b(montage|collage|flag|seal|coat of arms|logo|locator|map|maps)\b/i;
const CITY_VIEW =
  /skyline|cityscape|panoram|aerial|downtown|town.?square|main.?street|main st\b|city.?hall|civic.?center|court.?house|waterfront|historic.?district|town.?hall/i;
const UNSUITABLE =
  /interstate|state route|u\.?s\.? route|highway|welcome.?sign|high.?school|middle.?school|centennial.?hs|chevrolet|soldiers|marines|marine division|concert|football|runway|fowler|lithograph|engraving|painting|illustration/i;

function text(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Metadata is HTML. Decode after stripping tags and render it only as escaped text.
  return decodeHTML(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function safeUrl(value: unknown, hosts: string[]): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' &&
      hosts.includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function articleTitle(name: string): string {
  const [city, state] = name.split(/,\s*/);
  if (!city || !STATE_NAME[state]) throw new Error(`Invalid city: ${name}`);
  if (name === 'Washington, DC') return 'Washington, D.C.';
  return `${city.replace(/^Urban Honolulu$/, 'Honolulu').replace(/ Town$/, '')}, ${STATE_NAME[state]}`;
}

/** Require the correct city/state article and nearby primary coordinates. */
export function matchesArticle(page: WikiPage, name: string): boolean {
  if (page.missing || page.pageprops?.disambiguation !== undefined) return false;
  const [city, state] = name.split(/,\s*/);
  const requestedTitle = articleTitle(name);
  const normalized = (value: string) =>
    cityIdentity(value)
      .replace(/\b(town|township)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const requestedCity = requestedTitle.split(',')[0];
  // Major-city articles may redirect from "City, State" to just "City".
  // The explicit state-qualified request and coordinates still disambiguate them.
  if (![normalized(requestedTitle), normalized(requestedCity)].includes(normalized(page.title)))
    return false;
  const expected = COORDS[name] ?? coordinatesForPlace(city, state);
  const actual = page.coordinates?.[0];
  return Boolean(
    expected &&
    actual &&
    actual.globe === 'earth' &&
    isValidCoordinates(actual.lat, actual.lon) &&
    haversineMiles(...expected, actual.lat, actual.lon) <= 20
  );
}

export function photoTitles(page: WikiPage): string[] {
  const lead = page.pageimage ? `File:${page.pageimage}` : '';
  // Article image lists are alphabetical, so choose recognizable city views
  // rather than the first incidental school, road, or event photograph.
  const titles = [
    lead,
    ...(page.images ?? [])
      .map((image) => image.title)
      .filter((title) => CITY_VIEW.test(title.replace(/_/g, ' ')))
  ];
  return [...new Set(titles)]
    .filter(
      (title) =>
        /\.(jpe?g|png|webp)$/i.test(title) &&
        !NON_PHOTO.test(title.replace(/_/g, ' ')) &&
        !UNSUITABLE.test(title.replace(/_/g, ' '))
    )
    .slice(0, 8);
}

export function normalizeCommonsPhoto(page: WikiPage, name: string): CityImage | null {
  const info = page.imageinfo?.[0];
  if (
    page.imagerepository !== 'local' ||
    !info ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime) ||
    !Number.isFinite(info.width) ||
    !Number.isFinite(info.height) ||
    info.width < 1000 ||
    info.height < 400 ||
    info.width / info.height < 1.3 ||
    NON_PHOTO.test(page.title.replace(/_/g, ' ')) ||
    UNSUITABLE.test(page.title.replace(/_/g, ' '))
  )
    return null;

  const metadata = info.extmetadata ?? {};
  const value = (key: string) => text(metadata[key]?.value);
  const year = value('DateTimeOriginal').match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  if (year && Number(year[1]) < 1970) return null;
  if (
    /american football|football games|military exercises|military bands/i.test(value('Categories'))
  )
    return null;
  if (
    /deletion request|copyright violation|disputed/i.test(value('Categories')) ||
    value('Restrictions')
  )
    return null;
  const photographerName = value('Attribution') || value('Artist');
  const licenseName = value('LicenseShortName');
  const rawLicense = safeUrl(metadata.LicenseUrl?.value, ['creativecommons.org']);
  const licenseUrl =
    rawLicense &&
    /^\/(licenses\/(by|by-sa)\/[\d.]+|publicdomain\/(zero|mark)\/1\.0)\/?$/.test(
      new URL(rawLicense).pathname
    )
      ? rawLicense
      : null;
  // Public-domain files sometimes omit LicenseUrl; use the explicit PD marker only.
  const publicDomain =
    value('Copyrighted').toLowerCase() === 'false' && /public domain|cc0/i.test(licenseName);
  const finalLicenseUrl =
    licenseUrl ??
    (publicDomain
      ? `https://creativecommons.org/publicdomain/${/cc0/i.test(licenseName) ? 'zero' : 'mark'}/1.0/`
      : null);
  const url = safeUrl(info.thumburl, ['upload.wikimedia.org', 'thumb.wikimedia.org']);
  const photoUrl = safeUrl(info.descriptionurl, ['commons.wikimedia.org']);
  const title = value('ObjectName') || page.title.replace(/^File:/, '').replace(/_/g, ' ');
  if (
    !photographerName ||
    photographerName.length > 200 ||
    !licenseName ||
    !finalLicenseUrl ||
    !url ||
    !photoUrl ||
    !title ||
    title.length > 200
  )
    return null;

  return {
    id: page.title,
    url,
    alt: `${name}: ${title}`,
    title,
    photoUrl,
    photographerName,
    photographerUrl: photoUrl,
    source: 'wikimedia',
    sourceUrl: photoUrl,
    licenseName,
    licenseUrl: finalLicenseUrl,
    articleUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(articleTitle(name).replace(/ /g, '_'))}`,
    width: info.width,
    height: info.height
  };
}

export interface ImportDependencies {
  fetch: typeof fetch;
  readJson: typeof readJson;
  writeManifest: typeof writeManifest;
  sleep: (milliseconds: number) => Promise<void>;
}

async function query(
  endpoint: string,
  params: Record<string, string>,
  deps: ImportDependencies
): Promise<WikiPage[]> {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    maxlag: '5',
    ...params
  }).toString();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await deps.fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20_000)
    });
    if ((response.status === 429 || response.status === 503) && attempt < 2) {
      const seconds = Number(response.headers.get('retry-after')) || 5;
      await deps.sleep(Math.min(30, Math.max(1, seconds)) * 1000);
      continue;
    }
    if (!response.ok)
      throw new Error(
        `Wikimedia request failed (${response.status}). Accepted entries remain saved.`
      );
    const data = (await response.json()) as WikiResponse;
    if (data?.error?.code === 'maxlag' && attempt < 2) {
      await deps.sleep(5_000);
      continue;
    }
    if (
      data?.error ||
      !Array.isArray(data?.query?.pages) ||
      data.query.pages.some((page) => typeof page?.title !== 'string')
    ) {
      throw new Error(`Invalid Wikimedia response: ${data?.error?.info ?? 'missing pages'}`);
    }
    await deps.sleep(250);
    return data.query.pages;
  }
  throw new Error('Wikimedia retry limit reached.');
}

export function parseArgs(args: string[]) {
  const requestedCities: string[] = [];
  for (const arg of args) {
    if (arg.startsWith('--city=') && /^.+,\s*[A-Z]{2}$/.test(arg.slice(7)))
      requestedCities.push(arg.slice(7));
    else if (arg !== '--repair-duplicates') throw new Error(`Unknown or malformed option: ${arg}`);
  }
  return { requestedCities, repairDuplicates: args.includes('--repair-duplicates') };
}

export async function main(
  overrides: Partial<ImportDependencies> = {},
  args = process.argv.slice(2)
): Promise<void> {
  const { requestedCities, repairDuplicates } = parseArgs(args);
  const deps: ImportDependencies = {
    fetch,
    readJson,
    writeManifest,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    ...overrides
  };
  const rentData = await deps.readJson<{ cities: Record<string, unknown> }>(RENT_DATA_PATH);
  const manifest = await deps.readJson<Record<string, CityImage>>(MANIFEST_PATH);
  const unknown = requestedCities.filter((city) => !(city in rentData.cities));
  if (unknown.length) throw new Error(`Unknown bundled city: ${unknown.join(', ')}`);
  const duplicates = duplicateCities(manifest);
  const targets = requestedCities.length
    ? requestedCities
    : Object.keys(rentData.cities)
        .filter((city) => !manifest[city] || (repairDuplicates && duplicates.has(city)))
        .sort((a, b) => a.localeCompare(b));
  let added = 0;
  for (const name of targets) {
    const pages = await query(
      WIKIPEDIA_API,
      {
        titles: articleTitle(name),
        redirects: '1',
        prop: 'pageimages|coordinates|pageprops|images',
        piprop: 'name',
        pilicense: 'free',
        imlimit: '50'
      },
      deps
    );
    const page = pages.find((page) => matchesArticle(page, name));
    const titles = page ? photoTitles(page) : [];
    if (!titles.length) {
      console.warn(`${name}: no matching city article or landscape candidate`);
      continue;
    }
    const files = await query(
      COMMONS_API,
      {
        titles: titles.join('|'),
        prop: 'imageinfo',
        iiprop: 'url|size|mime|extmetadata',
        iiurlwidth: '1600',
        iiextmetadatalanguage: 'en'
      },
      deps
    );
    // The API sorts pages by ID; retain article order with the lead photo first.
    const image = titles.flatMap((title) => {
      const file = files.find((file) => file.title.replace(/_/g, ' ') === title.replace(/_/g, ' '));
      const image = file ? normalizeCommonsPhoto(file, name) : null;
      return image &&
        !Object.entries(manifest).some(
          ([otherCity, other]) =>
            otherCity !== name && other.source === image.source && other.id === image.id
        )
        ? [image]
        : [];
    })[0];
    if (!image) {
      console.warn(`${name}: no unique landscape photo with complete license metadata`);
      continue;
    }
    const previous = manifest[name];
    if (previous?.source === image.source && previous.id === image.id && previous.focusY != null) {
      image.focusY = previous.focusY;
    }
    manifest[name] = image;
    await deps.writeManifest(manifest);
    added += 1;
    console.log(`${name}: ${image.title} (${image.licenseName})`);
  }
  const covered = Object.keys(rentData.cities).filter((city) => manifest[city]).length;
  console.log(
    `Saved ${added} photos. Coverage: ${covered}/${Object.keys(rentData.cities).length} bundled cities. ${duplicateCities(manifest).size} entries share a photo; run images:review to inspect.`
  );
}

if (import.meta.main) await main();
