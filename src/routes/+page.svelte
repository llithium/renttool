<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { rentPlanPresentation as plan } from '$lib/rentPlanPresentation.svelte';
  import { createSalaryField } from '$lib/salaryField.svelte';
  import { createUrlSync } from '$lib/urlSync.svelte';

  import CitySidebar from '$lib/components/city/CitySidebar.svelte';
  import CityDiscovery from '$lib/components/landing/CityDiscovery.svelte';
  import CityFacts from '$lib/components/city/CityFacts.svelte';
  import CityImage from '$lib/components/city/CityImage.svelte';
  import EstimateNote from '$lib/components/city/EstimateNote.svelte';
  import SearchLinks from '$lib/components/city/SearchLinks.svelte';
  import NearbySuburbs from '$lib/components/city/NearbySuburbs.svelte';
  import TaxBreakdownChart from '$lib/components/city/TaxBreakdownChart.svelte';
  import ComparisonTable from '$lib/components/city/ComparisonTable.svelte';
  import RentMap from '$lib/components/city/RentMap.svelte';
  import SourcesFooter from '$lib/components/city/SourcesFooter.svelte';
  import LandingContent from '$lib/components/landing/LandingContent.svelte';
  import ApartmentCheck from '$lib/components/city/ApartmentCheck.svelte';
  import AppHeader from '$lib/components/ui/AppHeader.svelte';

  const urlSync = createUrlSync(plan);

  const salary = createSalaryField((value) => {
    plan.setSalary(value);
    urlSync.scheduleSalary(value);
  });

  let selected = $derived(plan.activeCity);
  let budget = $derived(plan.budget);

  onMount(() => {
    const teardown = urlSync.start(page.url.searchParams, () => salary.reseed(plan.salary));
    return () => {
      plan.flushPersistence();
      teardown();
    };
  });
</script>

<svelte:head>
  <title
    >{selected
      ? `${selected.name} · Rent Tool`
      : 'Rent budget calculator for your next move · Rent Tool'}</title
  >
  <meta
    name="description"
    content="Turn a salary offer into a practical rent budget, then compare it with current rent estimates, taxes, nearby options, and apartment searches."
  />
  <meta property="og:title" content="Enter salary and city · Rent Tool" />
  <meta
    property="og:description"
    content="Turn a salary offer into a practical rent budget and compare it with current local estimates."
  />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="/favicon.svg" />
</svelte:head>

<main
  id="main-content"
  data-hydrated={urlSync.hydrated ? 'true' : 'false'}
  class="mx-auto w-full max-w-7xl px-4 pt-4 pb-20 md:px-6 md:pt-6 md:pb-24"
