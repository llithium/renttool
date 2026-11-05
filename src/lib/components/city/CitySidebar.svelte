<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { SalaryField } from '$lib/salaryField.svelte';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import CitySearch from '$lib/components/ui/CitySearch.svelte';
  import CityHeadline from './CityHeadline.svelte';
  import CityImage from './CityImage.svelte';
  import SalaryInput from '$lib/components/ui/SalaryInput.svelte';
  import SalarySlider from './SalarySlider.svelte';
  import CityActions from './CityActions.svelte';
  import BudgetCard from './BudgetCard.svelte';
  import RentTrendChart from './RentTrendChart.svelte';
  import { money } from '$lib/format';
  import { housingShortLabel } from '$lib/planning';
  import HousingSelector from '$lib/components/ui/HousingSelector.svelte';
  import PersonalCosts from '$lib/components/ui/PersonalCosts.svelte';
  import PlanAssumptions from '$lib/components/ui/PlanAssumptions.svelte';

  let {
    presentation,
    salary,
    onsalary
  }: {
    presentation: RentPlanPresentation;
    salary: SalaryField;
    onsalary: (value: number) => void;
  } = $props();
  let activeCity = $derived(presentation.activeCity);
  let budget = $derived(presentation.budget);
  let costsOpen = $state(false);
  // A saved plan opens with its answer. A new plan keeps the editor in place
  // as results appear, so typing and an in-progress salary drag never jump.
  const answerFirst = untrack(() => presentation.activeCity != null && presentation.budget != null);

  let editorOpen = $state(true);
  onMount(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const resize = () => {
      editorOpen = desktop.matches || !answerFirst || !activeCity;
    };
    resize();
    desktop.addEventListener('change', resize);
    return () => desktop.removeEventListener('change', resize);
  });
  $effect(() => {
    if (!activeCity) editorOpen = true;
  });

  async function editCosts() {
    editorOpen = true;
    costsOpen = true;
    await tick();
    document.getElementById('plan-expenses')?.focus();
  }
</script>

<aside data-testid="sidebar" class="@container min-w-0">
  {#if activeCity}
    <div class="mb-4">
      <CityHeadline city={activeCity} onedit={() => (editorOpen = true)} />
      <p class="mt-1 text-sm text-muted">
        {presentation.salary != null ? money(presentation.salary) + '/yr' : 'Salary not entered'} · {housingShortLabel(
          presentation.options.housing
        )} plan
      </p>
      <PlanAssumptions
        options={presentation.options}
        actualTakeHomeMonthly={presentation.actualTakeHomeMonthly}
        onedit={editCosts}
      />
    </div>
  {/if}
  <!-- The same inputs stay mounted while the city, salary, and results change. -->
  <section
    class="grid scroll-mt-28 items-start gap-5 lg:gap-6 {activeCity
      ? 'lg:grid-cols-[minmax(19rem,0.85fr)_minmax(0,1.65fr)]'
      : ''}"
  >
    {#if activeCity}
      <div
        class="min-w-0 {answerFirst
          ? 'lg:col-start-2 lg:row-start-1'
          : 'order-1 lg:col-start-2 lg:row-start-1'}"
      >
        <BudgetCard {presentation} oneditcosts={editCosts} />
        {#if budget}
          <details class="mt-3 border-t border-line">
            <summary class="min-h-11 cursor-pointer py-3 text-sm font-semibold text-muted"
              >Compare 1BR and 2BR rents</summary
            >
            <div class="max-w-2xl pb-3">
              <RentTrendChart
                city={activeCity}
                {budget}
                housing={presentation.options.housing}
                target={presentation.rentTarget ?? budget.maxRent}
              />
              <p class="mt-4 text-meta text-muted">
                {activeCity.rentArea} · {activeCity.rentYear}. Citywide market context, not a lease
                quote.
              </p>
            </div>
          </details>
        {/if}
      </div>
    {/if}
    <div
      id="plan-controls"
      tabindex="-1"
      class="@container scroll-mt-28 rounded-2xl border border-line bg-card p-5 shadow-card md:p-6 lg:col-start-1 lg:row-start-1"
      data-active={Boolean(activeCity)}
      data-collapsed={!editorOpen && Boolean(activeCity)}
    >
      <details data-plan-editor bind:open={editorOpen}>
        <summary
          data-testid="plan-editor-toggle"
          class="min-h-11 cursor-pointer py-2 text-title lg:hidden"
          >Edit salary &amp; housing</summary
        >
        <div data-plan-fields class="mt-4 lg:mt-0">
          <div
            class="grid grid-cols-1 items-start gap-4 min-[360px]:grid-cols-2 @3xl:grid-cols-[1.2fr_1fr_0.8fr]"
          >
            <div class="min-[360px]:col-span-2 @3xl:col-span-1">
              <CitySearch
                onselect={(suggestion) => void presentation.chooseCity(suggestion)}
                selectedName={presentation.selectedName}
                pendingName={presentation.pendingName}
                housing={presentation.options.housing}
              />
            </div>
            <div class="min-w-0">
              <SalaryInput
                id="salary"
                label="Annual salary"
                detail={presentation.salary == null
                  ? undefined
                  : money(presentation.salary / 12) + ' gross / mo'}
                value={salary.text}
                error={salary.error}
                oninput={salary.oninput}
                onblur={salary.onblur}
                onkeydown={salary.onkeydown}
              />
              <div class="mt-3">
                <SalarySlider
                  value={presentation.salary}
                  oninput={(event) =>
                    onsalary(Number.parseInt((event.target as HTMLInputElement).value, 10))}
                />
              </div>
            </div>
            <HousingSelector
              value={presentation.options.housing}
              onchange={(housing) => presentation.setOptions({ ...presentation.options, housing })}
            />
          </div>
          <div
            class="mt-4 flex flex-col items-stretch justify-between gap-2 border-t border-line pt-1 @3xl:flex-row @3xl:items-start @3xl:gap-6"
          >
            <PersonalCosts
              compact
              bind:open={costsOpen}
              options={presentation.options}
              onoptions={(options) => presentation.setOptions(options)}
              actualTakeHomeMonthly={presentation.actualTakeHomeMonthly}
              ceilingUsesGrossIncome={budget
                ? presentation.rentTarget === budget.maxRent
                : undefined}
              ontakehome={activeCity ? (value) => presentation.setActualTakeHome(value) : undefined}
            />
          </div>
          {#if activeCity}
            {#key activeCity.name}<CityImage
                city={activeCity}
                class="mt-5 hidden overflow-hidden rounded-xl lg:block"
              />{/key}
          {/if}
        </div>
      </details>
      {#if activeCity && budget}<div class="border-t border-line {editorOpen ? 'mt-4 pt-2' : ''}">
          <CityActions {presentation} cityName={activeCity.name} />
        </div>{/if}
    </div>
  </section>
</aside>

<style>
  [data-active='false'] > [data-plan-editor] > summary {
    display: none;
  }
  @media (max-width: 1023px) {
    [data-collapsed='true'] {
      padding: 0.5rem 1rem;
    }
  }
  @media (min-width: 1024px) {
    [data-active='true'] :global([data-plan-fields] > div:first-child) {
      grid-template-columns: minmax(0, 1fr);
    }
    [data-active='true'] :global([data-plan-fields] > div:first-child > div:first-child) {
      grid-column: 1 / -1;
    }
    [data-active='true'] :global(figure img) {
      max-height: 9rem;
    }
  }
</style>
