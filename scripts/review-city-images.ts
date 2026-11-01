/** Write a local, searchable contact sheet. This never changes the manifest. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { escape } from 'entities';
import type { CityImage } from '../src/lib/types';
import {
  MANIFEST_PATH,
  RENT_DATA_PATH,
  ROOT_DIR,
  duplicateCities,
  readJson
} from './city-image-manifest';

export function reviewHtml(manifest: Record<string, CityImage>, cities: string[]): string {
  const duplicates = duplicateCities(manifest);
  const covered = cities.filter((name) => manifest[name]).length;
  const cards = cities
    .map((name) => {
      const image = manifest[name];
      const warning = !image
        ? 'Missing photo'
        : duplicates.has(name)
          ? 'Shared photo — check city'
          : '';
      return `<article data-name="${escape(name.toLowerCase())}" data-flagged="${Boolean(warning)}">
      <h2>${escape(name)}</h2>
      ${
        image
          ? `<a href="${escape(image.photoUrl)}"><img src="${escape(image.url)}" alt="${escape(image.alt)}" loading="lazy" style="object-position:50% ${image.focusY ?? 50}%"></a>
        <p>${escape(image.photographerName)} · ${escape(image.source)}</p>
        ${image.source === 'wikimedia' ? `<p><a href="${escape(image.licenseUrl)}">${escape(image.licenseName)}</a> · <a href="${escape(image.articleUrl)}">City article</a></p>` : ''}`
          : '<div class="empty"></div>'
      }
      <p class="warning">${warning}</p>
    </article>`;
    })
    .join('\n');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>City image review</title>
    <style>
      *{box-sizing:border-box}body{font:16px system-ui;background:#f5f3ee;color:#222;margin:0;padding:24px}
      header{position:sticky;top:0;background:#f5f3ee;padding:8px 0 20px;z-index:1}h1{margin:0 0 8px}input[type=search]{padding:10px;width:min(100%,350px);margin-right:16px}
      main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}article{background:white;padding:16px;border:1px solid #ddd;border-radius:8px;min-width:0}
      article[hidden]{display:none}h2{font-size:18px;margin:0 0 12px}img,.empty{width:100%;aspect-ratio:4/1;object-fit:cover;background:#ddd;display:block}p{font-size:13px;overflow-wrap:anywhere}a{color:#345c51}.warning{color:#963b16;font-weight:600}
    </style>
    <header><h1>City image review</h1><p>${covered}/${cities.length} cities have photos. ${duplicates.size} entries share a photo. Click a photo to inspect its source.</p>
      <input id="search" type="search" aria-label="Find city" placeholder="Find city or state">
      <label><input id="flagged" type="checkbox"> Missing or shared photos only</label>
    </header><main>${cards}</main>
    <script>
      const search = document.querySelector('#search');
      const flagged = document.querySelector('#flagged');
      function filter(){for(const card of document.querySelectorAll('article')) card.hidden = !card.dataset.name.includes(search.value.toLowerCase()) || (flagged.checked && card.dataset.flagged !== 'true');}
      search.addEventListener('input', filter); flagged.addEventListener('change', filter);
    </script></html>`;
}

async function main() {
  const manifest = await readJson<Record<string, CityImage>>(MANIFEST_PATH);
  const rents = await readJson<{ cities: Record<string, unknown> }>(RENT_DATA_PATH);
  const cities = Object.keys(rents.cities).sort((a, b) => a.localeCompare(b));
  const output = join(ROOT_DIR, '.city-images/review.html');
  await mkdir(join(ROOT_DIR, '.city-images'), { recursive: true });
  await writeFile(output, reviewHtml(manifest, cities));
  console.log(`Review: ${output}`);
}

if (import.meta.main) await main();
