<script lang="ts">
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import { checkApartment, type ApartmentCosts } from '$lib/planning';
  import MonthlyAmountInput from '$lib/components/ui/MonthlyAmountInput.svelte';
  import { money } from '$lib/format';

  let {
    presentation,
    open = $bindable(false)
  }: { presentation: RentPlanPresentation; open?: boolean } = $props();
  let costs = $state<ApartmentCosts>({
    rent: null,
    utilities: null,
    parking: null,
    fees: null,
    deposit: null,
    moving: null
  });
  let result = $derived(
    presentation.budget
      ? checkApartment(
          presentation.budget,
          presentation.options,
          costs,
          presentation.actualTakeHomeMonthly
        )
      : null
  );
  const fields = [
    { key: 'rent', label: 'Quoted monthly rent' },
    { key: 'utilities', label: 'Monthly utilities' },
    { key: 'parking', label: 'Monthly parking' },
    { key: 'fees', label: 'Other monthly fees' },
    { key: 'deposit', label: 'Security deposit' },
    { key: 'moving', label: 'Moving & other upfront costs' }
  ] as const;
</script>

<section
  id="apartment-check"
  tabindex="-1"
  class="mt-6 scroll-mt-28 rounded-2xl border border-line bg-card p-5 shadow-card md:p-7"
  aria-labelledby="apartment-heading"
>
  <details bind:open>
    <summary id="apartment-heading" class="min-h-11 cursor-pointer py-2 text-title"
      >Check an actual apartment</summary
    >
    <p class="mt-2 max-w-2xl text-sm text-muted">
      Enter your share of each cost. Exclude these amounts from recurring expenses to avoid counting
      them twice. This check stays separate from citywide rent estimates.
    </p>
    {#if result}
      <dl data-apartment-glance aria-label="Apartment cost summary">
        <div>
          <dt>Monthly housing</dt>
          <dd>{money(result.monthly)}<span>/mo</span></dd>
        </div>
        <div>
          <dt>Move-in cash</dt>
          <dd>{money(result.upfront)}</dd>
        </div>
      </dl>
    {/if}
    <div class="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div data-apartment-fields class="grid gap-6">
        <fieldset class="min-w-0">
          <legend class="mb-3 text-title">Monthly housing</legend>
          <div class="grid gap-4 min-[360px]:grid-cols-2">
            {#each fields.slice(0, 4) as field (field.key)}
              <MonthlyAmountInput
                id={`apartment-${field.key}`}
                label={field.label}
                value={costs[field.key]}
                onchange={(value) => (costs = { ...costs, [field.key]: value })}
                placeholder={field.key === 'rent' ? 'Enter rent' : '0'}
              />
            {/each}
          </div>
        </fieldset>
        <fieldset class="min-w-0 border-t border-line pt-4">
          <legend class="pr-3 text-title">One-time move-in costs</legend>
          <div class="grid gap-4 min-[360px]:grid-cols-2">
            {#each fields.slice(4) as field (field.key)}
              <MonthlyAmountInput
                id={`apartment-${field.key}`}
                label={field.label}
                monthly={false}
                value={costs[field.key]}
                onchange={(value) => (costs = { ...costs, [field.key]: value })}
                placeholder="0"
              />
            {/each}
          </div>
        </fieldset>
      </div>
      {#if result}
        <div class="rounded-xl bg-card-2 p-5" data-testid="apartment-result">
          <p
            class="font-semibold {result.withinCeiling && result.afterBuffer >= 0
              ? 'text-green'
              : 'text-red'}"
          >
            {result.withinCeiling && result.afterBuffer >= 0
              ? 'Fits your rent ceiling and buffer'
              : 'Exceeds your rent ceiling or buffer'}
          </p>
          <dl class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div>
              <dt class="text-meta text-muted">Total monthly housing</dt>
              <dd class="mt-1 text-3xl/tight font-semibold tabular-nums">
                {money(result.monthly)}<span class="text-sm font-normal text-muted">/mo</span>
              </dd>
            </div>
            <div>
              <dt class="text-meta text-muted">After housing, expenses &amp; savings</dt>
              <dd class="mt-1 text-data tabular-nums {result.available < 0 ? 'text-red' : ''}">
                {money(result.available)}
                <p class="mt-1 text-meta text-muted">
                  {money(result.afterBuffer)} after your buffer
                </p>
              </dd>
            </div>
            <div class="border-line lg:border-t lg:pt-4">
              <dt class="text-meta text-muted">Estimated move-in cash</dt>
              <dd class="mt-1 text-3xl/tight font-semibold tabular-nums">
                {money(result.upfront)}
              </dd>
            </div>
          </dl>
          <p class="mt-3 text-meta text-muted">
            Move-in cash includes the first month’s housing costs, deposit, and entered upfront
            costs. Check payment timing with the property. Apartment inputs are temporary and
            excluded from shared links.
          </p>
        </div>
      {/if}
    </div>
  </details>
</section>

<style>
  #apartment-check :global(input) {
    scroll-margin-block: 8rem 2rem;
  }

  [data-apartment-glance] {
    position: sticky;
    top: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--line);
    border-radius: 0.875rem;
    background: var(--card-2);
    box-shadow: var(--elevation-card);
  }
  [data-apartment-glance] dt {
    color: var(--muted);
    font-size: 0.8125rem;
  }
  [data-apartment-glance] dd {
    margin-top: 0.25rem;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  [data-apartment-glance] dd span {
    font-size: 0.75rem;
    font-weight: 400;
    letter-spacing: 0;
    color: var(--muted);
  }
  @media (max-width: 639px) {
    [data-apartment-fields] :global(label) {
      min-height: 2.5em;
    }
  }
  @media (min-width: 1024px) {
    [data-apartment-glance] {
      display: none;
    }
  }
</style>
