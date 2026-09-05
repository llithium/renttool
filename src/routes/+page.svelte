<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { rentPlanPresentation as plan } from '$lib/rentPlanPresentation.svelte';
  import { createSalaryField } from '$lib/salaryField.svelte';
  import { createUrlSync } from '$lib/urlSync.svelte';

  import CitySidebar from '$lib/components/city/CitySidebar.svelte';
  import CityImage from '$lib/components/city/CityImage.svelte';
  import Verdict from '$lib/components/city/Verdict.svelte';
  import CityFacts from '$lib/components/city/CityFacts.svelte';
  import EstimateNote from '$lib/components/city/EstimateNote.svelte';
  import SearchLinks from '$lib/components/city/SearchLinks.svelte';
  import NearbySuburbs from '$lib/components/city/NearbySuburbs.svelte';
  import RentTrendChart from '$lib/components/city/RentTrendChart.svelte';
  import TaxBreakdownChart from '$lib/components/city/TaxBreakdownChart.svelte';
  import ComparisonTable from '$lib/components/city/ComparisonTable.svelte';
  import RentMap from '$lib/components/city/RentMap.svelte';
  import SourcesFooter from '$lib/components/city/SourcesFooter.svelte';
  import LandingContent from '$lib/components/landing/LandingContent.svelte';
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
  <meta property="og:title" content="Know what rent fits before you move · Rent Tool" />
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
  class="mx-auto w-full max-w-384 px-4 pt-4 pb-20 md:px-6 md:pt-6 md:pb-24"
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

      {#if urlSync.hydrated && selected && budget}
        {#if selected.r1 != null}
          <Verdict {budget} city={selected} class="mt-7" />
        {/if}
        <EstimateNote city={selected} class="mt-3 max-w-[74ch]" />
        {#key selected.name}
          <CityImage city={selected} class="mt-7 max-w-3xl" />
        {/key}
        <CityFacts
          city={selected}
          looking={plan.looking}
          class={selected.r1 != null ? 'mt-7 border-t border-line pt-7' : 'mt-3.5'}
        />

        <!-- The two charts share one section band, split by a hairline rather
             than sitting in two boxes. They remain visible because the budget
             and market comparison are part of the same decision. -->
        <div class="mt-7 grid grid-cols-1 gap-6 border-t border-line pt-7 md:grid-cols-2 md:gap-8">
          <RentTrendChart city={selected} {budget} />
          <TaxBreakdownChart
            city={selected}
            {budget}
            class="border-line max-md:border-t max-md:pt-6 md:border-l md:pl-8"
          />
        </div>

        <SearchLinks
          city={selected}
          maxRent={budget.maxRent}
          class="mt-7 border-t border-line pt-7"
        />

        <NearbySuburbs presentation={plan} city={selected} class="mt-7 border-t border-line pt-7" />

        {#if plan.comparisonCities.length}
          <ComparisonTable presentation={plan} class="mt-7 border-t border-line pt-7" />
        {/if}

        <RentMap presentation={plan} class="mt-7 border-t border-line pt-7" />
      {/if}

      {#if urlSync.hydrated && selected && budget}
        <SourcesFooter class="mt-7 border-t border-line pt-7" />
      {/if}
    </div>
  </div>
</main>
