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
  import RentTrendChart from '$lib/components/city/RentTrendChart.svelte';
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
        <LandingContent city={selected}>
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
        <footer class="mt-12 border-t border-line pt-6 text-sm text-muted">
          Rent ceilings reserve your expenses, savings, and buffer, capped at 30% of gross income.
        </footer>
      {/if}

      {#if urlSync.hydrated && selected}
        <nav
          aria-label="Plan sections"
          class="sticky top-0 z-30 -mx-4 mt-6 flex flex-wrap gap-1 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur-sm md:mx-0 md:px-0"
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
              class="mt-6 rounded-xl border border-line bg-card p-5 md:p-6"
            />
          </section>
          {#key `${selected.name}:${plan.options.housing}`}
            <ApartmentCheck presentation={plan} />
          {/key}
        {/if}
        <section
          id="nearby-options"
          tabindex="-1"
          aria-label="Nearby rent options"
          class="scroll-mt-28"
        >
          <NearbySuburbs
            presentation={plan}
            city={selected}
            class="mt-7 border-t border-line pt-7"
          />
        </section>

        <section
          id="rent-map"
          tabindex="-1"
          aria-label="Rent map"
          class="scroll-mt-28 border-t border-line pt-7"
        >
          <RentMap presentation={plan} />
        </section>

        <section
          id="city-details"
          tabindex="-1"
          aria-label="City and tax details"
          class="scroll-mt-28"
        >
          <CityFacts city={selected} looking={plan.looking} class="mt-7" />
          {#key selected.name}<CityImage city={selected} class="mt-7" />{/key}
        </section>

        {#if budget}
          <!-- The two charts share one section band, split by a hairline rather
             than sitting in two boxes. They remain visible because the budget
             and market comparison are part of the same decision. -->
          <div
            class="mt-7 grid grid-cols-1 gap-6 border-t border-line pt-7 md:grid-cols-2 md:gap-8"
          >
            <RentTrendChart
              city={selected}
              {budget}
              housing={plan.options.housing}
              target={plan.rentTarget ?? budget.maxRent}
            />
            <TaxBreakdownChart
              city={selected}
              {budget}
              housing={plan.options.housing}
              actualTakeHomeMonthly={plan.actualTakeHomeMonthly}
              class="border-line max-md:border-t max-md:pt-6 md:border-l md:pl-8"
            />
          </div>
        {/if}

        {#if budget && plan.comparisonCities.length}
          <ComparisonTable presentation={plan} class="mt-7 border-t border-line pt-7" />
        {/if}
      {/if}

      {#if urlSync.hydrated && selected}
        <SourcesFooter class="mt-7 border-t border-line pt-7" />
      {/if}
    </div>
  </div>
</main>
