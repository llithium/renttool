import { describe, expect, it } from 'vitest';
import {
  articleTitle,
  main,
  matchesArticle,
  normalizeCommonsPhoto,
  parseArgs,
  photoTitles,
  type ImportDependencies
} from './build-wikimedia-images';
import type { CityImage } from '../src/lib/types';

const article = {
  title: 'Austin, Texas',
  coordinates: [{ lat: 30.2672, lon: -97.7431, globe: 'earth' }],
  pageimage: 'Austin skyline.jpg'
};

const file = {
  title: 'File:Austin skyline.jpg',
  imagerepository: 'local',
  imageinfo: [
    {
      width: 2400,
      height: 1200,
      mime: 'image/jpeg',
      thumburl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Austin.jpg/1600px-Austin.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:Austin_skyline.jpg',
      extmetadata: {
        Artist: { value: '<a href="//example.org">Jane &amp; Jos&#233;</a>' },
        ObjectName: { value: 'Downtown Austin' },
        LicenseShortName: { value: 'CC BY-SA 4.0' },
        LicenseUrl: { value: 'http://creativecommons.org/licenses/by-sa/4.0/' }
      }
    }
  ]
};

function response(pages: unknown[]) {
  return new Response(JSON.stringify({ query: { pages } }));
}

function dependencies(fetch: typeof globalThis.fetch, manifest: Record<string, CityImage> = {}) {
  const writes: Array<Record<string, CityImage>> = [];
  return {
    writes,
    deps: {
      fetch,
      readJson: async <T>(path: string) =>
        (path.endsWith('apartment-list-rents.json')
          ? { cities: { 'Austin, TX': {}, 'Boston, MA': {} } }
          : structuredClone(manifest)) as T,
      writeManifest: async (data) => {
        writes.push(structuredClone(data));
        return Object.keys(data).length;
      },
      sleep: async () => {}
    } satisfies ImportDependencies
  };
}

