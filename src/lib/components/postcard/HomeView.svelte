<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import type { SalaryField as SalaryFieldState } from '$lib/salaryField.svelte';
  import type { City, CitySuggestion } from '$lib/types';
  import { SEED_CITIES } from '$lib/data/cities';
  import { STATE_NAME } from '$lib/data/states';
  import { findCityImage } from '$lib/data/city-images';
  import { computeBudget } from '$lib/budget';
  import { haversineMiles } from '$lib/geo';
  import { money } from '$lib/format';
  import { housingRent, rentCeiling } from '$lib/planning';
  import { housingWords, readRent } from '$lib/postcard';
  import {
    discoverCities,
    normalizeDiscoveryFilters,
    type DiscoverySort,
    type PopulationFilter
  } from '$lib/cityDiscovery';
  import TopBar from './TopBar.svelte';
  import CityFront from './CityFront.svelte';
  import PlaceSearch from './PlaceSearch.svelte';
  import SalaryField from './SalaryField.svelte';
  import HousingToggle from './HousingToggle.svelte';
  import Stamp from './Stamp.svelte';
  import MiniPostcard from './MiniPostcard.svelte';
  import SiteFooter from './SiteFooter.svelte';

  let { presentation, salary }: { presentation: RentPlanPresentation; salary: SalaryFieldState } =
    $props();

  const PAGE = 6;
  const STORAGE_KEY = 'rentToolDiscovery.v2';
  let search: PlaceSearch;
  let limit = $state(PAGE);
  let stateFilter = $state('');
  let size = $state<PopulationFilter>('any');
  let sort = $state<DiscoverySort>('distance');
  let loaded = $state(false);
  let message = $state('');
  let openError = $state('');

  const states = [...new Set(SEED_CITIES.map((city) => city.state))].sort((a, b) =>
    (STATE_NAME[a] ?? a).localeCompare(STATE_NAME[b] ?? b)
  );

  // A different large, photographed city leads the home card each day.
  const featuredPool = SEED_CITIES.filter(
    (city) =>
      city.r1 != null &&
      city.lat != null &&
      findCityImage(city.city, city.state) &&
      (city.citySnapshot?.population ?? city.pop ?? 0) >= 250_000
  );
  const day = Math.floor(Date.now() / 86_400_000);
  const featured: City = featuredPool[day % featuredPool.length] ?? SEED_CITIES[0];

  onMount(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
      const filters = normalizeDiscoveryFilters(saved);
      stateFilter = filters.state;
      size = filters.population;
      sort = saved?.sort ? filters.sort : 'distance';
    } catch {
      /* Defaults are fine without storage. */
    }
    loaded = true;
  });
  $effect(() => {
    const snapshot = JSON.stringify({ state: stateFilter, population: size, sort });
    if (!loaded) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, snapshot);
    } catch {
      /* Browsing works without storage. */
    }
  });

  let housing = $derived(presentation.options.housing);
  let words = $derived(housingWords(housing));
  let grossCeiling = $derived(
    presentation.salary == null ? null : computeBudget(presentation.salary).maxRent
  );
  let ceilingFor = $derived((city: City) =>
    presentation.salary == null
      ? null
      : rentCeiling(computeBudget(presentation.salary, city), presentation.options)
  );
  let tally = $derived.by(() => {
    const counts = { within: 0, near: 0, above: 0 };
    if (presentation.salary == null) return null;
    for (const city of SEED_CITIES) {
      const fit = readRent(housingRent(city, housing), ceilingFor(city)).fit;
      if (fit !== 'unknown') counts[fit] += 1;
    }
    return counts;
  });
  let tallyTotal = $derived(tally ? tally.within + tally.near + tally.above : 0);
  let gallery = $derived(
    discoverCities({
      maxRent: null,
      housing,
      state: stateFilter,
      population: size,
      sort,
      reference: featured,
      salary: presentation.salary,
      options: presentation.options
    })
  );
  let shown = $derived(gallery.slice(0, limit));
  let featuredRent = $derived(housingRent(featured, housing));

  function hrefFor(city: City) {
    const params = new URLSearchParams(presentation.buildHref('/city').split('?')[1]);
    params.set('city', city.name);
    if (presentation.salary) params.set('salary', String(presentation.salary));
    return `/city?${params}`;
  }

  function open(city: City) {
    return (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      event.preventDefault();
      choose({
        label: city.name,
        city: city.city,
        state: city.state,
        lat: city.lat,
        lng: city.lng
      });
    };
  }

  // Settle the city here, then open its page with the whole plan in the link.
  async function choose(suggestion: CitySuggestion) {
    openError = '';
    const name = await presentation.chooseCity(suggestion);
    if (presentation.selectedName !== name || !presentation.activeCity) {
      openError = `Couldn't open ${suggestion.label}. Try another spelling or a nearby city.`;
      return;
    }
    await goto(presentation.buildHref('/city'));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function toggleCompare(city: City) {
    if (presentation.isComparing(city.name)) {
      presentation.removeComparison(city.name);
      message = `${city.name} removed from your comparison.`;
      return;
    }
    const result = presentation.addComparison(city.name);
    message =
      result.status === 'full'
        ? 'Your comparison already has five cities.'
        : `${city.name} added to your comparison.`;
  }
</script>

<div class="pc-wrap">
  <TopBar homeHref="/">
    {#snippet end()}
      {#if presentation.activeCity}
        <a class="pc-btn pc-btn-quiet" href={presentation.buildHref('/city')}
          >Back to {presentation.activeCity.city}</a
        >
      {/if}
      <a class="pc-btn" href={presentation.buildHref('/compare')}
        >Compare cities{#if presentation.comparisonNames.length}<span class="pc-home-count"
            >{presentation.comparisonNames.length}</span
          >{/if}</a
      >
    {/snippet}
  </TopBar>

  <article class="pc-card pc-home" aria-label="Start a rent plan">
    <div class="pc-home-front">
      <CityFront
        place={featured}
        variant="feature"
        heading="h2"
        detail={`${STATE_NAME[featured.state] ?? featured.state}${featuredRent != null ? ` · ${words.short} ${money(featuredRent)} a month` : ''}`}
      >
        {#snippet badge()}<span class="pc-home-badge">Featured city</span>{/snippet}
        {#snippet action()}<a
            class="pc-home-explore"
            href={hrefFor(featured)}
            onclick={open(featured)}>Explore {featured.city}</a
          >{/snippet}
      </CityFront>
    </div>

    <form
      class="pc-home-back"
      onsubmit={(event) => {
        event.preventDefault();
        search.submit();
      }}
    >
      <div class="pc-home-form">
        <h1 class="pc-home-title pc-display">Find your city.<br />Know your rent.</h1>
        <p class="pc-home-lede">
          Put in an offer and a place. You'll see the rent there, what you'd keep each month, and
          the towns around it.
        </p>
        <SalaryField field={salary} variant="line" label="Salary offer, per year" />
        <PlaceSearch
          bind:this={search}
          variant="line"
          onselect={choose}
          pendingName={presentation.pendingName}
          {housing}
          placeholder={`Search ${SEED_CITIES.length} cities`}
        />
        <div class="pc-home-row">
          <HousingToggle
            value={housing}
            onchange={(value) =>
              presentation.setOptions({ ...presentation.options, housing: value })}
          />
        </div>
        <div class="pc-home-go">
          <button type="submit" class="pc-btn pc-btn-dark pc-btn-lg">See the city</button>
          <span>or browse what fits below</span>
        </div>
        <p class={openError ? 'pc-home-error' : 'sr-only'} role="status">{openError}</p>
      </div>

      <i class="pc-home-rule" aria-hidden="true"></i>

      <div class="pc-home-stamp">
        <div class="pc-home-ceiling">
          {#if grossCeiling != null}
            <Stamp
              size={196}
              ceiling={grossCeiling}
              description={`Rent ceiling ${money(grossCeiling)} a month`}
            />
            <p class="pc-home-ceiling-title pc-display">Your rent ceiling</p>
            <p class="pc-home-note">
              30% of {money(presentation.salary)} before taxes. Add your costs on the city page to tighten
              it.
            </p>
          {:else}
            <Stamp size={196} label="30%" description="Rent ceiling, waiting for a salary" />
            <p class="pc-home-ceiling-title pc-display">Your rent ceiling</p>
            <p class="pc-home-note">
              30% of your salary before taxes. Type an offer to see it in dollars.
            </p>
          {/if}
        </div>
        {#if tally}
          <div class="pc-home-tally" data-testid="ceiling-tally">
            <p class="pc-home-note">{tallyTotal} cities at this ceiling</p>
            <div class="pc-home-bar" aria-hidden="true">
              <i data-fit="within" style:width={`${(tally.within / tallyTotal) * 100}%`}></i>
              <i data-fit="near" style:width={`${(tally.near / tallyTotal) * 100}%`}></i>
              <i data-fit="above" style:width={`${(tally.above / tallyTotal) * 100}%`}></i>
            </div>
            <dl>
              <div>
                <dt>Fit</dt>
                <dd class="pc-display">{tally.within}</dd>
              </div>
              <div>
                <dt>Tight</dt>
                <dd class="pc-display">{tally.near}</dd>
              </div>
              <div>
                <dt>Over</dt>
                <dd class="pc-display">{tally.above}</dd>
              </div>
            </dl>
          </div>
        {/if}
      </div>
    </form>
  </article>

  <section class="pc-section" aria-labelledby="gallery-heading">
    <div class="pc-home-head">
      <div>
        <h2 id="gallery-heading" class="pc-h2">
          {#if presentation.salary != null}
            {gallery.length} cities within {money(grossCeiling)}
          {:else}
            Cities to start with
          {/if}
        </h2>
        <p class="pc-lede">
          {sort === 'distance'
            ? `Nearest ${featured.city} first. Distance is straight-line.`
            : sort === 'population'
              ? 'Largest first.'
              : sort === 'rent'
                ? 'Lowest rent first.'
                : 'Most left after rent first.'}
          {presentation.salary == null ? 'Add a salary to keep only what fits.' : ''}
        </p>
      </div>
      <div class="pc-home-filters">
        <label class="pc-home-select"
          ><span>State</span><select bind:value={stateFilter} onchange={() => (limit = PAGE)}
            ><option value="">All states</option>{#each states as code (code)}<option value={code}
                >{STATE_NAME[code] ?? code}</option
              >{/each}</select
          ></label
        >
        <label class="pc-home-select"
          ><span>Size</span><select bind:value={size} onchange={() => (limit = PAGE)}
            ><option value="any">Any size</option><option value="under100k">Under 100k</option
            ><option value="100k-500k">100k to 500k</option><option value="500k+"
              >500k and up</option
            ></select
          ></label
        >
        <label class="pc-home-select"
          ><span>Sort</span><select bind:value={sort} onchange={() => (limit = PAGE)}
            ><option value="distance">Nearest {featured.city}</option><option value="population"
              >Largest</option
            ><option value="rent">Lowest rent</option><option value="spending"
              >Most left after rent</option
            ></select
          ></label
        >
      </div>
    </div>
    <p class={message ? 'pc-home-msg' : 'sr-only'} aria-live="polite">{message}</p>
    {#if shown.length}
      <div class="pc-home-gallery">
        {#each shown as city (city.name)}
          <MiniPostcard
            {city}
            ceiling={ceilingFor(city)}
            {housing}
            miles={sort === 'distance' &&
            city.lat != null &&
            featured.lat != null &&
            featured.lng != null
              ? haversineMiles(featured.lat, featured.lng, city.lat, city.lng!)
              : null}
            href={hrefFor(city)}
            onopen={open(city)}
            comparing={presentation.isComparing(city.name)}
            compareFull={presentation.comparisonFull}
            oncompare={() => toggleCompare(city)}
          />
        {/each}
      </div>
      {#if gallery.length > limit}
        <div class="pc-home-more">
          <button type="button" class="pc-btn pc-btn-lg" onclick={() => (limit += PAGE)}
            >Show {Math.min(PAGE, gallery.length - limit)} more</button
          >
        </div>
      {/if}
    {:else}
      <p class="pc-lede">Nothing fits those filters. Try another state or size.</p>
    {/if}
  </section>

  <section class="pc-section" aria-labelledby="key-heading">
    <h2 id="key-heading" class="pc-h2">How to read the stamp</h2>
    <p class="pc-lede">
      The ring fills with how much of your ceiling the rent uses. The stamp's colour gives the
      verdict.
    </p>
    <div class="pc-home-key">
      <div>
        <Stamp size={100} fit="within" share={0.72} description="Rent uses 72% of the ceiling" />
        <div>
          <p class="pc-home-key-title pc-display">Fits</p>
          <p class="pc-home-note">
            Rent is more than 5% under your ceiling, so there's room for everything else.
          </p>
        </div>
      </div>
      <div>
        <Stamp size={100} fit="near" share={0.98} description="Rent uses 98% of the ceiling" />
        <div>
          <p class="pc-home-key-title pc-display">Tight</p>
          <p class="pc-home-note">Rent is within 5% of your ceiling. Doable, with little slack.</p>
        </div>
      </div>
      <div>
        <Stamp size={100} fit="above" share={1.11} description="Rent is 111% of the ceiling" />
        <div>
          <p class="pc-home-key-title pc-display">Over</p>
          <p class="pc-home-note">
            Rent is above your ceiling. Look at the towns nearby, or a shared place.
          </p>
        </div>
      </div>
    </div>
  </section>

  <SiteFooter />
</div>

<style>
  .pc-home-error {
    margin: 0.75rem 0 0;
    color: var(--red);
    font-size: 0.875rem;
  }
  .pc-home-count {
    display: inline-flex;
    min-width: 1.375rem;
    height: 1.375rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--pink);
    font-size: 0.75rem;
  }
  .pc-home {
    display: grid;
    grid-template-columns: minmax(0, 44fr) minmax(0, 56fr);
    margin-top: 0.75rem;
    overflow: hidden;
  }
  .pc-home-front {
    min-width: 0;
  }
  .pc-home-badge {
    display: inline-block;
    padding: 0.5rem 0.875rem;
    border-radius: 999px;
    background: #fff;
    color: var(--navy);
    font-size: 0.875rem;
    font-weight: 600;
  }
  .pc-home-explore {
    color: #fff;
    font-weight: 600;
  }
  .pc-home-explore:focus-visible {
    outline-color: var(--pink);
  }
  .pc-home-back {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 1px 15.625rem;
    gap: 1.75rem;
    padding: 2rem;
  }
  .pc-home-form {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.75rem;
  }
  .pc-home-title {
    margin: 0;
    font-size: 3.625rem;
    font-weight: 800;
    line-height: 0.92;
  }
  .pc-home-lede {
    max-width: 44ch;
    margin: 0.25rem 0 0.5rem;
    color: var(--muted);
    font-size: 1.0625rem;
    line-height: 1.5;
  }
  .pc-home-row {
    margin-top: 0.75rem;
  }
  .pc-home-go {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.625rem 0.875rem;
    margin-top: auto;
    padding-top: 1.5rem;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .pc-home-rule {
    background: var(--navy);
    opacity: 0.25;
  }
  .pc-home-stamp {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    text-align: center;
  }
  .pc-home-ceiling {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .pc-home-ceiling-title {
    margin: 1rem 0 0;
    font-size: 1.375rem;
    font-weight: 700;
  }
  .pc-home-note {
    margin: 0.375rem 0 0;
    color: var(--muted);
    font-size: 0.875rem;
    line-height: 1.45;
  }
  .pc-home-tally {
    width: 100%;
    padding-top: 1rem;
    border-top: 1.5px solid var(--navy);
  }
  .pc-home-tally > .pc-home-note {
    margin: 0 0 0.5rem;
    font-size: 0.8125rem;
  }
  .pc-home-bar {
    display: flex;
    height: 14px;
    overflow: hidden;
    border: 1.5px solid var(--navy);
    border-radius: 7px;
  }
  .pc-home-bar i[data-fit='within'] {
    background: var(--pink);
  }
  .pc-home-bar i[data-fit='near'] {
    background: #fff;
  }
  .pc-home-bar i[data-fit='above'] {
    background: var(--slate);
  }
  .pc-home-bar i + i {
    border-left: 1.5px solid var(--navy);
  }
  .pc-home-tally dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.375rem;
    margin: 0.625rem 0 0;
    color: var(--muted);
    font-size: 0.75rem;
  }
  .pc-home-tally dd {
    margin: 0;
    color: var(--navy);
    font-size: 1.25rem;
    font-weight: 800;
  }
  .pc-home-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }
  .pc-home-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
  }
  .pc-home-select {
    display: inline-flex;
    height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.875rem 0 1rem;
    border: 1.5px solid var(--navy);
    border-radius: 999px;
    background: #fff;
    font-size: 0.875rem;
  }
  .pc-home-select:focus-within {
    outline: 2px solid var(--navy);
    outline-offset: 2px;
  }
  .pc-home-select span {
    color: var(--muted);
  }
  .pc-home-select select {
    max-width: 12rem;
    border: 0;
    background: transparent;
    color: var(--navy);
    font-weight: 600;
    outline: none;
  }
  .pc-home-msg {
    margin: 1rem 0 0;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .pc-home-gallery {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem;
    margin-top: 1.75rem;
  }
  .pc-home-more {
    display: flex;
    justify-content: center;
    margin-top: 1.5rem;
  }
  .pc-home-key {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem;
    margin-top: 1.75rem;
  }
  .pc-home-key > div {
    display: grid;
    grid-template-columns: 100px minmax(0, 1fr);
    gap: 1.25rem;
    align-items: center;
    padding: 1.5rem;
    border-radius: 8px;
    background: #fff;
  }
  .pc-home-key-title {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 700;
  }
  @media (max-width: 1080px) {
    .pc-home {
      grid-template-columns: minmax(0, 1fr);
    }
    .pc-home-back {
      grid-template-columns: minmax(0, 1fr);
    }
    .pc-home-rule {
      display: none;
    }
    .pc-home-gallery {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .pc-home-key {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 680px) {
    .pc-home-gallery {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 600px) {
    .pc-home-back {
      padding: 1.25rem 1rem;
    }
    .pc-home-title {
      font-size: 2.75rem;
    }
    .pc-home-key > div {
      padding: 1rem;
    }
  }
</style>