>
  <AppHeader
    planHref={plan.buildHref('/')}
    compareHref={plan.buildHref('/compare')}
    activeView="plan"
    comparisonCount={plan.comparisonNames.length}
  />

  <div class="mt-6 flex flex-col gap-8">
    <!-- Keep supporting results mounted while the plan changes. -->
    <div data-testid="results" class="flex min-w-0 flex-col">
      {#if !urlSync.hydrated}
        <section
          aria-busy="true"
          aria-label="Loading saved rent plan"
          class="min-h-96 rounded-2xl bg-card-2 p-8 md:p-12"
        >
          <div class="h-4 w-32 animate-pulse rounded-md bg-line-strong"></div>
          <div class="mt-6 h-12 max-w-2xl animate-pulse rounded-lg bg-line"></div>
          <div class="mt-4 h-12 max-w-xl animate-pulse rounded-lg bg-line"></div>
          <div class="mt-8 h-6 max-w-2xl animate-pulse rounded-md bg-line"></div>
        </section>
      {:else}
        <!-- The same controls stay mounted across empty, valid, and invalid salaries. -->
        <LandingContent presentation={plan}>
          <CitySidebar presentation={plan} {salary} onsalary={(value) => salary.set(value)} />
        </LandingContent>
      {/if}

      {#if urlSync.hydrated && !selected}
        <CityDiscovery
          presentation={plan}
          onchoose={(city) => {
            void plan.chooseCity(city);
            document.getElementById('main-content')?.scrollIntoView({ behavior: 'instant' });
          }}
          hrefForCity={(name) => {
            const params = new URLSearchParams(plan.buildHref('/').split('?')[1]);
            params.set('city', name);
            if (plan.salary) params.set('salary', String(plan.salary));
            return `/?${params}`;
          }}
        />
        <p class="mt-8 text-sm text-muted">
          Rent ceilings reserve your expenses, savings, and buffer, capped at 30% of gross income.
        </p>
      {/if}

      {#if urlSync.hydrated && selected}
        <nav
          aria-label="Plan sections"
          class="sticky top-0 z-30 -mx-4 mt-6 flex flex-wrap gap-1 border-b border-line bg-canvas/95 px-4 py-2 md:mx-0 md:px-0"
        >
          {#if budget}<a
              class="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-label text-muted no-underline hover:bg-card-2 hover:text-ink"
              href="#listing-search">Listings</a
            >{/if}
          <a
            class="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-label text-muted no-underline hover:bg-card-2 hover:text-ink"
            href="#rent-map">Map</a
          >
          <a
            class="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-label text-muted no-underline hover:bg-card-2 hover:text-ink"
            href="#nearby-options">Nearby options</a
          >
          {#if budget}
            <a
              class="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-label text-muted no-underline hover:bg-card-2 hover:text-ink"
              href="#apartment-check">Apartment check</a
            >
          {/if}
          <a
            class="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-label text-muted no-underline hover:bg-card-2 hover:text-ink"
            href="#city-details">City &amp; taxes</a
          >
          <a
            class="ml-auto inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-label text-muted no-underline hover:bg-card-2 hover:text-ink"
            href="#plan-controls">Edit plan</a
          >
        </nav>

        {#if budget}
          <section id="listing-search" aria-label="Apartment searches" class="scroll-mt-28 pt-7">
            <EstimateNote
              city={selected}
              housing={plan.options.housing}
              class="mt-3 max-w-[74ch]"
            />
            <SearchLinks
              city={selected}
              maxRent={plan.rentTarget ?? budget.maxRent}
              housing={plan.options.housing}
              class="mt-5 rounded-lg border border-line bg-card p-5 md:p-7"
            />
          </section>
          {#key `${selected.name}:${plan.options.housing}`}
            <ApartmentCheck presentation={plan} />
          {/key}
        {/if}
        <div
          class="mt-6 grid min-w-0 gap-7 rounded-lg border border-line bg-card p-5 md:p-7 lg:grid-cols-2 lg:gap-8"
        >
          <section id="rent-map" tabindex="-1" aria-label="Rent map" class="min-w-0 scroll-mt-28">
            <RentMap presentation={plan} />
          </section>
          <section
            id="nearby-options"
            tabindex="-1"
            aria-label="Nearby rent options"
            class="min-w-0 scroll-mt-28 border-line max-lg:border-t max-lg:pt-7 lg:border-l lg:pl-8"
          >
            <NearbySuburbs presentation={plan} city={selected} />
          </section>
        </div>

        <section
          id="city-details"
          tabindex="-1"
          aria-label="City and tax details"
          class="mt-6 grid min-w-0 scroll-mt-28 gap-6 {budget
            ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]'
            : ''}"
        >
          <div class="min-w-0 rounded-lg border border-line bg-card p-5 md:p-7">
            <CityFacts city={selected} looking={plan.looking} />
          </div>
          {#if budget}
            <div class="min-w-0 rounded-lg border border-line bg-card p-5 md:p-7">
              <TaxBreakdownChart
                city={selected}
                {budget}
                housing={plan.options.housing}
                actualTakeHomeMonthly={plan.actualTakeHomeMonthly}
              />
            </div>
          {/if}
          {#key selected.name}<CityImage
              city={selected}
              class="overflow-hidden rounded-lg lg:col-span-full"
            />{/key}
        </section>

        {#if budget && plan.comparisonCities.length}
          <ComparisonTable
            presentation={plan}
            class="mt-6 rounded-lg border border-line bg-card p-5 md:p-7"
          />
        {/if}
      {/if}

      {#if urlSync.hydrated}
        <SourcesFooter class="mt-8 border-t border-line pt-7" />
      {/if}
    </div>
  </div>
</main>
