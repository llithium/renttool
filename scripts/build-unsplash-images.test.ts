import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main, parseArgs, type RefreshDependencies } from './build-unsplash-images';
import type { CityImage } from '../src/lib/types';

const rentData = { cities: { 'Austin, TX': {}, 'Boston, MA': {} } };
const photo = {
  id: 'photo-1',
  urls: { regular: 'https://images.unsplash.com/photo-1?ixid=abc' },
  links: { html: 'https://unsplash.com/photos/photo-1' },
  user: { name: 'Photographer', links: { html: 'https://unsplash.com/@photographer' } },
  alt_description: 'Tampa skyline'
};

function dependencies(fetch: RefreshDependencies['fetch'], writes: Array<Record<string, unknown>>) {
  return {
    fetch,
    readJson: async <T>(path: string) =>
      (path.endsWith('apartment-list-rents.json') ? rentData : {}) as T,
    writeManifest: async (manifest: Record<string, CityImage>) => {
      writes.push(structuredClone(manifest));
      return Object.keys(manifest).length;
    },
    sleep: async () => {}
  } satisfies Partial<RefreshDependencies>;
}

describe('Unsplash refresh arguments', () => {
  const originalArgv = process.argv;
  const originalKey = process.env.UNSPLASH_ACCESS_KEY;

  beforeEach(() => {
    process.env.UNSPLASH_ACCESS_KEY = 'test-key';
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalKey === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
    else process.env.UNSPLASH_ACCESS_KEY = originalKey;
  });

  it('rejects unknown and malformed city options before credentials are read', () => {
    expect(() => parseArgs(['--refersh'])).toThrow('Unknown option');
    expect(() => parseArgs(['--city='])).toThrow('non-empty');
    expect(() => parseArgs(['--city=Tampa'])).toThrow('City, ST');
  });

  it('preserves explicit city scope and quota wait choices', () => {
    expect(parseArgs(['--city=Tampa, FL', '--no-wait'])).toEqual({
      refresh: false,
      requestedCities: ['Tampa, FL'],
      waitForRateLimit: false
    });
    expect(() => parseArgs(['--wait', '--no-wait'])).toThrow('either --wait or --no-wait');
  });

  it('fails authorization, HTTP, network, and malformed JSON responses', async () => {
    for (const fetch of [
      async () => new Response(null, { status: 401 }),
      async () => new Response(null, { status: 500 }),
      async () => {
        throw new Error('offline network');
      },
      async () => new Response('{}', { status: 200 }),
      async () => new Response('{', { status: 200 })
    ]) {
      process.argv = ['bun', 'refresh', '--city=Austin, TX', '--no-wait'];
      await expect(main(dependencies(fetch, []))).rejects.toThrow();
    }
  });

  it('keeps a valid no-result as an unavailable city without a redundant checkpoint', async () => {
    process.argv = ['bun', 'refresh', '--city=Austin, TX', '--no-wait'];
    const writes: Array<Record<string, unknown>> = [];
    await main(dependencies(async () => new Response(JSON.stringify({ results: [] })), writes));
    expect(writes).toHaveLength(0);
  });

  it('retains accepted entries when a later authorization failure stops refresh', async () => {
    process.argv = ['bun', 'refresh', '--refresh'];
    const writes: Array<Record<string, unknown>> = [];
    let calls = 0;
    await expect(
      main(
        dependencies(async () => {
          calls += 1;
          return calls === 1
            ? new Response(JSON.stringify({ results: [photo] }))
            : new Response(null, { status: 401 });
        }, writes)
      )
    ).rejects.toThrow('authorization failed');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toHaveProperty('Austin, TX');
  });

  it('fails when checkpoint persistence fails', async () => {
    process.argv = ['bun', 'refresh', '--city=Austin, TX', '--no-wait'];
    await expect(
      main({
        ...dependencies(async () => new Response(JSON.stringify({ results: [photo] })), []),
        writeManifest: async () => {
          throw new Error('disk full');
        }
      })
    ).rejects.toThrow('disk full');
  });

  it('returns a nonzero outcome for no-wait quota stops after saving the checkpoint', async () => {
    process.env.UNSPLASH_ACCESS_KEY = 'test-key';
    process.argv = ['bun', 'refresh', '--refresh', '--no-wait'];
    const writes: Array<Record<string, unknown>> = [];
    let calls = 0;
    await expect(
      main(
        dependencies(async () => {
          calls += 1;
          return calls === 1
            ? new Response(JSON.stringify({ results: [photo] }))
            : new Response(null, { status: 429 });
        }, writes)
      )
    ).rejects.toThrow('rate limiting');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toHaveProperty('Austin, TX');
  });
});
