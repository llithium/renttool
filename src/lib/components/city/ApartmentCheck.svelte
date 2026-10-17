<script lang="ts">
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import { checkApartment, type ApartmentCosts } from '$lib/planning';
  import MonthlyAmountInput from '$lib/components/ui/MonthlyAmountInput.svelte';
  import { money } from '$lib/format';

  let { presentation }: { presentation: RentPlanPresentation } = $props();
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
  class="mt-6 scroll-mt-28 rounded-lg border border-line bg-card p-5 md:p-7"
  aria-labelledby="apartment-heading"
>
  <h2 id="apartment-heading" class="text-title">Check an actual apartment</h2>
  <p class="mt-2 max-w-2xl text-sm text-muted">
    Enter your share of each cost. Exclude these amounts from recurring expenses to avoid counting
    them twice. This check stays separate from citywide rent estimates.
  </p>
  <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each fields as field (field.key)}
      <MonthlyAmountInput
        id={`apartment-${field.key}`}
        label={field.label}
        monthly={field.key !== 'deposit' && field.key !== 'moving'}
        value={costs[field.key]}
        onchange={(value) => (costs = { ...costs, [field.key]: value })}
        placeholder={field.key === 'rent' ? 'Enter rent' : '0'}
      />
    {/each}
  </div>
  {#if result}
    <div class="mt-5 rounded-md border border-line bg-card-2 p-5" data-testid="apartment-result">
      <p
        class="font-semibold {result.withinCeiling && result.afterBuffer >= 0
          ? 'text-green'
          : 'text-red'}"
      >
        {result.withinCeiling && result.afterBuffer >= 0
          ? 'Fits your rent ceiling and buffer'
          : 'Exceeds your rent ceiling or buffer'}
      </p>
      <dl class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt class="text-meta text-muted">Total monthly housing</dt>
          <dd class="mt-1 text-data tabular-nums">{money(result.monthly)}</dd>
        </div>
        <div>
          <dt class="text-meta text-muted">After housing, expenses &amp; savings</dt>
          <dd class="mt-1 text-data tabular-nums {result.available < 0 ? 'text-red' : ''}">
            {money(result.available)}
          </dd>
          <p class="mt-1 text-meta text-muted">{money(result.afterBuffer)} after your buffer</p>
        </div>
        <div>
          <dt class="text-meta text-muted">Estimated move-in cash</dt>
          <dd class="mt-1 text-data tabular-nums">{money(result.upfront)}</dd>
        </div>
      </dl>
      <p class="mt-3 text-meta text-muted">
        Move-in cash includes the first month’s housing costs, deposit, and entered upfront costs.
        Check payment timing with the property. Apartment inputs are temporary and excluded from
        shared links.
      </p>
    </div>
  {/if}
</section>
