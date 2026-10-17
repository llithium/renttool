<script lang="ts">
  import Select from '$lib/components/ui/Select.svelte';
  import { onMount } from 'svelte';
  import { computeBudget } from '$lib/budget';
  import { haversineMiles } from '$lib/geo';
  import { SEED_CITIES, RENT_DATA_META } from '$lib/data/cities';
  import { findCityImage } from '$lib/data/city-images';
  import type { CitySuggestion } from '$lib/types';
  import { money } from '$lib/format';
  import {
    discoverCities,
    normalizeDiscoveryFilters,
    DEFAULT_DISCOVERY_FILTERS
  } from '$lib/cityDiscovery';
  import { housingRent, housingShortLabel, computeSpendingRoom } from '$lib/planning';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import { STATE_NAME } from '$lib/data/states';

  let {
    hrefForCity,
    onchoose,
    presentation
  }: {
    hrefForCity: (name: string) => string;
    onchoose: (city: CitySuggestion) => void;
    presentation: RentPlanPresentation;
  } = $props();
  const states = [...new Set(SEED_CITIES.map((city) => city.state))].sort();
  let filters = $state({ ...DEFAULT_DISCOVERY_FILTERS });
  let filtersLoaded = $state(false);
  onMount(() => {
    try {
      filters = normalizeDiscoveryFilters(
        JSON.parse(sessionStorage.getItem('rentToolDiscovery.v1') ?? 'null')
      );
    } catch {
      /* Keep defaults when storage is unavailable. */
    }
    filtersLoaded = true;
  });
  $effect(() => {
    const snapshot = JSON.stringify(filters);
    if (filtersLoaded)
      try {
        sessionStorage.setItem('rentToolDiscovery.v1', snapshot);
      } catch {
        /* Browsing still works without storage. */
      }
  });
  let reference = $derived(SEED_CITIES.find((city) => city.name === filters.reference));
  $effect(() => {
    if (!filtersLoaded) return;
    if (
      ((filters.sort === 'spending' || filters.sort === 'target') && presentation.salary == null) ||
      (filters.sort === 'distance' && !reference)
    )
      filters.sort = 'rent';
  });
  let limit = $state(12);
  let status = $state('');
  let cities = $derived(
    discoverCities({
      maxRent: presentation.rentTarget,
      housing: presentation.options.housing,
      state: filters.state,
      population: filters.population,
      sort: filters.sort,
      reference,
      salary: presentation.salary,
      options: presentation.options
    })
  );
  let visible = $derived(cities.slice(0, limit));
  $effect(() => {
    void presentation.rentTarget;
    void presentation.options.housing;
    void filters.state;
    void filters.population;
    void filters.sort;
    void filters.reference;
    limit = 12;
  });
</script>

