<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { analyzeComparison } from '$lib/compare/decision';
  import { analyzeSalaryEquivalence } from '$lib/compare/salaryEquivalence';
  import { cityHref } from '$lib/compare/links';
  import type { ComparisonCity } from '$lib/compare/comparisonModel';
  import { createCompareSalaries } from '$lib/compare/salaries.svelte';
  import { rentPlanPresentation as plan } from '$lib/rentPlanPresentation.svelte';
  import { createUrlSync } from '$lib/urlSync.svelte';
  import type { CitySuggestion } from '$lib/types';
  import AppHeader from '$lib/components/ui/AppHeader.svelte';
  import CitySearch from '$lib/components/ui/CitySearch.svelte';
  import ScenarioCard from '$lib/components/compare/ScenarioCard.svelte';
  import CompareHighlights from '$lib/components/compare/CompareHighlights.svelte';
  import SalaryEquivalence from '$lib/components/compare/SalaryEquivalence.svelte';
  import CompareMetricsTable from '$lib/components/compare/CompareMetricsTable.svelte';
  import SharePlan from '$lib/components/ui/SharePlan.svelte';
  import HousingSelector from '$lib/components/ui/HousingSelector.svelte';
  import PersonalCosts from '$lib/components/ui/PersonalCosts.svelte';

  const salaries = createCompareSalaries((name, salary) => plan.setComparisonSalary(name, salary));
  const urlSync = createUrlSync(plan);

  let hydrated = $state(false);
  let cityMessage = $state('');

  let cityViewHref = $derived.by(() => {
    return plan.buildHref('/');
  });

  let analysis = $derived.by(() => analyzeComparison(plan.comparisonEntries, plan.options));
  let equivalenceReference = $state<string | null>(null);
  let salaryEquivalence = $derived.by(() =>
    analyzeSalaryEquivalence(plan.comparisonEntries, equivalenceReference, plan.options)
  );

  let atCapacity = $derived(plan.comparisonFull);

  function hrefForCity(city: ComparisonCity): string {
    return cityHref(
      { city },
      {
        salary: plan.salary,
        comparisons: plan.comparisonEntries,
        options: plan.options,
        selectedName: plan.selectedName,
        actualTakeHomeMonthly: plan.actualTakeHomeMonthly
      }
    );
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
  class="mx-auto w-full max-w-7xl px-4 pt-4 pb-20 md:px-6 md:pt-6 md:pb-24"
>
  <AppHeader
    planHref={cityViewHref}
    compareHref={plan.buildHref('/compare')}
    activeView="compare"
    comparisonCount={plan.comparisonNames.length}
  />

  <div class="mt-6 flex min-w-0 flex-col">
    <section>
      <h1 class="mt-3 max-w-4xl text-display text-ink">Compare cities and salaries</h1>
    </section>

    <aside class="mt-8 min-w-0 border-y border-line py-6 md:py-7">
      <section
        class="grid gap-6 md:gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,0.65fr)]"
      >
        <div>
          <p class="text-title text-ink">Your comparison</p>
          <p class="mt-2 text-sm/relaxed text-muted">
            Add up to five cities. Set a different salary for each offer in the results.
          </p>
        </div>
        <div class="lg:border-l lg:border-line lg:pl-8">
          {#if atCapacity}
            <div class="border-l-2 border-accent pl-4">
              <p class="text-label text-ink">Five cities are ready.</p>
              <p class="mt-1 text-meta text-muted">Remove one from the results to add another.</p>
            </div>
          {:else}
            <CitySearch onselect={addCity} housing={plan.options.housing} />
          {/if}
        </div>
        <div class="lg:border-l lg:border-line lg:pl-8">
          <p aria-live="polite" class="min-h-5 text-meta text-muted">
            {cityMessage || `${plan.comparisonNames.length} of 5 cities added`}
          </p>
          <SharePlan presentation={plan} pathname="/compare" />
          {#if analysis.entries.length}
            <button
              type="button"
              onclick={clearComparison}
              class="mt-5 cursor-pointer text-sm font-semibold text-accent underline-offset-4 hover:text-accent-deep hover:underline"
            >
              Clear comparison
            </button>
          {/if}
        </div>
      </section>
      <div class="mt-6 max-w-2xl border-t border-line pt-5">
        <div class="max-w-sm">
          <HousingSelector
            value={plan.options.housing}
            onchange={(housing) => plan.setOptions({ ...plan.options, housing })}
            id="compare-housing"
          />
        </div>
        <PersonalCosts
          options={plan.options}
          onoptions={(options) => plan.setOptions(options)}
          id="compare"
        />
      </div>
    </aside>

    <div class="flex min-w-0 flex-col">
      {#if analysis.entries.length}
        {#if analysis.entries.length > 1}
          <CompareHighlights {analysis} {hrefForCity} />
          <SalaryEquivalence
            analysis={salaryEquivalence}
            onreferencechange={(name) => (equivalenceReference = name)}
          />
        {/if}

        <section
          class="mt-7 grid grid-flow-dense grid-cols-1 gap-5 md:grid-cols-2"
          aria-label="Comparison entries"
        >
          {#each analysis.entries as entry (entry.city.name)}
            <ScenarioCard
              {entry}
              href={hrefForCity(entry.city)}
              {salaries}
              housing={plan.options.housing}
              defaultExpenses={plan.options.monthlyExpenses}
              onexpenses={(value) => plan.setComparisonExpenses(entry.city.name, value)}
              ontakehome={(value) => plan.setComparisonActualTakeHome(entry.city.name, value)}
              onremove={() => {
                plan.removeComparison(entry.city.name);
                salaries.sync(plan.comparisonEntries);
              }}
            />
          {/each}
        </section>

        {#if analysis.entries.length === 1}
          <p class="mt-5 border-t border-line pt-4 text-sm text-muted">
            Add a second city above to compare spending room and equivalent salaries.
          </p>
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
        <section class="border-b border-line py-16 md:py-20" aria-labelledby="empty-heading">
          <div class="max-w-2xl">
            <h2 id="empty-heading" class="text-headline">Compare two places before you choose</h2>
            <p class="mt-3 text-body text-muted">
              Start with the city tied to your offer or current home. Add another place to see which
              one gives your plan more room after rent.
            </p>
          </div>
        </section>
      {/if}

      <footer class="mt-12 border-t border-line pt-6 text-meta text-muted">
        Figures are estimates for planning, not tax or financial advice. Rent sources and
        methodology are shown for each city.
      </footer>
    </div>
  </div>
</main>