describe('Wikimedia city images', () => {
  it('requires the exact city/state article and nearby coordinates', () => {
    expect(matchesArticle(article, 'Austin, TX')).toBe(true);
    expect(matchesArticle({ ...article, title: 'Austin' }, 'Austin, TX')).toBe(true);
    expect(matchesArticle({ ...article, title: 'Austin, Minnesota' }, 'Austin, TX')).toBe(false);
    expect(matchesArticle({ ...article, coordinates: [] }, 'Austin, TX')).toBe(false);
    expect(
      matchesArticle(
        { ...article, coordinates: [{ lat: 44, lon: -93, globe: 'earth' }] },
        'Austin, TX'
      )
    ).toBe(false);
    expect(matchesArticle({ ...article, pageprops: { disambiguation: '' } }, 'Austin, TX')).toBe(
      false
    );
    expect(articleTitle('Urban Honolulu, HI')).toBe('Honolulu, Hawaii');
    expect(articleTitle('Washington, DC')).toBe('Washington, D.C.');
  });

  it('prioritizes the lead photograph and excludes maps, flags and collages', () => {
    expect(
      photoTitles({
        ...article,
        images: [
          { title: 'File:Austin skyline.jpg' },
          { title: 'File:Flag of Austin.png' },
          { title: 'File:Austin collage.jpg' },
          { title: 'File:Austin map.png' },
          { title: 'File:Downtown Austin Interstate highway.jpg' },
          { title: 'File:Seal of Austin.svg' },
          { title: 'File:Austin downtown.jpg' }
        ]
      })
    ).toEqual(['File:Austin skyline.jpg', 'File:Austin downtown.jpg']);
  });

  it('keeps escaped credit text and a recognized, HTTPS license', () => {
    const image = normalizeCommonsPhoto(file, 'Austin, TX');
    expect(image).toMatchObject({
      source: 'wikimedia',
      photographerName: 'Jane & José',
      title: 'Downtown Austin',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
    });
    expect(
      normalizeCommonsPhoto(
        {
          ...file,
          imageinfo: [
            {
              ...file.imageinfo[0],
              extmetadata: {
                ...file.imageinfo[0].extmetadata,
                LicenseUrl: { value: 'https://evil.example/licenses/by/4.0/' }
              }
            }
          ]
        },
        'Austin, TX'
      )
    ).toBeNull();
  });

  it('rejects non-landscape, undersized, uncredited or disputed photos', () => {
    for (const changes of [
      { width: 900 },
      { height: 2300 },
      { mime: 'image/svg+xml' },
      { extmetadata: { ...file.imageinfo[0].extmetadata, DateTimeOriginal: { value: '1891' } } },
      { extmetadata: {} },
      {
        extmetadata: {
          ...file.imageinfo[0].extmetadata,
          Categories: { value: 'American football games in Oregon' }
        }
      },
      {
        extmetadata: {
          ...file.imageinfo[0].extmetadata,
          Categories: { value: 'Deletion requests November 2026' }
        }
      }
    ]) {
      expect(
        normalizeCommonsPhoto(
          { ...file, imageinfo: [{ ...file.imageinfo[0], ...changes }] },
          'Austin, TX'
        )
      ).toBeNull();
    }
  });

  it('preserves CC0 and public-domain terms when the source omits the license URL', () => {
    for (const [license, path] of [
      ['CC0', 'zero'],
      ['Public domain', 'mark']
    ]) {
      const image = normalizeCommonsPhoto(
        {
          ...file,
          imageinfo: [
            {
              ...file.imageinfo[0],
              extmetadata: {
                Artist: { value: 'City photographer' },
                LicenseShortName: { value: license },
                Copyrighted: { value: 'False' }
              }
            }
          ]
        },
        'Austin, TX'
      );
      expect(image).toMatchObject({
        licenseName: license,
        licenseUrl: `https://creativecommons.org/publicdomain/${path}/1.0/`
      });
    }
  });

  it('checkpoints accepted photos and preserves them when a later request fails', async () => {
    let calls = 0;
    const { deps, writes } = dependencies(async () => {
      calls += 1;
      if (calls === 1) return response([article]);
      if (calls === 2) return response([file]);
      return new Response(null, { status: 500 });
    });
    await expect(main(deps, [])).rejects.toThrow('request failed (500)');
    expect(writes).toHaveLength(1);
    expect(writes[0]['Austin, TX'].source).toBe('wikimedia');
  });

  it('keeps existing photos by default and rejects duplicate photos for other cities', async () => {
    const existing = normalizeCommonsPhoto(file, 'Austin, TX');
    if (!existing) throw new Error('Invalid fixture');
    const calls: string[] = [];
    const { deps, writes } = dependencies(
      async (input) => {
        const url = new URL(String(input));
        calls.push(url.searchParams.get('titles') ?? '');
        return url.hostname === 'en.wikipedia.org'
          ? response([
              {
                ...article,
                title: 'Boston, Massachusetts',
                coordinates: [{ lat: 42.3601, lon: -71.0589, globe: 'earth' }]
              }
            ])
          : response([file]);
      },
      { 'Austin, TX': existing }
    );
    await main(deps, []);
    expect(calls[0]).toBe('Boston, Massachusetts');
    expect(writes).toHaveLength(0);
  });

  it('retries rate limiting and fails malformed responses without changing the manifest', async () => {
    let calls = 0;
    const { deps, writes } = dependencies(async () => {
      calls += 1;
      return calls === 1 ? new Response(null, { status: 429 }) : new Response('{}');
    });
    await expect(main(deps, ['--city=Austin, TX'])).rejects.toThrow('Invalid Wikimedia response');
    expect(calls).toBe(2);
    expect(writes).toHaveLength(0);
    expect(() => parseArgs(['--city='])).toThrow('malformed');
    await expect(main(deps, ['--city=Imaginary, TX'])).rejects.toThrow('Unknown bundled city');
  });
});
