<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import {
    analyzeComparison,
    DECISION_CRITERIA,
    type DecisionCriterion
  } from '$lib/compare/decision';
  import { analyzeSalaryEquivalence } from '$lib/compare/salaryEquivalence';
  import { briefSentence, criterionLabel, shortName } from '$lib/compare/brief';
  import { cityHref } from '$lib/compare/links';
  import { createCompareSalaries } from '$lib/compare/salaries.svelte';
  import { rentPlanPresentation as plan } from '$lib/rentPlanPresentation.svelte';
  import { createUrlSync } from '$lib/urlSync.svelte';
  import { computeBudget } from '$lib/budget';
  import { money } from '$lib/format';
  import type { CitySuggestion } from '$lib/types';
  import TopBar from '$lib/components/postcard/TopBar.svelte';
  import HousingToggle from '$lib/components/postcard/HousingToggle.svelte';
  import ShareMenu from '$lib/components/postcard/ShareMenu.svelte';
  import PlaceSearch from '$lib/components/postcard/PlaceSearch.svelte';
  import RackCard from '$lib/components/postcard/RackCard.svelte';
  import CostsSection from '$lib/components/postcard/CostsSection.svelte';
  import SiteFooter from '$lib/components/postcard/SiteFooter.svelte';

  const salaries = createCompareSalaries((name, salary) => plan.setComparisonSalary(name, salary));
  const urlSync = createUrlSync(plan);

  let hydrated = $state(false);
  let message = $state('');
  let criterion = $state<DecisionCriterion>('afterRent');
  let reference = $state<string | null>(null);
  let costsOpen = $state(false);

  let housing = $derived(plan.options.housing);
  let analysis = $derived(analyzeComparison(plan.comparisonEntries, plan.options));
  let equivalence = $derived(
    analyzeSalaryEquivalence(plan.comparisonEntries, reference, plan.options)
  );
  let count = $derived(analysis.entries.length);
  let brief = $derived(analysis.briefs[criterion]);
  let leaders = $derived(
    new Set(brief.status === 'decided' ? brief.leaders.map((entry) => entry.city.name) : [])
  );
  let hasCosts = $derived(
    plan.options.monthlyExpenses + plan.options.monthlySavings > 0 ||
      plan.comparisonEntries.some((entry) => (entry.monthlyExpenses ?? 0) > 0)
  );
  const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];

  let rows = $derived.by(() => {
    const max = Math.max(
      1,
      ...plan.comparisonEntries.map((entry) => computeBudget(entry.salary, entry.city).grossMonthly)
    );
    return analysis.entries.map((view, index) => {
      const input = plan.comparisonEntries[index];
      const budget = computeBudget(input.salary, input.city);
      const gross = budget.grossMonthly;
      const takeHome = view.metrics.takehome.number ?? budget.takeHomeMonthly;
      const rent = view.rent.amount;
      const costs =
        (input.monthlyExpenses ?? plan.options.monthlyExpenses) + plan.options.monthlySavings;
      const left = rent == null ? null : takeHome - rent - costs;
      const part = (value: number) => `${(Math.max(0, value) / gross) * 100}%`;
      return {
        name: view.city.name,
        width: `${(gross / max) * 100}%`,
        rent: rent == null ? null : part(rent),
        costs: costs > 0 ? part(costs) : null,
        left: left == null ? null : part(left),
        taxes: part(gross - takeHome),
        tick: view.rentBudget.amount == null ? null : part(view.rentBudget.amount),
        leftValue: left,
        label: `${shortName(view.city.name)}: ${money(gross)} gross a month, rent ${money(rent)}, ${
          costs > 0 ? `costs ${money(costs)}, ` : ''
        }${money(left)} left, taxes ${money(gross - takeHome)}`
      };
    });
  });

  let dots = $derived.by(() => {
    const values = equivalence.entries.flatMap((entry) =>
      [entry.committedSalary, entry.requiredSalary].filter(
        (value): value is number => value != null
      )
    );
    if (!values.length) return null;
    const step = 4_000;
    const low = Math.floor((Math.min(...values) * 0.96) / step) * step;
    const high = Math.ceil((Math.max(...values) * 1.04) / step) * step;
    const at = (value: number) => ((value - low) / (high - low || 1)) * 100;
    return {
      low,
      high,
      mid: (low + high) / 2,
      entries: equivalence.entries.map((entry) => ({
        ...entry,
        offerAt: at(entry.committedSalary),
        neededAt: entry.requiredSalary == null ? null : at(entry.requiredSalary)
      }))
    };
  });

  const plainLabel = (label: string) =>
    label
      .replaceAll('1BR', '1-bed')
      .replaceAll('2BR', '2-bed')
      .replace(/^Est\. /, 'Estimated ');
  let tableMetrics = $derived([...analysis.affordabilityMetrics, ...analysis.cityContextMetrics]);

  function hrefFor(name: string): string {
    const view = analysis.entries.find((entry) => entry.city.name === name);
    if (!view) return '/';
    return cityHref(
      { city: view.city },
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
    message =
      result.status === 'already-compared'
        ? `${result.name} is already here.`
        : result.status === 'full'
          ? 'Five cities is the limit. Remove one to add another.'
          : result.status === 'not-found'
            ? `Couldn't add ${result.name}.`
            : result.rentAvailable
              ? `${result.name} added.`
              : `${result.name} added. There's no rent estimate for it yet.`;
    salaries.sync(plan.comparisonEntries);
  }

  function remove(name: string) {
    plan.removeComparison(name);
    salaries.sync(plan.comparisonEntries);
    message = `${name} removed.`;
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
  <title>Compare offers side by side · Renttool</title>
  <meta
    name="description"
    content="Compare rent, take-home pay, and what's left over across cities, each with its own salary offer."
  />
</svelte:head>

<main id="main-content" tabindex="-1" data-hydrated={hydrated ? 'true' : 'false'}>
  <div class="pc-wrap">
    <TopBar>
      {#if plan.activeCity}
        <a class="pc-btn" href={plan.buildHref('/city')}>Back to {plan.activeCity.city}</a>
      {/if}
      {#snippet end()}
        <HousingToggle
          value={housing}
          onchange={(value) => plan.setOptions({ ...plan.options, housing: value })}
        />
        {#if count}<ShareMenu
            presentation={plan}
            pathname="/compare"
            label="Share comparison"
          />{/if}
      {/snippet}
    </TopBar>

    <section class="pc-cmp-hero" aria-labelledby="compare-heading">
      <h1 id="compare-heading" class="pc-cmp-title pc-display">
        {count >= 2 ? `${NUMBER_WORDS[count]} offers, side by side` : 'Compare offers'}
      </h1>
      <p class="pc-lede">
        Each city keeps its own salary. The stamp shows how much of that salary's rent ceiling a
        typical {housing === '1br'
          ? 'one-bedroom'
          : housing === '2br'
            ? 'two-bedroom'
            : 'shared two-bedroom'}
        uses.
      </p>
      {#if count >= 2}
        <div class="pc-cmp-brief" role="group" aria-label="Decision brief" id="decision-heading">
          <label
            ><span>Rank by</span><select bind:value={criterion}
              >{#each DECISION_CRITERIA as option (option.key)}<option value={option.key}
                  >{criterionLabel(option.key, housing)}</option
                >{/each}</select
            ></label
          >
          <p class="pc-display" data-testid="decision-brief" aria-live="polite">
            {briefSentence(analysis, criterion)}
          </p>
        </div>
      {/if}
    </section>

    {#if count}
      <section class="pc-cmp-rack" aria-label="Cities in this comparison" id="comparison-offers">
        {#each analysis.entries as view, index (view.city.name)}
          {@const city = plan.comparisonEntries[index]?.city}
          {#if city}
            <RackCard
              {city}
              entry={view}
              {salaries}
              {housing}
              {hasCosts}
              leadLabel={leaders.has(view.city.name) ? criterionLabel(criterion, housing) : null}
              href={hrefFor(view.city.name)}
              onremove={() => remove(view.city.name)}
              onexpenses={(value) => plan.setComparisonExpenses(view.city.name, value)}
              ontakehome={(value) => plan.setComparisonActualTakeHome(view.city.name, value)}
            />
          {/if}
        {/each}
      </section>
    {:else if hydrated}
      <p class="pc-lede">
        Nothing to compare yet. Add a city below, or open one and press Add to compare.
      </p>
    {/if}

    <div class="pc-cmp-add">
      {#if plan.comparisonFull}
        <p class="pc-lede">That's five cities, the most a comparison holds.</p>
      {:else}
        <PlaceSearch
          variant="add"
          id="compare-city-input"
          label={count ? 'Add a city' : 'Add your first city'}
          placeholder="City or city, state"
          {housing}
          onselect={(suggestion) => void addCity(suggestion)}
        />
      {/if}
      <p class={message ? 'pc-cmp-msg' : 'sr-only'} aria-live="polite">{message}</p>
    </div>

    <CostsSection
      id="compare"
      bind:open={costsOpen}
      options={plan.options}
      onoptions={(options) => plan.setOptions(options)}
    />

    {#if count >= 2}
      <section class="pc-section" aria-labelledby="money-heading">
        <h2 id="money-heading" class="pc-h2">Where the money goes</h2>
        <p class="pc-lede">
          Monthly gross pay, on one scale. The tick on each bar is that offer's rent ceiling.
        </p>
        <div class="pc-panel pc-cmp-money">
          <p class="pc-legend">
            <span><i class="pc-cmp-swatch" data-part="rent"></i>Rent</span>
            {#if hasCosts}<span><i class="pc-cmp-swatch" data-part="costs"></i>Your costs</span
              >{/if}
            <span><i class="pc-cmp-swatch" data-part="left"></i>Left over</span>
            <span><i class="pc-cmp-swatch" data-part="taxes"></i>Taxes</span>
          </p>
          {#each rows as row (row.name)}
            <div class="pc-cmp-row">
              <b>{shortName(row.name)}</b>
              <div class="pc-cmp-bar" style:width={row.width} role="img" aria-label={row.label}>
                {#if row.rent}<i data-part="rent" style:width={row.rent}></i>{/if}
                {#if row.costs}<i data-part="costs" style:width={row.costs}></i>{/if}
                {#if row.left}<i data-part="left" style:width={row.left}></i>{/if}
                <i data-part="taxes" style:width={row.taxes}></i>
                {#if row.tick}<u style:left={row.tick}></u>{/if}
              </div>
              <span class="pc-cmp-left pc-display">{money(row.leftValue)}</span>
            </div>
          {/each}
        </div>
      </section>

      <section class="pc-section" aria-labelledby="salary-equivalence-heading">
        <div class="pc-cmp-head">
          <div>
            <h2 id="salary-equivalence-heading" class="pc-h2">What each offer would need to be</h2>
            <p class="pc-lede">
              {#if equivalence.targetMonthly != null}
                The salary that would leave you the same {money(equivalence.targetMonthly)} a month after
                rent{equivalence.hasPersonalCosts ? ' and costs' : ''} as {shortName(
                  equivalence.referenceName ?? ''
                )} does.
              {:else}
                Pick a city with a rent estimate to match against.
              {/if}
            </p>
          </div>
          <label class="pc-cmp-select"
            ><span>Match</span><select
              value={equivalence.referenceName}
              onchange={(event) => (reference = event.currentTarget.value)}
              >{#each analysis.entries as view (view.city.name)}<option value={view.city.name}
                  >{shortName(view.city.name)}</option
                >{/each}</select
            ></label
          >
        </div>
        {#if dots}
          <div class="pc-panel pc-cmp-dots" data-testid="salary-equivalence">
            <div class="pc-cmp-scale" aria-hidden="true">
              <span style:left="0">{money(dots.low / 1000)}k</span>
              <span style:left="50%">{money(Math.round(dots.mid / 1000))}k</span>
              <span style:left="100%">{money(dots.high / 1000)}k</span>
            </div>
            {#each dots.entries as entry (entry.city.name)}
              <div class="pc-cmp-row">
                <b>{shortName(entry.city.name)}</b>
                <div class="pc-cmp-track" aria-hidden="true">
                  {#if entry.isReference}
                    <i class="pc-dot" data-kind="reference" style:left={`${entry.offerAt}%`}></i>
                  {:else if entry.neededAt != null}
                    <i
                      class="pc-cmp-span"
                      style:left={`${Math.min(entry.offerAt, entry.neededAt)}%`}
                      style:width={`${Math.abs(entry.neededAt - entry.offerAt)}%`}
                    ></i>
                    <i class="pc-dot" data-kind="offer" style:left={`${entry.offerAt}%`}></i>
                    <i class="pc-dot" data-kind="needed" style:left={`${entry.neededAt}%`}></i>
                  {:else}
                    <i class="pc-dot" data-kind="offer" style:left={`${entry.offerAt}%`}></i>
                  {/if}
                </div>
                <span class="pc-cmp-need">
                  {#if entry.isReference}
                    Reference, {entry.committedSalaryValue}
                  {:else if entry.requiredSalary != null}
                    <b>{entry.requiredSalaryValue}</b> needed, {entry.requiredSalary >
                    entry.committedSalary
                      ? `${money(entry.requiredSalary - entry.committedSalary)} more`
                      : entry.requiredSalary === entry.committedSalary
                        ? 'same as the offer'
                        : `offer is ${money(entry.committedSalary - entry.requiredSalary)} above`}
                  {:else}
                    {entry.unavailableReason}
                  {/if}
                </span>
              </div>
            {/each}
            <p class="pc-legend pc-cmp-dots-key">
              <span><i class="pc-dot-key" data-kind="offer"></i>Current offer</span>
              <span><i class="pc-dot-key" data-kind="needed"></i>Salary needed</span>
            </p>
          </div>
        {/if}
      </section>

      <section class="pc-section" aria-labelledby="comparison-breakdown">
        <h2 id="comparison-breakdown" class="pc-h2">Everything, line by line</h2>
        <p class="pc-lede">The best value in each row is marked.</p>
        {#if analysis.qualification}<p class="pc-lede">{analysis.qualification}</p>{/if}
        <!-- Scrollable on phones, so keyboard users need to reach it. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="pc-panel pc-cmp-table"
          role="region"
          aria-label="Everything, line by line"
          tabindex="0"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Per month unless noted</th>
                {#each analysis.entries as view (view.city.name)}<th scope="col"
                    >{shortName(view.city.name)}</th
                  >{/each}
              </tr>
            </thead>
            <tbody>
              {#each tableMetrics as metric (metric.key)}
                <tr>
                  <th scope="row">{plainLabel(metric.label)}</th>
                  {#each analysis.entries as view (view.city.name)}
                    {@const cell = view.metrics[metric.key]}
                    <td
                      >{#if cell.tone === 'best' && count > 1}<span class="pc-best"
                          >{cell.value.replace('/mo', '')}</span
                        ><span class="sr-only"> ({cell.toneLabel})</span>{:else}{cell.value.replace(
                          '/mo',
                          ''
                        )}{/if}</td
                    >
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}

    <SiteFooter />
  </div>
</main>

<style>
  main {
    min-height: 100vh;
    outline: none;
  }
  .pc-cmp-hero {
    padding-top: 1.5rem;
  }
  .pc-cmp-title {
    margin: 0;
    font-size: 4.75rem;
    font-weight: 800;
    line-height: 0.92;
  }
  .pc-cmp-brief {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem 1.75rem;
    margin-top: 1.75rem;
    padding: 1.375rem 1.75rem;
    border-radius: 8px;
    background: var(--navy);
    color: #fff;
  }
  .pc-cmp-brief label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9375rem;
  }
  .pc-cmp-brief select {
    height: 2.75rem;
    padding: 0 0.875rem;
    border: 0;
    border-radius: 999px;
    background: var(--pink);
    color: var(--navy);
    font-weight: 600;
  }
  .pc-cmp-brief select:focus-visible {
    outline-color: #fff;
  }
  .pc-cmp-brief p {
    min-width: 17.5rem;
    flex: 1;
    margin: 0;
    font-size: 1.625rem;
    font-weight: 700;
    line-height: 1.2;
  }
  .pc-cmp-rack {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 1.25rem;
    margin-top: 1.5rem;
  }
  .pc-cmp-add {
    margin-top: 1rem;
  }
  .pc-cmp-msg {
    margin: 0.75rem 0 0;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .pc-cmp-money,
  .pc-cmp-dots {
    padding: 1.75rem;
  }
  .pc-cmp-money > .pc-legend {
    margin-bottom: 0.5rem;
  }
  .pc-cmp-swatch {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }
  [data-part='rent'] {
    background: var(--navy);
  }
  [data-part='costs'] {
    background: var(--slate);
  }
  [data-part='left'] {
    background: var(--sage);
  }
  [data-part='taxes'] {
    background: #c5cdd5;
  }
  .pc-cmp-row {
    display: grid;
    grid-template-columns: 9.5rem minmax(0, 1fr) 13rem;
    gap: 1.25rem;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--line);
  }
  .pc-cmp-row:last-of-type {
    border-bottom: 0;
  }
  .pc-cmp-bar {
    position: relative;
    display: flex;
    height: 2.125rem;
  }
  .pc-cmp-bar i:first-child {
    border-radius: 17px 0 0 17px;
  }
  .pc-cmp-bar i:last-of-type {
    border-radius: 0 17px 17px 0;
  }
  .pc-cmp-bar u {
    position: absolute;
    top: -7px;
    bottom: -7px;
    width: 4px;
    margin-left: -2px;
    border-radius: 2px;
    background: var(--navy);
    box-shadow: 0 0 0 2px #fff;
  }
  .pc-cmp-left {
    font-size: 1.375rem;
    font-weight: 700;
    text-align: right;
  }
  .pc-cmp-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }
  .pc-cmp-select {
    display: inline-flex;
    height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.875rem 0 1rem;
    border: 1.5px solid var(--navy);
    border-radius: 999px;
    background: #fff;
    font-size: 0.9375rem;
  }
  .pc-cmp-select:focus-within {
    outline: 2px solid var(--navy);
    outline-offset: 2px;
  }
  .pc-cmp-select span {
    color: var(--muted);
  }
  .pc-cmp-select select {
    border: 0;
    background: transparent;
    color: var(--navy);
    font-weight: 600;
    outline: none;
  }
  .pc-cmp-scale {
    position: relative;
    height: 1.5rem;
    margin: 0 14.25rem 0 10.75rem;
    color: var(--muted);
    font-size: 0.75rem;
  }
  .pc-cmp-scale span {
    position: absolute;
    transform: translateX(-50%);
  }
  .pc-cmp-track {
    position: relative;
    height: 1.75rem;
    margin: 0 9px;
  }
  .pc-cmp-span {
    position: absolute;
    top: 12px;
    height: 4px;
    background: var(--slate);
  }
  .pc-dot {
    position: absolute;
    top: 5px;
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    margin-left: -9px;
    border: 3px solid var(--navy);
    border-radius: 50%;
    background: #fff;
  }
  .pc-dot[data-kind='needed'] {
    background: var(--pink);
  }
  .pc-dot[data-kind='reference'] {
    background: var(--navy);
  }
  .pc-dot-key {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 3px solid var(--navy);
    border-radius: 50%;
    background: #fff;
  }
  .pc-dot-key[data-kind='needed'] {
    background: var(--pink);
  }
  .pc-cmp-need {
    font-size: 0.9375rem;
    text-align: right;
  }
  .pc-cmp-dots-key {
    margin-top: 1rem;
  }
  .pc-cmp-table {
    position: relative;
    padding: 0.5rem 0.75rem;
    overflow-x: auto;
  }
  table {
    width: 100%;
    min-width: 46rem;
    border-collapse: collapse;
    font-size: 0.9375rem;
  }
  th,
  td {
    padding: 0.8125rem 1rem;
    border-bottom: 1px solid var(--line);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  thead th {
    border-bottom: 1.5px solid var(--navy);
    font-weight: 700;
  }
  thead th:first-child {
    color: var(--muted);
    font-size: 0.8125rem;
    font-weight: 500;
  }
  tbody th {
    color: var(--muted);
    font-weight: 400;
    text-align: left;
  }
  thead th:first-child {
    text-align: left;
  }
  tbody tr:last-child > * {
    border-bottom: 0;
  }
  .pc-best {
    background: linear-gradient(transparent 62%, var(--pink) 62%);
    font-weight: 700;
  }
  @media (max-width: 1100px) {
    .pc-cmp-row {
      grid-template-columns: 7rem minmax(0, 1fr);
    }
    .pc-cmp-row > :last-child {
      grid-column: 1 / -1;
      text-align: left;
    }
    .pc-cmp-scale {
      margin: 0 0 0 8.25rem;
    }
  }
  @media (max-width: 600px) {
    .pc-cmp-title {
      font-size: 3rem;
    }
    .pc-cmp-brief {
      padding: 1.125rem;
    }
    .pc-cmp-brief p {
      min-width: 0;
      font-size: 1.25rem;
    }
    .pc-cmp-money,
    .pc-cmp-dots {
      padding: 1rem;
    }
  }
</style>
