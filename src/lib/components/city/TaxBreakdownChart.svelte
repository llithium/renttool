<script lang="ts">
  import type { Budget, City } from '$lib/types';
  import { money, rentMetricLabel, sentenceLabel } from '$lib/format';
  import SectionHeading from '$lib/components/ui/SectionHeading.svelte';

  let {
    city,
    budget,
    class: className = ''
  }: { city: City; budget: Budget; class?: string } = $props();

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
  // Row 2: take-home = rent (median 1BR) + remaining
  let rent = $derived(city.r1 ?? 0);
  let remaining = $derived(Math.max(0, budget.takeHomeMonthly - rent));
  let rentShare = $derived(budget.takeHomeMonthly > 0 ? (rent / budget.takeHomeMonthly) * 100 : 0);
  let rentPct = $derived(Math.min(100, pct(rent, budget.takeHomeMonthly)));
  let leftPct = $derived(pct(remaining, budget.takeHomeMonthly));
  let rentLabel = $derived(sentenceLabel(rentMetricLabel(city.rentMetric, '1BR')));
</script>

<!-- Local snippets rather than extra components: the segment and swatch are used
     only inside this chart, and inlining keeps every utility visible here. -->
{#snippet segment(width: number, label: string, minLabelPct: number, tone: string)}
  <div
    class="flex min-w-0 items-center overflow-hidden px-2 text-meta font-semibold whitespace-nowrap transition-[width] duration-400 {tone}"
    style="width:{width}%"
  >
    {#if width >= minLabelPct}<span class="truncate">{label}</span>{/if}
  </div>
{/snippet}

{#snippet swatch(label: string, tone: string)}
  <span class="inline-flex items-center gap-1.5">
    <i class="inline-block size-2.5 rounded-xs {tone}"></i>{label}
  </span>
{/snippet}

<section class={className}>
  <SectionHeading title="Where the money goes" />

  <div class="mb-1 text-meta text-muted">
    Gross monthly {money(budget.grossMonthly)}{taxAmt > 0 ? ` · taxes ${money(taxAmt)}` : ''}
  </div>
  <div
    role="img"
    aria-label={`Gross monthly ${money(budget.grossMonthly)}: ${money(taxAmt)} taxes, ${money(budget.takeHomeMonthly)} take-home`}
    class="mb-2 flex h-8 w-full origin-left animate-grow-x overflow-hidden rounded-lg"
  >
    {#if budget.federalMonthly > 0}
      {@render segment(
        fedPct,
        `Federal ${money(budget.federalMonthly)}`,
        13,
        'bg-red text-accent-ink'
      )}
    {/if}
    {#if budget.ficaMonthly > 0}
      {@render segment(ficaPct, `FICA ${money(budget.ficaMonthly)}`, 13, 'bg-amber text-amber-ink')}
    {/if}
    {#if budget.stateMonthly > 0}
      {@render segment(
        statePct,
        `State ${money(budget.stateMonthly)}`,
        13,
        'bg-tax-state text-accent-ink'
      )}
    {/if}
    {#if budget.localMonthly > 0}
      {@render segment(
        localPct,
        `Local ${money(budget.localMonthly)}`,
        13,
        'bg-tax-local text-accent-ink'
      )}
    {/if}
    {@render segment(
      takePct,
      `Take-home ${money(budget.takeHomeMonthly)}`,
      0,
      'bg-green text-accent-ink'
    )}
  </div>
  <div class="mb-4 flex flex-wrap gap-x-3.5 gap-y-1 text-meta text-muted">
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
  </div>

  {#if city.r1 != null}
    <div class="mb-1 text-meta text-muted">Take-home split</div>
    <div
      role="img"
      aria-label={`Take-home split: ${money(rent)} rent, ${money(remaining)} left`}
      class="mb-2 flex h-8 w-full origin-left animate-grow-x overflow-hidden rounded-lg"
    >
      {@render segment(
        rentPct,
        rentPct >= 30 ? `Rent ${money(rent)}` : money(rent),
        14,
        `${rentShare > 100 ? 'bg-red' : 'bg-accent'} text-accent-ink`
      )}
      {#if remaining > 0}
        {@render segment(leftPct, `Left ${money(remaining)}`, 16, 'bg-surplus text-ink')}
      {/if}
    </div>
    <p class="mt-1 text-sm text-ink">
      The {rentLabel} is
      <strong class="font-bold {rentShare > 30 ? 'text-red' : 'text-green'}">
        {rentShare.toFixed(0)}%
      </strong>
      of your take-home pay.
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
