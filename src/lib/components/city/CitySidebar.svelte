<script lang="ts">
  import type { Budget, City, CitySuggestion } from '$lib/types';
  import type { SalaryField } from '$lib/salaryField.svelte';
  import { rentPlanPresentation as plan } from '$lib/rentPlanPresentation.svelte';
  import CitySearch from '$lib/components/ui/CitySearch.svelte';
  import SalaryInput from '$lib/components/ui/SalaryInput.svelte';
  import SalarySlider from './SalarySlider.svelte';
  import CityActions from './CityActions.svelte';
  import BudgetCard from './BudgetCard.svelte';

  let {
    salary,
    selected,
    budget,
    onselect,
    onsalary
  }: {
    salary: SalaryField;
    selected: City | null;
    budget: Budget | null;
    onselect: (suggestion: CitySuggestion) => void;
    onsalary: (value: number) => void;
  } = $props();
</script>

<!-- Two-column view: the planning controls stay pinned while the results scroll.
     Below the large breakpoint they return to normal document flow. -->
<aside data-testid="sidebar" class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
  <!-- One control surface: inputs lead directly to the resulting budget. -->
  <section
    id="plan-controls"
    class="scroll-mt-6 rounded-2xl border border-line-strong bg-card p-6 shadow-card md:p-7"
  >
    <div class="mb-6 border-b border-line-strong pb-5">
      <p class="text-meta font-semibold tracking-[0.14em] text-accent uppercase">Your inputs</p>
      <p class="mt-2 text-sm/relaxed text-muted">
        Every figure begins with the city and salary you are weighing.
      </p>
    </div>
    <CitySearch {onselect} selectedName={plan.selectedName} pendingName={plan.pendingName} />

    <SalaryInput
      id="salary"
      label="Annual salary"
      value={salary.text}
      error={salary.error}
      oninput={salary.oninput}
      onblur={salary.onblur}
      onkeydown={salary.onkeydown}
      class="mt-4 mb-2.5"
    />
    <SalarySlider
      value={plan.salary}
      oninput={(event) => onsalary(Number.parseInt((event.target as HTMLInputElement).value, 10))}
    />

    {#if selected && budget}
      <BudgetCard {budget} />
      <CityActions cityName={selected.name} canShare={true} />
    {/if}
  </section>
</aside>
