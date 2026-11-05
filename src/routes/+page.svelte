<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { rentPlanPresentation as plan } from '$lib/rentPlanPresentation.svelte';
  import { createSalaryField } from '$lib/salaryField.svelte';
  import { createUrlSync } from '$lib/urlSync.svelte';

  import CitySidebar from '$lib/components/city/CitySidebar.svelte';
  import CityDiscovery from '$lib/components/landing/CityDiscovery.svelte';
  import CityFacts from '$lib/components/city/CityFacts.svelte';
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
  let cityDetailsOpen = $state(true);
  let areaOpen = $state(true);
  let activeSection = $state('');
  let apartmentOpen = $state(false);
  $effect(() => {
    if (plan.mapFocusRequest > 0 || plan.commute.destination) areaOpen = true;
  });

  function revealLinkedSection() {
    activeSection = window.location.hash;
    if (activeSection === '#apartment-check') apartmentOpen = true;
    if (activeSection === '#rent-map' || activeSection === '#nearby-options') areaOpen = true;
    if (activeSection === '#city-details') cityDetailsOpen = true;
  }
  $effect(() => {
    if (apartmentOpen) activeSection = '#apartment-check';
    else if (activeSection === '#apartment-check') activeSection = '';
  });

  onMount(() => {
    revealLinkedSection();
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

<svelte:window onhashchange={revealLinkedSection} />

<main
  id="main-content"
  tabindex="-1"
  data-hydrated={urlSync.hydrated ? 'true' : 'false'}
  class="mx-auto w-full max-w-[120rem] px-4 pt-4 pb-12 md:px-6 md:pt-6 md:pb-16"
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
        {#if selected}
          <nav
            aria-label="Plan sections"
            data-section-nav="plan"
            class="mt-2 flex flex-wrap items-center gap-x-4 border-b border-line py-2 lg:border-y"
          >
            {#if budget}
              <a
                class="inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-deep"
                href="#apartment-check"
                onclick={() => (apartmentOpen = true)}
                aria-current={activeSection === '#apartment-check' ? 'location' : undefined}
                >Apartment check</a
              >
            {/if}
            {#if budget}<a
                class="inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-deep"
                href="#listing-search"
                aria-current={activeSection === '#listing-search' ? 'location' : undefined}
                >Listings</a
              >{/if}
            <a
              class="inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-deep"
              href="#rent-map"
              aria-current={activeSection === '#rent-map' ? 'location' : undefined}
              onclick={() => (areaOpen = true)}>Map</a
            >
            <a
              class="inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-deep"
              href="#nearby-options"
              aria-current={activeSection === '#nearby-options' ? 'location' : undefined}
              onclick={() => (areaOpen = true)}>Nearby options</a
            >

            <a
              class="inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-deep"
              href="#city-details"
              aria-current={activeSection === '#city-details' ? 'location' : undefined}
              onclick={() => (cityDetailsOpen = true)}>City &amp; taxes</a
            >
          </nav>
        {/if}
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
        {#if budget}
          {#key `${selected.name}:${plan.options.housing}`}
            <ApartmentCheck presentation={plan} bind:open={apartmentOpen} />
          {/key}
          <section id="listing-search" aria-label="Apartment searches" class="scroll-mt-28">
            <SearchLinks
              city={selected}
              maxRent={plan.rentTarget ?? budget.maxRent}
              housing={plan.options.housing}
              class="py-5"
            />
          </section>
        {/if}
        <details bind:open={areaOpen} class="border-b border-line">
          <summary class="min-h-14 cursor-pointer py-4 text-title">Map &amp; nearby rents</summary>
          <div class="grid min-w-0 items-start gap-7 pb-6 lg:grid-cols-2 lg:gap-8">
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
        </details>

        <section
          id="city-details"
          tabindex="-1"
          aria-label="City and tax details"
          class="min-w-0 scroll-mt-28 border-b border-line"
        >
          <details bind:open={cityDetailsOpen}>
            <summary class="min-h-14 cursor-pointer py-4 text-title"
              >City facts &amp; tax breakdown</summary
            >
            <div
              class="grid min-w-0 gap-6 {budget
                ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]'
                : ''}"
            >
              <div class="min-w-0 py-6">
                <CityFacts city={selected} looking={plan.looking} />
              </div>
              {#if budget}
                <div class="min-w-0 py-6">
                  <TaxBreakdownChart
                    city={selected}
                    {budget}
                    housing={plan.options.housing}
                    actualTakeHomeMonthly={plan.actualTakeHomeMonthly}
                  />
                </div>
              {/if}
            </div>
          </details>
        </section>

        {#if budget && plan.comparisonCities.length}
          <ComparisonTable presentation={plan} class="mt-6 border-t border-line py-6" />
        {/if}
      {/if}

      {#if urlSync.hydrated}
        <SourcesFooter class="mt-6 pt-4" />
      {/if}
    </div>
  </div>
</main>
