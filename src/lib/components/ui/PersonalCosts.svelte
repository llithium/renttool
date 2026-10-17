<script lang="ts">
  import type { PlanningOptions } from '$lib/planning';
  import Select from './Select.svelte';
  import MonthlyAmountInput from './MonthlyAmountInput.svelte';
  let {
    options,
    onoptions,
    actualTakeHomeMonthly = null,
    ceilingUsesGrossIncome,
    compact = false,
    ontakehome,
    id = 'plan'
  }: {
    options: PlanningOptions;
    onoptions: (value: PlanningOptions) => void;
    actualTakeHomeMonthly?: number | null;
    ceilingUsesGrossIncome?: boolean;
    compact?: boolean;
    ontakehome?: (value: number | null) => void;
    id?: string;
  } = $props();
</script>

<details class="min-w-0 flex-1 {compact ? '' : 'mt-5 border-t border-line pt-4'}">
  <summary class="min-h-11 cursor-pointer py-3 text-sm font-semibold text-ink"
    >Personal expenses &amp; savings (optional)</summary
  >
  <div class="mt-3 grid gap-4 sm:grid-cols-2">
    <div>
      <Select
        id={`${id}-budget-mode`}
        label="Rent ceiling"
        value={options.budgetMode ?? 'personal'}
        options={[
          { value: 'personal', label: 'Personal budget' },
          { value: 'gross', label: '30% of gross income' }
        ] as const}
        onchange={(budgetMode) => onoptions({ ...options, budgetMode })}
      />
      <p class="mt-2 text-meta text-muted">
        {#if options.budgetMode === 'gross'}
          Uses 30% of gross income.
        {:else if ceilingUsesGrossIncome === true}
          Currently using 30% of gross income. Personal amounts can lower this ceiling.
        {:else}
          Personal budget uses the lower of 30% of gross pay and take-home pay after expenses,
          savings, and buffer.
        {/if}
      </p>
    </div>
    <MonthlyAmountInput
      id={`${id}-buffer`}
      label="Monthly buffer"
      value={options.monthlyBuffer || null}
      onchange={(value) => onoptions({ ...options, monthlyBuffer: value ?? 0 })}
      placeholder="0"
      hint="Keep this amount free after expenses and savings."
    />
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
    Savings and buffer apply everywhere. Expenses are the default for each city; you can override
    them in comparisons. Include costs not already covered by rent.
  </p>
</details>
