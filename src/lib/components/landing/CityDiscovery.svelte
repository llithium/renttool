<script lang="ts">
  import Select from '$lib/components/ui/Select.svelte';
  import { onMount } from 'svelte';
  import { computeBudget } from '$lib/budget';
  import { haversineMiles } from '$lib/geo';
  import { SEED_CITIES, RENT_DATA_META } from '$lib/data/cities';
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
      filters.sort = DEFAULT_DISCOVERY_FILTERS.sort;
  });
  let limit = $state(6);
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
    limit = 6;
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
      </p>{:else}<p class="text-sm text-muted">
        Showing {visible.length} of {cities.length} cities
      </p>{/if}
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
        { value: 'population', label: 'Largest cities' },
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
      label="Reference city for distance"
      value={filters.reference}
      options={[
        { value: '', label: 'Choose a city' },
        ...SEED_CITIES.filter((city) => city.lat != null && city.lng != null)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((city) => ({ value: city.name, label: city.name }))
      ]}
      onchange={(value) => {
        filters.reference = value;
        filters.sort = value ? 'distance' : DEFAULT_DISCOVERY_FILTERS.sort;
      }}
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
        <div class="destination-content">
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
            <div class="destination-top">
              <span class="destination-name"
                ><span data-city-name>{city.city}</span><small
                  >{STATE_NAME[city.state] ?? city.state}</small
                ></span
              >
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
        </div>

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
          aria-label={presentation.isComparing(city.name)
            ? `Remove ${city.name} from comparison`
            : presentation.comparisonFull
              ? `Comparison full; cannot add ${city.name}`
              : `Add ${city.name} to comparison`}
          aria-pressed={presentation.isComparing(city.name)}
          ><svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path
              d={presentation.isComparing(city.name) ? 'M5 10h10' : 'M5 10h10m-5-5v10'}
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg><span data-compare-long aria-hidden="true"
            >{presentation.isComparing(city.name)
              ? 'Remove comparison'
              : presentation.comparisonFull
                ? 'Comparison full'
                : 'Add to comparison'}</span
          ><span data-compare-short aria-hidden="true"
            >{presentation.isComparing(city.name)
              ? 'Remove'
              : presentation.comparisonFull
                ? 'Full'
                : 'Compare'}</span
          ></button
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
    margin-top: 3rem;
  }
  .discovery-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }
  .discovery-filters {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
  }
  .city-gallery {
    border-top: 2px solid var(--ink);
  }
  .destination {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    border-bottom: 1px solid var(--line);
    padding: 1rem 0;
  }
  .destination-content {
    min-width: 0;
  }
  .destination-link {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(8rem, 0.45fr);
    align-items: center;
    gap: 1rem;
    color: var(--ink);
    text-decoration: none;
  }
  [data-city-name] {
    text-decoration: underline;
    text-decoration-color: var(--line-strong);
    text-underline-offset: 0.18em;
    text-decoration-thickness: 1px;
  }
  .destination-name {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1.15;
  }
  small {
    display: block;
    margin-top: 0.25rem;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 400;
    color: var(--muted);
  }
  .destination-rent {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .destination-rent span {
    display: block;
    color: var(--muted);
    font-size: 0.75rem;
  }
  .destination-rent strong {
    font-size: 1.25rem;
    font-weight: 600;
  }
  .destination-link:hover .destination-name {
    color: var(--accent);
  }
  .destination-compare {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem;
    color: var(--accent);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .destination-compare svg {
    flex-shrink: 0;
  }
  [data-compare-short] {
    display: none;
  }
  .destination-compare[aria-pressed='true'] {
    color: var(--ink);
  }
  .destination-compare:disabled {
    color: var(--muted);
    cursor: not-allowed;
  }
  @media (max-width: 640px) {
    .discovery-filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .destination {
      gap: 0.5rem;
    }
    .destination-link {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.5rem;
    }
    .destination-name {
      font-size: 1.375rem;
    }
    .destination-rent strong {
      font-size: 1rem;
    }
    .destination-compare {
      justify-content: flex-end;
      padding: 0.5rem 0;
      font-size: 0.8125rem;
    }
    [data-compare-long] {
      display: none;
    }
    [data-compare-short] {
      display: inline;
    }
  }
</style>
