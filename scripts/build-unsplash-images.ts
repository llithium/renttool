/**
 * Curate the checked-in city-image manifest from Unsplash search results.
 *
 * This is a maintainer command, not part of the app's runtime path. It keeps
 * the returned CDN URL and attribution metadata in the repository so city
 * pages do not need an Unsplash key or search request.
 *
 * Usage:
 *   UNSPLASH_ACCESS_KEY=... bun run scripts/build-unsplash-images.ts
 *   UNSPLASH_ACCESS_KEY=... bun run scripts/build-unsplash-images.ts --city="Tampa, FL"
 *   UNSPLASH_ACCESS_KEY=... bun run scripts/build-unsplash-images.ts --city="Tampa, FL" --wait
 *   UNSPLASH_ACCESS_KEY=... bun run scripts/build-unsplash-images.ts --refresh
 *   UNSPLASH_ACCESS_KEY=... bun run scripts/build-unsplash-images.ts --no-wait
 */

import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CityImage } from '../src/lib/types';
import { selectPhoto, type UnsplashPhoto } from './unsplash-image-matcher';
import { isRateLimitResponse, rateLimitRemaining, rateLimitWaitMs } from './unsplash-rate-limit';

interface RentData {
  cities: Record<string, unknown>;
}

interface SearchResponse {
  results?: unknown;
}

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const RENT_DATA_PATH = join(ROOT_DIR, 'src/lib/data/apartment-list-rents.json');
const MANIFEST_PATH = join(ROOT_DIR, 'src/lib/data/city-images.json');
const UNSPLASH_API = 'https://api.unsplash.com/search/photos';
const IMAGE_HOST = 'images.unsplash.com';
const UNSPLASH_HOST = 'unsplash.com';
const REFERRAL_PARAMS = {
  utm_source: 'rent_tool',
  utm_medium: 'referral'
};

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeHttpsUrl(value: unknown, hostname: string): string | null {
  const candidate = stringValue(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && url.hostname === hostname ? url.href : null;
  } catch {
    return null;
  }
}

function referralUrl(value: unknown): string | null {
  const candidate = safeHttpsUrl(value, UNSPLASH_HOST);
  if (!candidate) return null;
  const url = new URL(candidate);
  for (const [key, parameter] of Object.entries(REFERRAL_PARAMS)) {
    url.searchParams.set(key, parameter);
  }
  return url.href;
}

function imageUrl(value: unknown): string | null {
  const candidate = safeHttpsUrl(value, IMAGE_HOST);
  if (!candidate) return null;
  const url = new URL(candidate);
  // Unsplash asks API clients to preserve ixid when transforming returned URLs.
  if (!url.searchParams.has('ixid')) return null;
  url.searchParams.set('auto', 'format');
  url.searchParams.set('fit', 'crop');
  url.searchParams.set('w', '1600');
  url.searchParams.set('h', '680');
  return url.href;
}

function normalizePhoto(photo: UnsplashPhoto, city: string, state: string): CityImage | null {
  const id = stringValue(photo.id);
  const url = imageUrl(photo.urls?.regular);
  const photoUrl = referralUrl(photo.links?.html);
  const photographerUrl = referralUrl(photo.user?.links?.html);
  if (!id || !url || !photoUrl || !photographerUrl) return null;

  return {
    id,
    url,
    alt:
      stringValue(photo.alt_description) ||
      stringValue(photo.description) ||
      `${city}, ${state} cityscape`,
    photoUrl,
    photographerName:
      stringValue(photo.user?.name) || stringValue(photo.user?.username) || 'Unsplash contributor',
    photographerUrl,
    source: 'unsplash',
    sourceUrl: `https://unsplash.com/?${new URLSearchParams(REFERRAL_PARAMS).toString()}`
  };
}

interface CliOptions {
  refresh: boolean;
  requestedCities: string[];
  waitForRateLimit: boolean;
}

export function parseArgs(argv = process.argv.slice(2)): CliOptions {
  const args = argv;
  const allowed = new Set(['--refresh', '--wait', '--no-wait']);
  for (const arg of args) {
    if (arg.startsWith('--city=')) {
      const city = arg.slice('--city='.length).trim();
      if (!/^.+,\s*[A-Z]{2}$/.test(city)) {
        throw new Error('--city must be a non-empty "City, ST" value.');
      }
      continue;
    }
    if (!allowed.has(arg)) throw new Error(`Unknown option: ${arg}`);
  }
  if (args.includes('--wait') && args.includes('--no-wait')) {
    throw new Error('Use either --wait or --no-wait, not both.');
  }

  const requestedCities = args
    .filter((arg) => arg.startsWith('--city='))
    .map((arg) => arg.slice('--city='.length).trim());

  return {
    refresh: args.includes('--refresh'),
    requestedCities,
    waitForRateLimit:
      args.includes('--wait') || (!args.includes('--no-wait') && requestedCities.length === 0)
  };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function writeManifestFile(manifest: Record<string, CityImage>): Promise<number> {
  const sortedManifest = Object.fromEntries(
    Object.entries(manifest).sort(([left], [right]) => left.localeCompare(right))
  );
  const temporaryPath = `${MANIFEST_PATH}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(sortedManifest, null, 2)}\n`);
    await rename(temporaryPath, MANIFEST_PATH);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
  return Object.keys(sortedManifest).length;
}

