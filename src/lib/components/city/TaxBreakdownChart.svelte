<script lang="ts">
  import type { Budget, City } from '$lib/types';
  import { money, sentenceLabel } from '$lib/format';
  import SectionHeading from '$lib/components/ui/SectionHeading.svelte';
  import { housingRent, housingRentLabel, type HousingChoice } from '$lib/planning';

  let {
    city,
    budget,
    housing = '1br',
    actualTakeHomeMonthly = null,
    class: className = ''
  }: {
    city: City;
    budget: Budget;
    housing?: HousingChoice;
    actualTakeHomeMonthly?: number | null;
    class?: string;
  } = $props();

  function pct(part: number, whole: number): number {
    return whole > 0 ? (part / whole) * 100 : 0;
  }

  // Row 1: gross monthly = federal + FICA + state tax + local tax + take-home
  let taxAmt = $derived(
    budget.federalMonthly + budget.ficaMonthly + budget.stateMonthly + budget.localMonthly
  );
  let fedPct = $derived(pct(budget.federalMonthly, budget.grossMonthly));
  let ficaPct = $derived(pct(budget.ficaMonthly, budget.grossMonthly));
  let statePct = $derived(pct(budget.stateMonthly, budget.grossMonthly));
  let localPct = $derived(pct(budget.localMonthly, budget.grossMonthly));
  let takePct = $derived(pct(budget.takeHomeMonthly, budget.grossMonthly));
  // Row 2 uses the entered paycheck when present; the tax model above remains estimated.
  let takeHome = $derived(actualTakeHomeMonthly ?? budget.takeHomeMonthly);
  let rentAmount = $derived(housingRent(city, housing));
  let rent = $derived(rentAmount ?? 0);
  let remaining = $derived(Math.max(0, takeHome - rent));
  let rentShare = $derived(takeHome > 0 ? (rent / takeHome) * 100 : 0);
  let rentPct = $derived(Math.min(100, pct(rent, takeHome)));
  let leftPct = $derived(pct(remaining, takeHome));
  let rentLabel = $derived(sentenceLabel(housingRentLabel(city, housing)));
</script>

<!-- Local snippets rather than extra components: the segment and swatch are used
     only inside this chart, and inlining keeps every utility visible here. -->
{#snippet segment(width: number, tone: string)}
  <div
    aria-hidden="true"
    class="h-full min-w-0 transition-[width] duration-400 {tone}"
    style="width:{width}%"
  ></div>
{/snippet}

{#snippet swatch(label: string, tone: string)}
  <span class="inline-flex items-center gap-1.5">
    <i class="inline-block size-2.5 rounded-xs {tone}"></i>{label}
  </span>
{/snippet}

<section class={className}>
  <SectionHeading title="Where the money goes" />

  <div class="mb-1 text-meta text-muted">
    <strong class="block font-semibold text-ink">Salary-based tax estimate</strong>
    Gross monthly {money(budget.grossMonthly)}{taxAmt > 0
      ? ` · estimated taxes ${money(taxAmt)}`
      : ''}
  </div>
  <div
    role="img"
    aria-label={`Gross monthly ${money(budget.grossMonthly)}: ${money(taxAmt)} taxes, ${money(budget.takeHomeMonthly)} take-home`}
    class="mb-3 flex h-5 w-full origin-left animate-grow-x overflow-hidden"
  >
    {#if budget.federalMonthly > 0}
      {@render segment(fedPct, 'bg-red')}
    {/if}
    {#if budget.ficaMonthly > 0}
      {@render segment(ficaPct, 'bg-amber')}
    {/if}
    {#if budget.stateMonthly > 0}
      {@render segment(statePct, 'bg-tax-state')}
    {/if}
    {#if budget.localMonthly > 0}
      {@render segment(localPct, 'bg-tax-local')}
    {/if}
    {@render segment(takePct, 'bg-green')}
  </div>
  <div class="mb-6 flex flex-wrap gap-x-3.5 gap-y-2 text-meta text-muted">
    {#if budget.federalMonthly > 0}
      {@render swatch(`Federal ${money(budget.federalMonthly)}`, 'bg-red')}
    {/if}
    {#if budget.ficaMonthly > 0}
      {@render swatch(`FICA ${money(budget.ficaMonthly)}`, 'bg-amber')}
    {/if}
    {#if budget.stateMonthly > 0}
      {@render swatch(`State ${money(budget.stateMonthly)}`, 'bg-tax-state')}
    {/if}
    {#if budget.localTaxModeled && budget.localMonthly > 0}
      {@render swatch(`Local ${money(budget.localMonthly)}`, 'bg-tax-local')}
    {/if}
    {@render swatch(`Take-home ${money(budget.takeHomeMonthly)}`, 'bg-green')}
  </div>

  {#if rentAmount != null}
    <div class="mb-1 text-meta text-muted">
      {actualTakeHomeMonthly != null
        ? `Your entered take-home: ${money(takeHome)}/mo`
        : 'Estimated take-home split'}
    </div>
    <div
      role="img"
      aria-label={`Take-home split: ${money(rent)} rent, ${money(remaining)} left before other expenses and savings`}
      class="mb-3 flex h-5 w-full origin-left animate-grow-x overflow-hidden"
    >
      {@render segment(rentPct, rentShare > 100 ? 'bg-red' : 'bg-accent')}
      {#if remaining > 0}
        {@render segment(leftPct, 'bg-surplus')}
      {/if}
    </div>
    <div class="mb-3 flex flex-wrap gap-x-3.5 gap-y-2 text-meta text-muted">
      {@render swatch(`Rent ${money(rent)}`, rentShare > 100 ? 'bg-red' : 'bg-accent')}
      {@render swatch(`After rent, before expenses & savings ${money(remaining)}`, 'bg-surplus')}
    </div>
    <p class="mt-1 text-sm text-ink">
      {#if takeHome > 0}
        {housing === 'shared-2br' ? housingRentLabel(city, housing) : `The ${rentLabel}`} is
        <strong class="font-bold {rentShare > 30 ? 'text-red' : 'text-green'}">
          {rentShare.toFixed(0)}%
        </strong>
        of your take-home pay.
      {:else}
        Rent is {money(rent)}/mo; entered take-home pay is $0.
      {/if}
    </p>
  {/if}

  {#if budget.stateRate === 0 || !budget.localTaxModeled}
    <p class="mt-1 text-meta text-muted">
      {#if budget.stateRate === 0}
        <span class="mr-1"
          >No state income tax on wages here — but federal tax and FICA still apply.</span
        >
      {/if}
      {#if !budget.localTaxModeled}
        Local wage taxes, if any, are not included for this city.
      {/if}
    </p>
  {/if}
</section>
