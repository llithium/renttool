import { describe, expect, it } from 'vitest';
import { buildSearchLinks } from './searchLinks';

const tampa = { city: 'Tampa', state: 'FL' };

describe('buildSearchLinks', () => {
  it('does not claim an unsupported sub-$500 Apartments.com filter', () => {
    const [apartments] = buildSearchLinks(tampa, 400);
    expect(apartments.prefiltered).toBe(false);
    expect(apartments.providerName).toBe('Apartments.com');
    expect(apartments.capDescription).toBeUndefined();
    expect(apartments.url).not.toContain('under-500');
  });

  it('rounds a supported Apartments.com ceiling down', () => {
    const [apartments] = buildSearchLinks(tampa, 2_583);
    expect(apartments.prefiltered).toBe(true);
    expect(apartments.capDescription).toBe('under $2,500');
    expect(apartments.url).toContain('under-2500');
  });
});
