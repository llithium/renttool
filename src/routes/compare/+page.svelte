<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { analyzeComparison } from '$lib/compare/decision';
  import { cityHref } from '$lib/compare/links';
  import type { ComparisonCity } from '$lib/compare/decision';
  import { createCompareSalaries } from '$lib/compare/salaries.svelte';
  import { rentPlanPresentation as plan } from '$lib/rentPlanPresentation.svelte';
  import { createUrlSync } from '$lib/urlSync.svelte';
  import type { CitySuggestion } from '$lib/types';
  import AppHeader from '$lib/components/ui/AppHeader.svelte';
  import CitySearch from '$lib/components/ui/CitySearch.svelte';
  import ScenarioCard from '$lib/components/compare/ScenarioCard.svelte';
  import CompareHighlights from '$lib/components/compare/CompareHighlights.svelte';
  import CompareMetricsTable from '$lib/components/compare/CompareMetricsTable.svelte';

  const salaries = createCompareSalaries((name, salary) => plan.setComparisonSalary(name, salary));
  const urlSync = createUrlSync(plan);

  let hydrated = $state(false);
  let cityMessage = $state('');

  let cityViewHref = $derived.by(() => {
    return plan.buildHref('/');
  });

  let analysis = $derived.by(() => analyzeComparison(plan.comparisonEntries));

  let atCapacity = $derived(plan.comparisonFull);

  function hrefForCity(city: ComparisonCity): string {
    return cityHref({ city }, { salary: plan.salary, comparisons: plan.comparisonEntries });
  }

  async function addCity(suggestion: CitySuggestion) {
    const result = await plan.addComparison(suggestion);
    if (result.status === 'already-compared') {
      cityMessage = `${result.name} is already in this comparison.`;
      return;
    }
    if (result.status === 'full') {
      cityMessage = 'Your comparison already has five cities. Remove one to add another.';
      return;
    }
    if (result.status === 'not-found') {
      cityMessage = `Could not add ${result.name} to the comparison.`;
      return;
    }
    salaries.sync(plan.comparisonEntries);
    cityMessage = result.rentAvailable
      ? `${result.name} added to the comparison.`
      : `${result.name} added; rent data is unavailable.`;
  }

  function clearComparison() {
    plan.clearComparison();
    salaries.sync(plan.comparisonEntries);
    cityMessage = 'Comparison cleared. Add a city to begin a new plan.';
  }

  onMount(() => {
    const teardown = urlSync.start(page.url.searchParams, () =>
      salaries.sync(plan.comparisonEntries)
    );
    if (!plan.comparisonCities.length && plan.activeCity)
      void plan.addComparison(plan.activeCity.name);
    salaries.sync(plan.comparisonEntries);
    hydrated = true;
    return teardown;
  });
</script>

<svelte:head>
  <title>Compare cities and salaries · Rent Tool</title>
  <meta
    name="description"
    content="Compare rent, take-home pay, taxes, and affordability across U.S. cities using a different salary for every city."
  />
</svelte:head>

<main
  id="main-content"
  data-hydrated={hydrated ? 'true' : 'false'}
  class="mx-auto w-full max-w-384 overflow-x-hidden px-4 pt-4 pb-20 md:px-6 md:pt-6 md:pb-24"
>
  <AppHeader brandHref={cityViewHref} actionHref={cityViewHref} actionLabel="City view" />

  <section
    class="mt-6 grid gap-6 border-b border-line-strong pb-6 md:pb-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:gap-12"
  >
    <div>
      <h1
        class="max-w-5xl text-[clamp(3rem,6vw,6.5rem)] leading-[0.9] font-semibold tracking-[-0.06em] text-ink"
      >
        Compare offers.
      </h1>
      <p class="mt-5 max-w-2xl text-body text-muted lg:ml-[18%]">
        Compare what each city leaves after a typical one-bedroom rent, then inspect the trade-offs
        that matter to you.
      </p>
    </div>
    <div class="w-full lg:justify-self-end">
      {#if atCapacity}
        <div class="rounded-xl border border-line-strong bg-card-2 px-4 py-3">
          <p class="text-label text-ink">Five cities are ready to compare.</p>
          <p class="mt-1 text-meta text-muted">Remove one below to make room for another city.</p>
        </div>
      {:else}
        <CitySearch onselect={addCity} />
      {/if}
      <p aria-live="polite" class="mt-2 min-h-5 text-meta text-muted">
        {cityMessage || `${plan.comparisonNames.length} of 5 cities added`}
      </p>
    </div>
  </section>

  {#if analysis.entries.length}
    <div class="mt-5 flex justify-end">
      <button
        type="button"
        onclick={clearComparison}
        class="cursor-pointer text-sm font-semibold text-accent underline-offset-4 hover:text-accent-deep hover:underline"
      >
        Clear comparison
      </button>
    </div>

    <section
      class="mt-10 grid grid-flow-dense grid-cols-1 border-t border-l border-line-strong md:grid-cols-2 xl:grid-cols-3"
      aria-label="Comparison entries"
    >
      {#each analysis.entries as entry, index (entry.city.name)}
        <ScenarioCard
          {entry}
          href={hrefForCity(entry.city)}
          {salaries}
          entranceDelay={Math.min(index * 60, 180)}
          onremove={() => {
            plan.removeComparison(entry.city.name);
            salaries.sync(plan.comparisonEntries);
          }}
        />
      {/each}
    </section>

    {#if analysis.entries.length > 1}
      <CompareHighlights {analysis} {hrefForCity} />
    {/if}

    <section class="mt-8 border-t border-line pt-6">
      <div class="mb-5 flex items-end justify-between gap-5 max-md:flex-col max-md:items-start">
        <h2 class="text-title">Full breakdown</h2>
        <p class="max-w-85 text-right text-meta text-muted max-md:text-left">
          Taxes estimate a single filer taking the standard deduction.
        </p>
      </div>
      <CompareMetricsTable {analysis} {hrefForCity} />
    </section>
  {:else if hydrated}
    <section class="mt-12 border-b border-line py-16 md:py-20" aria-labelledby="empty-heading">
      <div class="max-w-2xl">
        <h2 id="empty-heading" class="text-headline">Compare two places before you choose</h2>
        <p class="mt-3 text-body text-muted">
          Start with the city tied to your offer or current home. Add another place to see which one
          gives your plan more room after rent.
        </p>
        <ul class="mt-6 space-y-2 text-sm/relaxed text-muted">
          <li>Pick the city you are considering.</li>
          <li>Add the place you want to weigh against it.</li>
          <li>Use the decision brief to choose the trade-off that matters most.</li>
        </ul>
      </div>
    </section>
  {/if}

  <footer class="mt-12 border-t border-line pt-6 text-meta text-muted">
    Figures are estimates for planning, not tax or financial advice. Rent sources and methodology
    are shown for each city.
  </footer>
</main>
