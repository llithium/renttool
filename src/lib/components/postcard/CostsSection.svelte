<script lang="ts">
  import type { PlanningOptions } from '$lib/planning';
  import { money } from '$lib/format';
  import MonthlyAmountInput from '$lib/components/ui/MonthlyAmountInput.svelte';

  /** Personal costs that can lower the ceiling below 30% of gross pay. */
  let {
    options,
    onoptions,
    actualTakeHomeMonthly = null,
    ontakehome,
    grossCeiling = null,
    ceiling = null,
    id = 'plan',
    open = $bindable(false)
  }: {
    options: PlanningOptions;
    onoptions: (value: PlanningOptions) => void;
    actualTakeHomeMonthly?: number | null;
    ontakehome?: (value: number | null) => void;
    grossCeiling?: number | null;
    ceiling?: number | null;
    id?: string;
    open?: boolean;
  } = $props();

  let personal = $derived(options.budgetMode !== 'gross');
  let summary = $derived(
    ceiling == null
      ? 'Optional'
      : grossCeiling != null && ceiling < grossCeiling
        ? `Your costs set the ceiling at ${money(ceiling)}`
        : `Ceiling is 30% of gross pay${grossCeiling != null ? `, ${money(grossCeiling)}` : ''}`
  );
</script>

<details class="pc-costs" id={`${id}-costs`} bind:open>
  <summary>
    <span class="pc-costs-title pc-display">Your monthly costs</span>
    <span class="pc-costs-sum">{summary}</span>
  </summary>
  <div class="pc-costs-body">
    <fieldset>
      <legend>Set the rent ceiling by</legend>
      <div class="pc-seg" role="group" aria-label="Rent ceiling rule">
        <button
          type="button"
          aria-pressed={personal}
          onclick={() => onoptions({ ...options, budgetMode: 'personal' })}>My costs</button
        >
        <button
          type="button"
          aria-pressed={!personal}
          onclick={() => onoptions({ ...options, budgetMode: 'gross' })}>30% of gross</button
        >
      </div>
      <p class="pc-costs-hint">
        {personal
          ? 'Uses the lower of 30% of gross pay and what take-home leaves after the costs below.'
          : 'Ignores the costs below and uses 30% of gross pay.'}
      </p>
    </fieldset>
    <div class="pc-costs-grid">
      <MonthlyAmountInput
        id={`${id}-expenses`}
        label="Recurring expenses"
        value={options.monthlyExpenses || null}
        onchange={(value) => onoptions({ ...options, monthlyExpenses: value ?? 0 })}
        placeholder="0"
        hint="Car, phone, debt, anything not in rent."
      />
      <MonthlyAmountInput
        id={`${id}-savings`}
        label="Savings target"
        value={options.monthlySavings || null}
        onchange={(value) => onoptions({ ...options, monthlySavings: value ?? 0 })}
        placeholder="0"
      />
      <MonthlyAmountInput
        id={`${id}-buffer`}
        label="Monthly buffer"
        value={options.monthlyBuffer || null}
        onchange={(value) => onoptions({ ...options, monthlyBuffer: value ?? 0 })}
        placeholder="0"
        hint="Money to keep free after everything else."
      />
      {#if ontakehome}
        <MonthlyAmountInput
          id={`${id}-take-home`}
          label="Actual take-home"
          value={actualTakeHomeMonthly}
          onchange={ontakehome}
          hint="From a pay stub or offer letter. Blank uses estimated taxes."
        />
      {/if}
    </div>
    <p class="pc-costs-hint">
      Savings and the buffer apply to every city. Expenses are the default for each city; you can
      change them per city on the compare page.
    </p>
  </div>
</details>

<style>
  .pc-costs {
    margin-top: 1.5rem;
    border-radius: 8px;
    background: var(--card);
  }
  summary {
    display: flex;
    min-height: 3.5rem;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem 1rem;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary::after {
    content: '+';
    margin-left: auto;
    font-size: 1.5rem;
    line-height: 1;
  }
  details[open] summary::after {
    content: '−';
  }
  .pc-costs-title {
    font-size: 1.375rem;
    font-weight: 700;
  }
  .pc-costs-sum {
    color: var(--muted);
    font-size: 0.875rem;
  }
  .pc-costs-body {
    display: grid;
    gap: 1.25rem;
    padding: 0.5rem 1.5rem 1.5rem;
    border-top: 1px solid var(--line);
  }
  fieldset {
    margin: 0;
    padding: 0.75rem 0 0;
    border: 0;
  }
  legend {
    margin-bottom: 0.5rem;
    color: var(--muted);
    font-size: 0.875rem;
    font-weight: 600;
  }
  .pc-costs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 1rem 1.5rem;
  }
  .pc-costs-hint {
    margin: 0.5rem 0 0;
    color: var(--muted);
    font-size: 0.8125rem;
  }
  @media (max-width: 600px) {
    summary,
    .pc-costs-body {
      padding-right: 1rem;
      padding-left: 1rem;
    }
  }
</style>
