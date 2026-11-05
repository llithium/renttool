<script lang="ts">
  import type { CommuteFilterResult } from '$lib/commute';
  import type { ComparisonEntry } from '$lib/compare/decision';
  import MonthlyAmountInput from '$lib/components/ui/MonthlyAmountInput.svelte';
  import { housingShortLabel, type HousingChoice } from '$lib/planning';

  let {
    entry,
    commute,
    commuteLoading,
    commuteDestination,
    commuteMaximum,
    href,
    housing,
    ontakehome,
    defaultExpenses,
    onexpenses
  }: {
    entry: ComparisonEntry;
    commute: CommuteFilterResult | null;
    commuteLoading: boolean;
    commuteDestination?: string;
    commuteMaximum: number;
    href: string;
    housing: HousingChoice;
    ontakehome: (value: number | null) => void;
    defaultExpenses: number;
    onexpenses: (value: number | null) => void;
  } = $props();

  let result = $derived(entry.fit);
</script>

<article data-testid="scenario" data-offer-column>
  <div data-offer-heading>
    <div>
      <h2 class="text-2xl/tight font-semibold tracking-tight">
        <a {href} class="text-ink no-underline hover:text-inherit">{entry.city.name}</a>
      </h2>
      <p class="mt-0.5 text-meta text-muted">{entry.rent.metricLabel}</p>
    </div>
  </div>

  <dl data-offer-housing>
    <div>
      <dt class="text-meta text-muted">{housingShortLabel(housing)} rent</dt>
      <dd class="mt-1 text-data tabular-nums">{entry.metrics.selectedRent.value}</dd>
    </div>
    <div>
      <dt class="text-meta text-muted">Rent ceiling</dt>
      {#key entry.rentBudget.amount}
        <dd class="motion-value mt-1 text-data tabular-nums">
          {entry.rentBudget.value}
        </dd>
      {/key}
    </div>
  </dl>

  <div
    data-offer-fit
    class="text-sm font-semibold {result.tone === 'good'
      ? 'text-green'
      : result.tone === 'bad'
        ? 'text-red'
        : 'text-muted'}"
  >
    {#key result.label}
      <span class="motion-copy inline-block">{result.label}</span>
    {/key}
  </div>
  <div data-offer-details>
    <details class="min-w-0 grow basis-2/5 open:basis-full">
      <summary class="min-h-11 cursor-pointer text-meta font-semibold text-muted"
        >Use actual take-home pay</summary
      >
      <MonthlyAmountInput
        id={`take-home-${entry.city.name.replace(/[^a-z0-9]+/gi, '-')}`}
        label={`Monthly take-home in ${entry.city.name}`}
        value={entry.actualTakeHomeMonthly ?? null}
        onchange={ontakehome}
        hint="Leave blank to estimate taxes. Applies to this salary only."
      />
    </details>

    <details class="min-w-0 grow basis-2/5 open:basis-full">
      <summary class="min-h-11 cursor-pointer text-meta font-semibold text-muted"
        >Expenses for this city{entry.monthlyExpenses != null ? ' · customized' : ''}</summary
      >
      <MonthlyAmountInput
        id={`expenses-${entry.city.name.replace(/[^a-z0-9]+/gi, '-')}`}
        label={`Monthly expenses in ${entry.city.name}`}
        value={entry.monthlyExpenses ?? null}
        onchange={onexpenses}
        hint={`Leave blank to use the shared default ($${defaultExpenses.toLocaleString()}/mo). Enter 0 for no expenses.`}
      />
    </details>
  </div>

  <div data-offer-context>
    {#if commuteDestination}
      {@const minutes = commute?.minutes[entry.city.name]}
      <div class="mb-3 text-sm">
        <p class="text-muted">Drive to {commuteDestination}</p>
        <p class="mt-1 font-semibold tabular-nums">
          {#if minutes != null}
            {minutes} min drive ·
            <span class={minutes <= commuteMaximum ? 'text-green' : 'text-red'}
              >{minutes <= commuteMaximum ? 'Within' : 'Over'} {commuteMaximum}-minute limit</span
            >
          {:else if commuteLoading}Checking driving time…
          {:else}Driving time unavailable{/if}
        </p>
      </div>
    {/if}
    <p class="text-meta text-muted">
      {entry.actualTakeHomeMonthly != null ? 'Entered take-home pay' : 'Estimated take-home pay'} · {entry.rentProvenance}
    </p>
    {#if entry.rent.amount == null}
      <p class="mt-2 text-meta text-muted">
        We could not match a rent estimate for this housing setup. Open the city name above for
        available rent context and alternatives.
      </p>
    {/if}
  </div>
</article>

<style>
  [data-offer-column] {
    min-width: 0;
    padding: 1.25rem 0;
    border-left: 2px solid var(--line-strong);
    padding-left: 1rem;
  }

  [data-offer-heading] {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  [data-offer-housing] {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1.25rem;
  }

  [data-offer-fit] {
    padding: 0.875rem 0;
  }

  [data-offer-details] {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    gap: 0 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--line);
  }

  [data-offer-context] {
    padding-top: 0.25rem;
  }

  @media (min-width: 768px) {
    [data-offer-column] {
      max-width: 48rem;
    }
  }
</style>
