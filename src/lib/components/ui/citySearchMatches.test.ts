import { describe, expect, it } from 'vitest';
import { localCitySuggestions, mergeCitySuggestions } from './citySearchMatches';
import type { CitySuggestion } from '$lib/types';

describe('city suggestion relevance', () => {
  it('recognizes city/state formatting, state names, and common city-name variants', () => {
    expect(localCitySuggestions('Portland, Oregon').map((city) => city.label)).toEqual([
      'Portland, OR'
    ]);
    expect(localCitySuggestions('Portland OR').map((city) => city.label)).toEqual(['Portland, OR']);
    expect(localCitySuggestions('Portland Oregon').map((city) => city.label)).toEqual([
      'Portland, OR'
    ]);
    expect(localCitySuggestions('Saint Louis, Missouri')[0]?.label).toBe('St Louis, MO');
    expect(localCitySuggestions('Ft. Worth TX')[0]?.label).toBe('Fort Worth, TX');
    expect(localCitySuggestions('NYC')[0]?.label).toBe('New York, NY');
    expect(localCitySuggestions('New York City')[0]?.label).toBe('New York, NY');
    expect(localCitySuggestions('Washington, D.C.')[0]?.label).toBe('Washington, DC');
  });

  it('ranks exact city names ahead of prefixes and breaks ties by population', () => {
    expect(localCitySuggestions('Portland')[0]?.label).toBe('Portland, OR');
    const candidates: CitySuggestion[] = [
      { label: 'New Springfield, XX', city: 'New Springfield', state: 'XX' },
      { label: 'Springfield Heights, XX', city: 'Springfield Heights', state: 'XX' },
      { label: 'Springfield, XX', city: 'Springfield', state: 'XX' }
    ];
    expect(mergeCitySuggestions('Springfield', candidates, []).map((city) => city.label)).toEqual([
      'Springfield, XX',
      'Springfield Heights, XX',
      'New Springfield, XX'
    ]);
  });

  it('deduplicates aliases without losing bundled labels and enriches missing coordinates', () => {
    const local: CitySuggestion = { label: 'New York, NY', city: 'New York', state: 'NY' };
    const remote: CitySuggestion = {
      label: 'New York City, NY',
      city: 'New York City',
      state: 'NY',
      lat: 40.7,
      lng: -74
    };
    expect(mergeCitySuggestions('NYC', [local], [remote])).toEqual([
      { ...local, lat: 40.7, lng: -74 }
    ]);
    expect(mergeCitySuggestions('New York, CA', [local], [remote])).toEqual([]);
  });
});
