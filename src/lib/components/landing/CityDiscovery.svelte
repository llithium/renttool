<script lang="ts">
  import { SEED_CITIES, RENT_DATA_META } from '$lib/data/cities';
  import { findCityImage } from '$lib/data/city-images';
  import type { CitySuggestion } from '$lib/types';
  import { money } from '$lib/format';
  import { discoverCities, type PopulationFilter } from '$lib/cityDiscovery';
  import { housingRent, housingShortLabel } from '$lib/planning';
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
  let selectedState = $state('');
  let population = $state<PopulationFilter>('any');
  let limit = $state(12);
  let status = $state('');
  let cities = $derived(
    discoverCities({
      maxRent: presentation.rentTarget,
      housing: presentation.options.housing,
      state: selectedState,
      population
    })
  );
  let visible = $derived(cities.slice(0, limit));
  $effect(() => {
    void presentation.rentTarget;
    void presentation.options.housing;
    void selectedState;
    void population;
    limit = 12;
  });
</script>

<section class="discovery" aria-labelledby="discovery-heading">
  <div class="discovery-heading">
    <h2 id="discovery-heading" class="text-headline">
      {presentation.rentTarget != null ? 'Cities within your rent target' : 'Where could you land?'}
    </h2>
    {#if presentation.rentTarget != null}<p class="text-sm text-muted">
        {cities.length} cities · up to {money(presentation.rentTarget)}/mo for {housingShortLabel(
          presentation.options.housing
        )}
      </p>{/if}
  </div>
  <div class="mb-6 grid max-w-2xl gap-4 sm:grid-cols-2">
    <div>
      <label for="discovery-state" class="mb-2 block text-label text-muted">State</label><select
        id="discovery-state"
        bind:value={selectedState}
        class="min-h-11 w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm"
        ><option value="">All states</option>{#each states as st (st)}<option value={st}
            >{STATE_NAME[st] ?? st}</option
          >{/each}</select
      >
    </div>
    <div>
      <label for="discovery-population" class="mb-2 block text-label text-muted">Population</label
      ><select
        id="discovery-population"
        bind:value={population}
        class="min-h-11 w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm"
        ><option value="any">Any size</option><option value="under100k">Under 100,000</option
        ><option value="100k-500k">100,000–500,000</option><option value="500k+"
          >500,000 or more</option
        ></select
      >
    </div>
  </div>
  <p aria-live="polite" class="mb-3 text-sm text-muted">{status}</p>
  {#if !cities.length}<p role="status" class="py-8 text-sm text-muted">
      No cities match these filters and rent target. Try another state, population size, or salary.
    </p>{/if}
  <div class="city-gallery">
    {#each visible as city (city.name)}
      {@const image = findCityImage(city.city, city.state)}
      {@const rent = housingRent(city, presentation.options.housing)}
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
          class="mt-2 min-h-11 cursor-pointer text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:text-faint"
          >{presentation.isComparing(city.name)
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
    margin-top: 3.5rem;
  }
  .discovery-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  .city-gallery {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.75rem;
  }
  .destination {
    min-width: 0;
  }
  .destination-link {
    display: block;
    color: var(--ink);
    text-decoration: none;
    border-radius: 1rem;
  }
  .destination-photo {
    position: relative;
    overflow: hidden;
    border-radius: 1rem;
    background: #18304b;
    aspect-ratio: 1.5;
  }
  .destination-photo::after {
    content: '';
    position: absolute;
    inset: 30% 0 0;
    background: linear-gradient(transparent, rgb(8 24 44 / 85%));
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
    bottom: 1.2rem;
    left: 1.2rem;
    color: white;
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 650;
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
    padding: 0.9rem 0 0.35rem;
    font-size: 0.875rem;
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
  @media (max-width: 800px) {
    .city-gallery {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.5rem 1rem;
    }
  }
  @media (max-width: 440px) {
    .city-gallery {
      grid-template-columns: 1fr;
    }
  }
</style>