<section class="discovery" aria-labelledby="discovery-heading">
  <div class="discovery-heading">
    <h2 id="discovery-heading" class="text-headline">
      {presentation.rentTarget != null ? 'Cities within your rent target' : 'Where could you land?'}
    </h2>
    {#if presentation.rentTarget != null}<p class="text-sm text-muted">
        {cities.length} cities · current ceiling {money(presentation.rentTarget)}/mo for {housingShortLabel(
          presentation.options.housing
        )}
      </p>{:else}<p class="text-sm text-muted">{cities.length} cities to explore</p>{/if}
  </div>
  <div class="discovery-filters">
    <Select
      id="discovery-state"
      label="State"
      value={filters.state}
      options={[
        { value: '', label: 'All states' },
        ...states.map((value) => ({ value, label: STATE_NAME[value] ?? value }))
      ]}
      onchange={(value) => (filters.state = value)}
    />
    <Select
      id="discovery-population"
      label="Population"
      value={filters.population}
      options={[
        { value: 'any', label: 'Any size' },
        { value: 'under100k', label: 'Under 100,000' },
        { value: '100k-500k', label: '100,000–500,000' },
        { value: '500k+', label: '500,000 or more' }
      ] as const}
      onchange={(value) => (filters.population = value)}
    />
    <Select
      id="discovery-sort"
      label="Sort by"
      value={filters.sort}
      options={[
        { value: 'rent', label: 'Lowest rent' },
        { value: 'spending', label: 'Most spending room', disabled: presentation.salary == null },
        {
          value: 'target',
          label: 'Rent closest to ceiling',
          disabled: presentation.salary == null
        },
        { value: 'distance', label: 'Nearest reference city', disabled: !reference }
      ] as const}
      onchange={(value) => (filters.sort = value)}
    />
    <Select
      id="discovery-reference"
      label="Reference city"
      value={filters.reference}
      options={[
        { value: '', label: 'Choose a city' },
        ...SEED_CITIES.filter((city) => city.lat != null && city.lng != null)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((city) => ({ value: city.name, label: city.name }))
      ]}
      onchange={(value) => (filters.reference = value)}
    />
  </div>
  <p class="mt-3 mb-5 text-meta text-muted">
    Personal ceilings and spending room use each city’s estimated take-home pay. Distance is
    straight-line.
  </p>
  <p aria-live="polite" class="text-sm text-muted" class:mb-3={status !== ''}>{status}</p>
  {#if !cities.length}<p role="status" class="py-8 text-sm text-muted">
      No cities match these filters and rent target. Try another state, population size, or salary.
    </p>{/if}
  <div class="city-gallery">
    {#each visible as city (city.name)}
      {@const image = findCityImage(city.city, city.state)}
      {@const rent = housingRent(city, presentation.options.housing)}
      {@const available =
        presentation.salary != null
          ? computeSpendingRoom(
              computeBudget(presentation.salary, city),
              city,
              presentation.options
            ).available
          : null}
      {@const miles =
        reference?.lat != null && reference.lng != null && city.lat != null && city.lng != null
          ? haversineMiles(reference.lat, reference.lng, city.lat, city.lng)
          : null}
      <article class="destination">
        <a
          href={hrefForCity(city.name)}
          onclick={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            onchoose({
              label: city.name,
              city: city.city,
              state: city.state,
              lat: city.lat,
              lng: city.lng
            });
          }}
          class="destination-link"
          aria-label={`Explore ${city.name}`}
        >
          <div class="destination-photo">
            {#if image}
              <img
                src={image.url}
                alt={image.alt}
                loading="lazy"
                onerror={(event) => {
                  if (event.currentTarget instanceof HTMLImageElement)
                    event.currentTarget.style.visibility = 'hidden';
                }}
              />
            {/if}
            <span class="destination-name">{city.city}<small>{city.state}</small></span>
          </div>
          <div class="destination-rent">
            <span>{housingShortLabel(presentation.options.housing)} estimate</span>
            <strong>{rent == null ? 'Unavailable' : `${money(rent)}/mo`}</strong>
          </div>
        </a>
        {#if filters.sort === 'spending' && available != null}<p class="mt-2 text-sm text-muted">
            {money(available)}/mo after rent, expenses &amp; savings
          </p>{/if}
        {#if filters.sort === 'distance' && miles != null}<p class="mt-2 text-sm text-muted">
            {Math.round(miles)} mi from {reference?.name}
          </p>{/if}
        {#if image}
          <p class="photo-credit">
            Photo: <a href={image.photographerUrl} target="_blank" rel="noopener"
              >{image.photographerName}</a
            >
            / <a href={image.sourceUrl} target="_blank" rel="noopener">Unsplash</a>
          </p>
        {/if}
        <button
          type="button"
          disabled={!presentation.isComparing(city.name) && presentation.comparisonFull}
          onclick={() => {
            if (presentation.isComparing(city.name)) {
              presentation.removeComparison(city.name);
              status = `${city.name} removed from comparison.`;
            } else {
              const result = presentation.addComparison(city.name);
              status =
                result.status === 'added'
                  ? `${city.name} added to comparison.`
                  : 'Your comparison is full.';
            }
          }}
          class="destination-compare"
          ><svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path
              d={presentation.isComparing(city.name) ? 'M5 10h10' : 'M5 10h10m-5-5v10'}
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>{presentation.isComparing(city.name)
            ? 'Remove comparison'
            : presentation.comparisonFull
              ? 'Comparison full'
              : 'Add to comparison'}</button
        >
      </article>
    {/each}
  </div>
  {#if cities.length > limit}<button
      type="button"
      onclick={() => (limit += 12)}
      class="mt-6 min-h-11 cursor-pointer rounded-lg border border-line-strong px-4 text-sm font-semibold text-ink"
      >Show more cities</button
    >{/if}
  <p class="mt-5 text-meta text-muted">
    Apartment List estimates · {RENT_DATA_META.label}. Citywide figures, not individual listings.
  </p>
</section>

<style>
  .discovery {
    margin-top: 2.5rem;
    padding-top: 0;
  }
  .discovery-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  .discovery-filters {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--line);
    border-radius: 0.5rem;
    background: var(--card);
  }
  .city-gallery {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.75rem 1.5rem;
  }
  .destination {
    min-width: 0;
  }
  .destination-link {
    display: block;
    color: var(--ink);
    text-decoration: none;
    border-radius: 0.5rem;
  }
  .destination-photo {
    position: relative;
    overflow: hidden;
    border-radius: 0.5rem;
    background: #27272a;
    aspect-ratio: 1.7;
  }
  .destination-photo::after {
    content: '';
    position: absolute;
    inset: 25% 0 0;
    background: linear-gradient(transparent, rgb(0 0 0 / 88%));
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 220ms;
  }
  .destination-link:hover img {
    transform: scale(1.035);
  }
  .destination-name {
    position: absolute;
    z-index: 1;
    bottom: 1rem;
    left: 1rem;
    color: white;
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
  }
  small {
    display: block;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 400;
  }
  .destination-rent {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 1rem 0 0.35rem;
    font-size: 0.875rem;
  }
  .destination-rent strong {
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
  }
  .destination-rent span {
    color: var(--muted);
  }
  .photo-credit {
    font-size: 0.7rem;
    color: var(--muted);
  }
  .photo-credit a {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .destination-compare {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 2.75rem;
    margin-top: 0.5rem;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--line);
    border-radius: 0.625rem;
    color: var(--accent);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }
  .destination-compare:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .destination-compare:disabled {
    color: var(--faint);
    cursor: not-allowed;
  }
  @media (max-width: 800px) {
    .discovery {
      margin-top: 2.5rem;
      padding-top: 2rem;
    }
    .discovery-filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .city-gallery {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.5rem 1rem;
    }
  }
  @media (max-width: 440px) {
    .discovery-filters {
      gap: 1rem 0.75rem;
      padding: 1rem;
    }
    .city-gallery {
      grid-template-columns: 1fr;
    }
  }
</style>
