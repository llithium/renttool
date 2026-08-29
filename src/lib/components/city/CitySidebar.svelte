<script lang="ts">
  import type { SalaryField } from '$lib/salaryField.svelte';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import CitySearch from '$lib/components/ui/CitySearch.svelte';
  import SalaryInput from '$lib/components/ui/SalaryInput.svelte';
  import SalarySlider from './SalarySlider.svelte';
  import CityActions from './CityActions.svelte';
  import BudgetCard from './BudgetCard.svelte';

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

<!-- The controls use the same flat, ruled language as the comparison entries.
     Inputs and their answer sit in one responsive ledger rather than a dashboard sidebar. -->
<aside data-testid="sidebar" class="@container min-w-0">
  <section id="plan-controls" class="scroll-mt-6 border-y border-line-strong py-6 md:py-8">
    <div class="grid gap-7 @2xl:grid-cols-2 @2xl:gap-10 @4xl:grid-cols-[1fr_1fr_1.1fr]">
      <div>
        <p class="mb-5 text-meta font-semibold tracking-[0.14em] text-accent uppercase">
          Your inputs
        </p>
        <CitySearch
          onselect={(suggestion) => void presentation.chooseCity(suggestion)}
          selectedName={presentation.selectedName}
          pendingName={presentation.pendingName}
        />
      </div>
      <div class="@2xl:border-l @2xl:border-line @2xl:pl-10">
        <SalaryInput
          id="salary"
          label="Annual salary"
          value={salary.text}
          error={salary.error}
          oninput={salary.oninput}
          onblur={salary.onblur}
          onkeydown={salary.onkeydown}
          class="mb-2.5 @2xl:mt-8"
        />
        <SalarySlider
          value={presentation.salary}
          oninput={(event) =>
            onsalary(Number.parseInt((event.target as HTMLInputElement).value, 10))}
        />
      </div>
      {#if activeCity && budget}
        <div class="border-line @max-4xl:border-t @max-4xl:pt-7 @4xl:border-l @4xl:pl-10">
          <BudgetCard {budget} />
          <CityActions {presentation} cityName={activeCity.name} canShare={true} />
        </div>
      {/if}
    </div>
  </section>
</aside>
