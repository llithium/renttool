import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CityImage } from '../src/lib/types';

export const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST_PATH = join(ROOT_DIR, 'src/lib/data/city-images.json');
export const RENT_DATA_PATH = join(ROOT_DIR, 'src/lib/data/apartment-list-rents.json');

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

/** Checkpoint accepted entries atomically so an interrupted import can resume. */
export async function writeManifest(manifest: Record<string, CityImage>): Promise<number> {
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([left], [right]) => left.localeCompare(right))
  );
  const temporaryPath = `${MANIFEST_PATH}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(sorted, null, 2)}\n`);
    await rename(temporaryPath, MANIFEST_PATH);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
  return Object.keys(sorted).length;
}

export function duplicateCities(manifest: Record<string, CityImage>): Set<string> {
  const byPhoto = new Map<string, string[]>();
  for (const [city, image] of Object.entries(manifest)) {
    const key = `${image.source}:${image.id}`;
    byPhoto.set(key, [...(byPhoto.get(key) ?? []), city]);
  }
  return new Set([...byPhoto.values()].filter((cities) => cities.length > 1).flat());
}
