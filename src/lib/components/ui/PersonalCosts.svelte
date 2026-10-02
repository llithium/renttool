<script lang="ts">
  import type { PlanningOptions } from '$lib/planning';
  import MonthlyAmountInput from './MonthlyAmountInput.svelte';
  let {
    options,
    onoptions,
    actualTakeHomeMonthly = null,
    ontakehome,
    id = 'plan'
  }: {
    options: PlanningOptions;
    onoptions: (value: PlanningOptions) => void;
    actualTakeHomeMonthly?: number | null;
    ontakehome?: (value: number | null) => void;
    id?: string;
  } = $props();
</script>

<details class="mt-5 border-t border-line pt-4">
  <summary class="min-h-11 cursor-pointer text-sm font-semibold text-ink"
    >Personal expenses &amp; savings (optional)</summary
  >
  <div class="mt-3 grid gap-4 sm:grid-cols-2">
    {#if ontakehome}
      <MonthlyAmountInput
        id={`${id}-take-home`}
        label="Actual monthly take-home"
        value={actualTakeHomeMonthly}
        onchange={ontakehome}
        hint="For this city and salary. Leave blank to use estimated taxes."
      />
    {/if}
    <MonthlyAmountInput
      id={`${id}-expenses`}
      label="Recurring monthly expenses"
      value={options.monthlyExpenses || null}
      onchange={(value) => onoptions({ ...options, monthlyExpenses: value ?? 0 })}
      placeholder="0"
    />
    <MonthlyAmountInput
      id={`${id}-savings`}
      label="Monthly savings target"
      value={options.monthlySavings || null}
      onchange={(value) => onoptions({ ...options, monthlySavings: value ?? 0 })}
      placeholder="0"
    />
  </div>
  <p class="mt-3 text-meta text-muted">
    Expenses and savings apply to every comparison entry. Include costs not already covered by the
    rent estimate.
  </p>
</details>