export interface RefreshDependencies {
  fetch: typeof fetch;
  readJson: <T>(path: string) => Promise<T>;
  writeManifest: (manifest: Record<string, CityImage>) => Promise<number>;
  sleep: (milliseconds: number) => Promise<void>;
}

function hasPendingCity(
  targetCities: string[],
  startIndex: number,
  manifest: Record<string, CityImage>,
  refresh: boolean
): boolean {
  return targetCities.slice(startIndex).some((name) => refresh || !manifest[name]);
}

async function waitForQuota(
  headers: Headers,
  entryCount: number,
  sleep: (milliseconds: number) => Promise<void>
): Promise<void> {
  const waitMs = rateLimitWaitMs(headers);
  const resumeAt = new Date(Date.now() + waitMs);
  const waitMinutes = Math.ceil(waitMs / 60_000);
  console.warn(
    `Saved ${entryCount} image entries. Unsplash quota exhausted; waiting about ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'} and resuming at ${resumeAt.toLocaleString()}.`
  );
  await sleep(waitMs);
}

export async function main(dependencies: Partial<RefreshDependencies> = {}): Promise<void> {
  const deps: RefreshDependencies = {
    fetch,
    readJson,
    writeManifest: writeManifestFile,
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    ...dependencies
  };
  const { refresh, requestedCities, waitForRateLimit } = parseArgs();
  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!accessKey) {
    throw new Error('UNSPLASH_ACCESS_KEY is required for manifest refreshes.');
  }

  const rentData = await deps.readJson<RentData>(RENT_DATA_PATH);
  const manifest = await deps.readJson<Record<string, CityImage>>(MANIFEST_PATH);
  const allCities = Object.keys(rentData.cities).sort((a, b) => a.localeCompare(b));
  const unknownCities = requestedCities.filter((name) => !allCities.includes(name));
  if (unknownCities.length) {
    throw new Error(`Unknown bundled city: ${unknownCities.join(', ')}`);
  }
  const targetCities = requestedCities.length ? requestedCities : allCities;
  let added = 0;
  let skipped = 0;
  let missing = 0;

  for (let index = 0; index < targetCities.length; index += 1) {
    const name = targetCities[index];
    if (!refresh && manifest[name]) {
      skipped += 1;
      continue;
    }

    const [city, state] = name.split(/,\s*/);
    const endpoint = new URL(UNSPLASH_API);
    endpoint.searchParams.set('query', `${city}, ${state} cityscape`);
    endpoint.searchParams.set('per_page', '10');
    endpoint.searchParams.set('orientation', 'landscape');
    endpoint.searchParams.set('content_filter', 'high');

    while (true) {
      const response = await deps.fetch(endpoint, {
        headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' }
      });
      if (isRateLimitResponse(response.status, response.headers)) {
        if (!waitForRateLimit) {
          throw new Error(
            `${name}: refresh stopped by Unsplash rate limiting; accepted entries remain saved (--no-wait).`
          );
        }
        const entryCount = Object.keys(manifest).length;
        await waitForQuota(response.headers, entryCount, deps.sleep);
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `${name}: Unsplash authorization failed (${response.status}); check the access key and application permissions.`
        );
      }
      if (!response.ok) {
        throw new Error(`${name}: Unsplash request failed (${response.status}).`);
      }
      const data: unknown = await response.json();
      if (
        typeof data !== 'object' ||
        data === null ||
        !Array.isArray((data as SearchResponse).results)
      ) {
        throw new Error(`${name}: Unsplash returned malformed JSON.`);
      }
      const results = (data as SearchResponse).results as unknown[];
      const image = selectPhoto(results, city, state);
      const normalized = image ? normalizePhoto(image, city, state) : null;
      if (!normalized) {
        console.warn(`${name}: no usable landscape result`);
        missing += 1;
      } else {
        manifest[name] = normalized;
        added += 1;
        const entryCount = await deps.writeManifest(manifest);
        console.log(`${name}: ${normalized.id} (${entryCount} entries saved)`);
      }

      const remaining = rateLimitRemaining(response.headers);
      if (remaining !== null && remaining <= 5) {
        console.log(`Unsplash quota: ${remaining} request${remaining === 1 ? '' : 's'} remaining.`);
      }
      if (
        remaining === 0 &&
        waitForRateLimit &&
        hasPendingCity(targetCities, index + 1, manifest, refresh)
      ) {
        const entryCount = Object.keys(manifest).length;
        await waitForQuota(response.headers, entryCount, deps.sleep);
      }
      break;
    }

    await deps.sleep(100);
  }

  const entryCount = Object.keys(manifest).length;
  console.log(
    `Manifest contains ${entryCount} saved image entries (${added} added, ${skipped} kept, ${missing} unavailable).`
  );
}

if (import.meta.main) await main();
