<script lang="ts">
  import type { PlanningOptions } from '$lib/planning';
  import { money } from '$lib/format';
  let {
    options,
    actualTakeHomeMonthly = null,
    defaults = false,
    onedit
  }: {
    options: PlanningOptions;
    actualTakeHomeMonthly?: number | null;
    defaults?: boolean;
    onedit: () => void;
  } = $props();
  let items = $derived([
    ...(actualTakeHomeMonthly != null
      ? [{ label: 'Take-home', value: actualTakeHomeMonthly }]
      : []),
    ...[
      { label: 'Expenses', value: options.monthlyExpenses },
      { label: 'Savings', value: options.monthlySavings },
      { label: 'Buffer', value: options.monthlyBuffer ?? 0 }
    ].filter((item) => item.value > 0)
  ]);
</script>

{#if items.length}
  <button
    type="button"
    onclick={onedit}
    aria-label={defaults
      ? 'Edit default monthly plan assumptions'
      : 'Edit monthly plan assumptions'}
    data-plan-assumptions
  >
    <span data-assumptions-label
      >{defaults ? 'Monthly defaults' : 'Monthly costs'}
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none"
        ><path
          d="m10.5 2.5 3 3M3 10l7.6-7.6a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L6 13H3v-3Z"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linejoin="round"
        /></svg
      ><span>Edit</span></span
    >
    <span data-assumptions-values
      >{#each items as item (item.label)}<span>{item.label} <b>{money(item.value)}</b></span
        >{/each}</span
    >
  </button>
{/if}

<style>
  [data-plan-assumptions] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem 0.625rem;
    min-height: 2.75rem;
    margin-top: 0.25rem;
    padding: 0.375rem 0;
    font-size: 0.8125rem;
    color: var(--muted);
    cursor: pointer;
    text-align: left;
  }
  [data-assumptions-values] {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.875rem;
  }
  [data-assumptions-label] > span {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  @media (max-width: 639px) {
    [data-plan-assumptions] {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
  [data-assumptions-label] {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
  [data-plan-assumptions] b {
    font-weight: 600;
    color: var(--ink);
  }
  [data-plan-assumptions]:hover {
    color: var(--accent);
  }
</style>
