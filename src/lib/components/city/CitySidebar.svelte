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
  import { money } from '$lib/format';

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
  <section id="plan-controls" tabindex="-1" class="scroll-mt-28 border-y border-line py-6 md:py-7">
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
      {#if activeCity}
        <div class="border-line @max-4xl:border-t @max-4xl:pt-7 @4xl:border-l @4xl:pl-7">
          {#if budget}
            <BudgetCard {budget} actualTakeHomeMonthly={presentation.actualTakeHomeMonthly} />
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

    {#if activeCity && budget}
      <div id="rent-decision" class="mt-7 border-t border-line pt-7">
        <Verdict
          {budget}
          city={activeCity}
          housing={presentation.options.housing}
          actualTakeHomeMonthly={presentation.actualTakeHomeMonthly}
        />
        {#if presentation.spendingRoom?.available != null}
          <div
            class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card-2 p-4"
            data-testid="spending-room"
          >
            <div>
              <p class="text-label text-muted">Available after rent, expenses &amp; savings</p>
              <p class="mt-1 text-meta text-muted">
                {presentation.actualTakeHomeMonthly != null
                  ? 'Using your entered take-home pay'
                  : 'Using estimated take-home pay'}
              </p>
            </div>
            <strong
              class="text-data whitespace-nowrap tabular-nums {presentation.spendingRoom.available <
              0
                ? 'text-red'
                : 'text-ink'}"
              >{money(presentation.spendingRoom.available)}<span
                class="ml-1 text-sm font-medium tracking-normal text-muted">/mo</span
              ></strong
            >
          </div>
        {/if}
        <PersonalCosts
          options={presentation.options}
          onoptions={(options) => presentation.setOptions(options)}
          actualTakeHomeMonthly={presentation.actualTakeHomeMonthly}
          ontakehome={(value) => presentation.setActualTakeHome(value)}
        />
      </div>
    {/if}
  </section>
</aside>
