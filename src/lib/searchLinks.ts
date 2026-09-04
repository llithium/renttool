import { money } from './format';

export type SearchProvider = 'apartments' | 'zillow' | 'zumper' | 'hotpads';

export interface SearchLink {
  provider: SearchProvider;
  providerName: string;
  url: string;
  prefiltered: boolean;
  capDescription?: string;
}

/** Build apartment-search links and describe which providers support a rent cap. */
export function buildSearchLinks(
  city: { city: string; state: string },
  maxRent: number
): SearchLink[] {
  const parts = {
    city: city.city,
    state: city.state.toUpperCase(),
    slug: city.city
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    st: city.state.toLowerCase()
  };
  const capped = Math.floor(maxRent / 100) * 100;

  const zState = {
    usersSearchTerm: `${parts.city}, ${parts.state}`,
    filterState: {
      fr: { value: true },
      fsba: { value: false },
      fsbo: { value: false },
      nc: { value: false },
      cmsn: { value: false },
      auc: { value: false },
      fore: { value: false },
      mp: { min: null, max: Math.round(maxRent) }
    },
    isListVisible: true
  };

  return [
    capped >= 500
      ? {
          provider: 'apartments',
          providerName: 'Apartments.com',
          capDescription: `under ${money(capped)}`,
          url: `https://www.apartments.com/${parts.slug}-${parts.st}/under-${capped}/`,
          prefiltered: true
        }
      : {
          provider: 'apartments',
          providerName: 'Apartments.com',
          url: `https://www.apartments.com/${parts.slug}-${parts.st}/`,
          prefiltered: false
        },
    {
      provider: 'zillow',
      providerName: 'Zillow',
      capDescription: `under ${money(maxRent)}`,
      url: `https://www.zillow.com/${parts.slug}-${parts.st}/rentals/?searchQueryState=${encodeURIComponent(
        JSON.stringify(zState)
      )}`,
      prefiltered: true
    },
    {
      provider: 'zumper',
      providerName: 'Zumper',
      url: `https://www.zumper.com/apartments-for-rent/${parts.slug}-${parts.st}`,
      prefiltered: false
    },
    {
      provider: 'hotpads',
      providerName: 'HotPads',
      url: `https://hotpads.com/${parts.slug}-${parts.st}/apartments-for-rent`,
      prefiltered: false
    }
  ];
}
