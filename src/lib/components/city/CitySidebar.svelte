<script lang="ts">
  import type { SalaryField } from '$lib/salaryField.svelte';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import CitySearch from '$lib/components/ui/CitySearch.svelte';
  import SalaryInput from '$lib/components/ui/SalaryInput.svelte';
  import SalarySlider from './SalarySlider.svelte';
  import CityActions from './CityActions.svelte';
  import BudgetCard from './BudgetCard.svelte';
  import RentTrendChart from './RentTrendChart.svelte';
  import Verdict from './Verdict.svelte';
  import { money } from '$lib/format';
  import HousingSelector from '$lib/components/ui/HousingSelector.svelte';
  import PersonalCosts from '$lib/components/ui/PersonalCosts.svelte';

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
</script>

<!-- Inputs stay above the results so recalculation cannot move an active salary drag. -->
<aside data-testid="sidebar" class="@container min-w-0">
  <section id="plan-controls" tabindex="-1" class="scroll-mt-28">
    <div class="rounded-lg border border-line bg-card p-4 md:p-6">
      <div class="grid items-stretch gap-5 @lg:grid-cols-2 @3xl:gap-8">
        <div class="py-1">
          <CitySearch
            onselect={(suggestion) => void presentation.chooseCity(suggestion)}
            selectedName={presentation.selectedName}
            pendingName={presentation.pendingName}
            housing={presentation.options.housing}
          />
          <div class="mt-5">
            <HousingSelector
              value={presentation.options.housing}
              onchange={(housing) => presentation.setOptions({ ...presentation.options, housing })}
            />
          </div>
        </div>
        <div class="p-4">
          <SalaryInput
            id="salary"
            label="Annual salary"
            detail={presentation.salary == null
              ? 'Gross monthly —'
              : `${money(presentation.salary / 12)} gross / mo`}
            value={salary.text}
            error={salary.error}
            oninput={salary.oninput}
            onblur={salary.onblur}
            onkeydown={salary.onkeydown}
            class="mb-4"
          />
          <SalarySlider
            value={presentation.salary}
            oninput={(event) =>
              onsalary(Number.parseInt((event.target as HTMLInputElement).value, 10))}
          />
        </div>
      </div>
      <div
        class="mt-4 flex flex-col items-stretch justify-between gap-3 border-t border-line pt-3 md:flex-row md:items-start md:gap-6"
      >
        <PersonalCosts
          compact
          options={presentation.options}
          onoptions={(options) => presentation.setOptions(options)}
          actualTakeHomeMonthly={presentation.actualTakeHomeMonthly}
          ceilingUsesGrossIncome={budget ? presentation.rentTarget === budget.maxRent : undefined}
          ontakehome={activeCity ? (value) => presentation.setActualTakeHome(value) : undefined}
        />
        {#if activeCity && budget}<CityActions {presentation} cityName={activeCity.name} />{/if}
      </div>
    </div>

    {#if activeCity}
      <div
        class="mt-6 grid min-w-0 gap-6 {budget
          ? '@3xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]'
          : ''}"
      >
        <div class="min-w-0 rounded-lg border border-line bg-card p-5 md:p-7">
          <BudgetCard {presentation} />
          {#if budget}
            <div id="rent-decision" class="mt-5 border-t border-line pt-5">
              <Verdict
                {budget}
                city={activeCity}
                housing={presentation.options.housing}
                actualTakeHomeMonthly={presentation.actualTakeHomeMonthly}
                target={presentation.rentTarget ?? budget.maxRent}
                personal={presentation.rentTarget !== budget.maxRent}
              />
            </div>
          {/if}
        </div>
        {#if budget}
          <div class="flex min-w-0 flex-col rounded-lg border border-line bg-card p-5 md:p-7">
            <RentTrendChart
              city={activeCity}
              {budget}
              housing={presentation.options.housing}
              target={presentation.rentTarget ?? budget.maxRent}
            />
            <p class="mt-5 border-t border-line pt-4 text-meta text-muted">
              {activeCity.rentArea}{activeCity.rentYear ? ` · ${activeCity.rentYear}` : ''}. Market
              context, not a lease quote.
            </p>
            <a
              href="#city-details"
              class="mt-3 self-start text-label text-ink underline underline-offset-4"
              >View city details</a
            >
          </div>
        {/if}
      </div>
    {/if}
  </section>
</aside>
