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

<!-- Keep the editing surface and its column widths stable as a salary becomes valid. -->
<aside data-testid="sidebar" class="@container min-w-0">
  <section
    id="plan-controls"
    tabindex="-1"
    class="scroll-mt-28 rounded-2xl border border-line-strong bg-card p-5 md:p-7"
  >
    <div
      class="grid gap-7 @2xl:grid-cols-2 @2xl:gap-7 {activeCity
        ? '@4xl:grid-cols-[1fr_1fr_1.1fr]'
        : ''}"
    >
      <div>
        <CitySearch
          onselect={(suggestion) => void presentation.chooseCity(suggestion)}
          selectedName={presentation.selectedName}
          pendingName={presentation.pendingName}
        />
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
      {#if activeCity}
        <div class="border-line @max-4xl:border-t @max-4xl:pt-7 @4xl:border-l @4xl:pl-7">
          {#if budget}
            <BudgetCard {budget} />
            <CityActions {presentation} cityName={activeCity.name} />
          {:else}
            <h2 class="text-title">What rent fits here?</h2>
            <p class="mt-2 max-w-sm text-sm/relaxed text-muted">
              Enter your annual salary to see your monthly target and how it compares with local
              rents.
            </p>
          {/if}
        </div>
      {/if}
    </div>
  </section>
</aside>
