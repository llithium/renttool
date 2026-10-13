<script lang="ts">
  import type { SalaryField } from '$lib/salaryField.svelte';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import CitySearch from '$lib/components/ui/CitySearch.svelte';
  import SalaryInput from '$lib/components/ui/SalaryInput.svelte';
  import SalarySlider from './SalarySlider.svelte';
  import CityActions from './CityActions.svelte';
  import BudgetCard from './BudgetCard.svelte';
  import Verdict from './Verdict.svelte';
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

<!-- Keep the editing surface and its column widths stable as a salary becomes valid. -->
<aside data-testid="sidebar" class="@container min-w-0">
  {#if activeCity}<BudgetCard {presentation} />{/if}
  <section id="plan-controls" tabindex="-1" class="scroll-mt-28 border-b border-line py-6 md:py-7">
    <div class="grid gap-7 @2xl:grid-cols-2 @2xl:gap-7">
      <div>
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
      <div class="@2xl:border-l @2xl:border-line @2xl:pl-7">
        <SalaryInput
          id="salary"
          label="Annual salary"
          value={salary.text}
          error={salary.error}
          oninput={salary.oninput}
          onblur={salary.onblur}
          onkeydown={salary.onkeydown}
          class="mb-2.5"
        />
        <SalarySlider
          value={presentation.salary}
          oninput={(event) =>
            onsalary(Number.parseInt((event.target as HTMLInputElement).value, 10))}
        />
      </div>
    </div>

    {#if activeCity && budget}
      <div id="rent-decision" class="mt-7 border-t border-line pt-7">
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
    <PersonalCosts
      options={presentation.options}
      onoptions={(options) => presentation.setOptions(options)}
      actualTakeHomeMonthly={presentation.actualTakeHomeMonthly}
      ceilingUsesGrossIncome={budget ? presentation.rentTarget === budget.maxRent : undefined}
      ontakehome={activeCity ? (value) => presentation.setActualTakeHome(value) : undefined}
    />
    {#if activeCity && budget}<CityActions {presentation} cityName={activeCity.name} />{/if}
  </section>
</aside>
