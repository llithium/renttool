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

import { readFile, rename, writeFile } from 'node:fs/promises';
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

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  if (args.includes('--wait') && args.includes('--no-wait')) {
    throw new Error('Use either --wait or --no-wait, not both.');
  }

  const requestedCities = args
    .filter((arg) => arg.startsWith('--city='))
    .map((arg) => arg.slice('--city='.length).trim())
    .filter(Boolean);

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

async function writeManifest(manifest: Record<string, CityImage>): Promise<number> {
  const sortedManifest = Object.fromEntries(
    Object.entries(manifest).sort(([left], [right]) => left.localeCompare(right))
  );
  const temporaryPath = `${MANIFEST_PATH}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(sortedManifest, null, 2)}\n`);
  await rename(temporaryPath, MANIFEST_PATH);
  return Object.keys(sortedManifest).length;
}

function hasPendingCity(
  targetCities: string[],
  startIndex: number,
  manifest: Record<string, CityImage>,
  refresh: boolean
): boolean {
  return targetCities.slice(startIndex).some((name) => refresh || !manifest[name]);
}

async function waitForQuota(headers: Headers, entryCount: number): Promise<void> {
  const waitMs = rateLimitWaitMs(headers);
  const resumeAt = new Date(Date.now() + waitMs);
  const waitMinutes = Math.ceil(waitMs / 60_000);
  console.warn(
    `Saved ${entryCount} image entries. Unsplash quota exhausted; waiting about ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'} and resuming at ${resumeAt.toLocaleString()}.`
  );
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

async function main(): Promise<void> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!accessKey) {
    throw new Error('UNSPLASH_ACCESS_KEY is required for manifest refreshes.');
  }

  const { refresh, requestedCities, waitForRateLimit } = parseArgs();
  const rentData = await readJson<RentData>(RENT_DATA_PATH);
  const manifest = await readJson<Record<string, CityImage>>(MANIFEST_PATH);
  const allCities = Object.keys(rentData.cities).sort((a, b) => a.localeCompare(b));
  const unknownCities = requestedCities.filter((name) => !allCities.includes(name));
  if (unknownCities.length) {
    throw new Error(`Unknown bundled city: ${unknownCities.join(', ')}`);
  }
  const targetCities = requestedCities.length ? requestedCities : allCities;
  let added = 0;
  let skipped = 0;
  let missing = 0;
  let rateLimited = false;
  let authorizationFailed = false;

  cityLoop: for (let index = 0; index < targetCities.length; index += 1) {
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
      try {
        const response = await fetch(endpoint, {
          headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' }
        });
        if (isRateLimitResponse(response.status, response.headers)) {
          if (!waitForRateLimit) {
            console.warn(
              `${name}: Unsplash quota exhausted (${response.status}); stopping because rate-limit waiting is disabled.`
            );
            rateLimited = true;
            break cityLoop;
          }

          const entryCount = await writeManifest(manifest);
          await waitForQuota(response.headers, entryCount);
          continue;
        }
        if (response.status === 401 || response.status === 403) {
          console.warn(
            `${name}: Unsplash returned ${response.status} without an exhausted quota; stopping. Check the access key and application permissions.`
          );
          authorizationFailed = true;
          break cityLoop;
        }
        if (!response.ok) {
          console.warn(`${name}: Unsplash returned ${response.status}`);
          missing += 1;
          break;
        }
        const data = (await response.json()) as SearchResponse;
        const results = Array.isArray(data.results) ? data.results : [];
        const image = selectPhoto(results, city, state);
        const normalized = image ? normalizePhoto(image, city, state) : null;
        if (!normalized) {
          console.warn(`${name}: no usable landscape result`);
          missing += 1;
        } else {
          manifest[name] = normalized;
          added += 1;
          const entryCount = await writeManifest(manifest);
          console.log(`${name}: ${normalized.id} (${entryCount} entries saved)`);
        }

        const remaining = rateLimitRemaining(response.headers);
        if (remaining !== null && remaining <= 5) {
          console.log(
            `Unsplash quota: ${remaining} request${remaining === 1 ? '' : 's'} remaining.`
          );
        }
        if (
          remaining === 0 &&
          waitForRateLimit &&
          hasPendingCity(targetCities, index + 1, manifest, refresh)
        ) {
          const entryCount = await writeManifest(manifest);
          await waitForQuota(response.headers, entryCount);
        }
        break;
      } catch (error) {
        console.warn(`${name}: ${error instanceof Error ? error.message : 'request failed'}`);
        missing += 1;
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const entryCount = await writeManifest(manifest);
  console.log(
    `Wrote ${entryCount} image entries (${added} added, ${skipped} kept, ${missing} unavailable${rateLimited ? '; refresh stopped by Unsplash rate limiting' : ''}${authorizationFailed ? '; refresh stopped by an authorization error' : ''}).`
  );
}

await main();
