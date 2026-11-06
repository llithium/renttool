<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { page } from '$app/state';
  import { analyzeComparison } from '$lib/compare/decision';
  import { analyzeSalaryEquivalence } from '$lib/compare/salaryEquivalence';
  import { cityHref } from '$lib/compare/links';
  import type { ComparisonCity } from '$lib/compare/comparisonModel';
  import { createCompareSalaries } from '$lib/compare/salaries.svelte';
  import { rentPlanPresentation as plan } from '$lib/rentPlanPresentation.svelte';
  import { createUrlSync } from '$lib/urlSync.svelte';
  import type { CitySuggestion } from '$lib/types';
  import CommuteFilter from '$lib/components/city/CommuteFilter.svelte';
  import type { CommuteFilterResult } from '$lib/commute';
  import AppHeader from '$lib/components/ui/AppHeader.svelte';
  import CitySearch from '$lib/components/ui/CitySearch.svelte';
  import ScenarioCard from '$lib/components/compare/ScenarioCard.svelte';
  import CompareHighlights from '$lib/components/compare/CompareHighlights.svelte';
  import ComparisonSummary from '$lib/components/compare/ComparisonSummary.svelte';
  import SalaryEquivalence from '$lib/components/compare/SalaryEquivalence.svelte';
  import CompareMetricsTable from '$lib/components/compare/CompareMetricsTable.svelte';
  import SharePlan from '$lib/components/ui/SharePlan.svelte';
  import HousingSelector from '$lib/components/ui/HousingSelector.svelte';
  import PersonalCosts from '$lib/components/ui/PersonalCosts.svelte';
  import PlanAssumptions from '$lib/components/ui/PlanAssumptions.svelte';

  const salaries = createCompareSalaries((name, salary) => plan.setComparisonSalary(name, salary));
  const urlSync = createUrlSync(plan);

  let hydrated = $state(false);
  let cityMessage = $state('');
  let commutes = $state<Record<string, CommuteFilterResult | null>>({});
  let commuteLoading = $state<Record<string, boolean>>({});
  let commuteOpen = $state(false);
  let breakdownOpen = $state(false);
  let costsOpen = $state(false);
  let activeSection = $state('#decision-heading');
  $effect(() => {
    if (plan.comparisonCities.some((city) => plan.commuteForCity(city.name).destination))
      commuteOpen = true;
  });
  // Rent or salary updates must not re-request unchanged routes.
  let commuteOriginKey = $derived(
    JSON.stringify(
      plan.comparisonCities.map((city) => ({
        label: city.name,
        name: city.name,
        source: city.source,
        city: city.city,
        state: city.state,
        lat: city.lat,
        lng: city.lng
      }))
    )
  );
  let commuteOrigins: (CitySuggestion & ComparisonCity)[] = $derived(JSON.parse(commuteOriginKey));

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
    function revealLinkedSection() {
      activeSection = window.location.hash || '#decision-heading';
      if (window.location.hash === '#comparison-breakdown') breakdownOpen = true;
    }
    revealLinkedSection();
    window.addEventListener('hashchange', revealLinkedSection);
    return () => {
      teardown();
      window.removeEventListener('hashchange', revealLinkedSection);
    };
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
  tabindex="-1"
  data-hydrated={hydrated ? 'true' : 'false'}
  class="mx-auto w-full max-w-[120rem] px-4 pt-4 pb-12 md:px-6 md:pt-6 md:pb-16"
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
      <PlanAssumptions
        options={plan.options}
        defaults
        onedit={async () => {
          costsOpen = true;
          await tick();
          document.getElementById('compare-expenses')?.focus();
        }}
      />
    </section>

    {#if analysis.entries.length > 1}
      <nav
        aria-label="Comparison sections"
        data-section-nav="comparison"
        class="sticky top-0 z-30 mt-3 flex flex-wrap gap-1 border-b border-line bg-canvas/95 py-1 [&>a]:shrink-0"
      >
        <a
          href="#decision-heading"
          aria-current={activeSection === '#decision-heading' ? 'location' : undefined}
          class="inline-flex min-h-11 items-center px-1 text-label text-accent underline underline-offset-4 hover:bg-card-2 hover:text-ink"
          >Decision</a
        >
        <a
          href="#comparison-offers"
          aria-current={activeSection === '#comparison-offers' ? 'location' : undefined}
          class="inline-flex min-h-11 items-center px-1 text-label text-accent underline underline-offset-4 hover:bg-card-2 hover:text-ink"
          >Salaries</a
        >
        <a
          href="#salary-equivalence-heading"
          aria-current={activeSection === '#salary-equivalence-heading' ? 'location' : undefined}
          class="inline-flex min-h-11 items-center px-1 text-label text-accent underline underline-offset-4 hover:bg-card-2 hover:text-ink"
          >Equivalent pay</a
        >
        <a
          href="#comparison-breakdown"
          aria-current={activeSection === '#comparison-breakdown' ? 'location' : undefined}
          onclick={() => (breakdownOpen = true)}
          class="inline-flex min-h-11 items-center px-1 text-label text-accent underline underline-offset-4 hover:bg-card-2 hover:text-ink"
          >Breakdown</a
        >
      </nav>
    {/if}

    {#if analysis.entries.length > 1}
      <CompareHighlights {analysis} {hrefForCity} />
    {/if}

    {#if analysis.entries.length}
      <ComparisonSummary
        {analysis}
        {hrefForCity}
        {salaries}
        onremove={(name) => {
          plan.removeComparison(name);
          salaries.sync(plan.comparisonEntries);
        }}
      >
        {#snippet editor(entry)}
          <ScenarioCard
            {entry}
            commute={commutes[entry.city.name] ?? null}
            commuteLoading={commuteLoading[entry.city.name] ?? false}
            commuteDestination={plan.commuteForCity(entry.city.name).destination?.label}
            commuteMaximum={plan.commuteForCity(entry.city.name).maximum}
            href={hrefForCity(entry.city)}
            housing={plan.options.housing}
            defaultExpenses={plan.options.monthlyExpenses}
            onexpenses={(value) => plan.setComparisonExpenses(entry.city.name, value)}
            ontakehome={(value) => plan.setComparisonActualTakeHome(entry.city.name, value)}
          />
        {/snippet}
      </ComparisonSummary>
    {/if}

    <aside data-comparison-controls aria-label="Comparison controls">
      <div
        class="grid grid-cols-1 items-start gap-4 min-[360px]:grid-cols-2 md:grid-cols-[1fr_0.7fr_auto]"
      >
        <div class="min-[360px]:col-span-2 md:col-span-1">
          {#if atCapacity}
            <p class="text-label text-ink">Five cities added</p>
            <p class="mt-2 text-sm text-muted">Remove a city to add another.</p>
          {:else}
            <CitySearch onselect={addCity} housing={plan.options.housing} />
          {/if}
          <p aria-live="polite" class="mt-2 text-meta text-muted">
            {cityMessage || plan.comparisonNames.length + ' of 5 cities added'}
          </p>
        </div>
        <HousingSelector
          value={plan.options.housing}
          onchange={(housing) => plan.setOptions({ ...plan.options, housing })}
          id="compare-housing"
        />
        <div class="flex flex-wrap items-start gap-2 min-[360px]:pt-4">
          <SharePlan presentation={plan} pathname="/compare" />
          {#if analysis.entries.length}
            <button
              type="button"
              aria-label="Clear comparison"
              onclick={clearComparison}
              class="min-h-11 cursor-pointer text-sm font-semibold text-muted underline-offset-4 hover:text-red hover:underline"
              >Clear</button
            >
          {/if}
        </div>
      </div>
      <PersonalCosts
        bind:open={costsOpen}
        options={plan.options}
        onoptions={(options) => plan.setOptions(options)}
        id="compare"
      />
    </aside>

    <div class="flex min-w-0 flex-col">
      {#if analysis.entries.length}
        {#if analysis.entries.length > 1}
          <SalaryEquivalence
            analysis={salaryEquivalence}
            onreferencechange={(name) => (equivalenceReference = name)}
          />
        {/if}

        {#if analysis.entries.length === 1}
          <p class="mt-5 border-t border-line pt-4 text-sm text-muted">
            Add a second city above to compare spending room and equivalent salaries.
          </p>
        {/if}

        <section aria-label="Commute times" class="mt-6 border-y border-line py-1">
          <details bind:open={commuteOpen}>
            <summary class="min-h-11 cursor-pointer py-3 text-sm font-semibold"
              >Check commute times</summary
            >
            <div
              class="grid gap-x-8 {commuteOrigins.length > 1
                ? 'md:grid-cols-2'
                : ''} {commuteOrigins.length > 2 ? 'xl:grid-cols-3' : ''}"
            >
              {#each commuteOrigins as city (city.label)}
                <section
                  aria-label={`Commute for ${city.label}`}
                  class="min-w-0 border-t border-line py-4"
                >
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <h2 class="text-title">{city.label}</h2>
                    <a
                      href={`${hrefForCity(city)}#rent-map`}
                      class="shrink-0 text-sm font-semibold text-accent underline underline-offset-4"
                      >View map</a
                    >
                  </div>
                  <CommuteFilter
                    presentation={plan}
                    cityName={city.label}
                    places={[city]}
                    mode="comparison"
                    onloading={(loading) => (commuteLoading[city.label] = loading)}
                    onfilter={(result) => (commutes[city.label] = result)}
                  />
                </section>
              {/each}
            </div>
          </details>
        </section>

        <details
          id="comparison-breakdown"
          bind:open={breakdownOpen}
          class="mt-6 scroll-mt-24 border-y border-line"
        >
          <summary class="min-h-11 cursor-pointer py-4 text-title">Full breakdown</summary>
          <p class="mb-5 text-meta text-muted">
            Taxes estimate a single filer taking the standard deduction.
          </p>
          <CompareMetricsTable
            {analysis}
            {hrefForCity}
            {commutes}
            {commuteLoading}
            commuteSettings={Object.fromEntries(
              plan.comparisonCities.map((city) => [city.name, plan.commuteForCity(city.name)])
            )}
          />
        </details>
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

      <footer class="mt-8 border-t border-line pt-5 text-meta text-muted">
        Figures are estimates for planning, not tax or financial advice. Rent sources and
        methodology are shown for each city.
      </footer>
    </div>
  </div>
</main>

<style>
  [data-comparison-controls] {
    margin-top: 1.5rem;
    padding: 1.25rem 0 0.25rem;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
</style>
