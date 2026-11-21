<script lang="ts">
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import type { City } from '$lib/types';
  import { money } from '$lib/format';
  import { housingRent } from '$lib/planning';
  import { readRent } from '$lib/postcard';
  import { STATE_NAME } from '$lib/data/states';

  let { presentation, city }: { presentation: RentPlanPresentation; city: City } = $props();

  let budget = $derived(presentation.budget);
  let room = $derived(presentation.spendingRoom);
  let options = $derived(presentation.options);
  let ceiling = $derived(presentation.rentTarget);
  let rent = $derived(room?.rent ?? null);
  let takeHome = $derived(room?.takeHomeMonthly ?? 0);
  let costs = $derived(options.monthlyExpenses + options.monthlySavings);
  let left = $derived(rent == null ? null : takeHome - rent - costs);
  let segments = $derived.by(() => {
    if (!budget || rent == null || takeHome <= 0) return [];
    const parts = [
      { key: 'rent', label: 'Rent', amount: rent },
      ...(costs > 0 ? [{ key: 'costs', label: 'Your costs', amount: costs }] : []),
      {
        key: 'left',
        label: left != null && left < 0 ? 'Short' : 'Left for everything else',
        amount: left ?? 0
      }
    ];
    const total = Math.max(
      takeHome,
      parts.reduce((sum, part) => sum + Math.max(0, part.amount), 0)
    );
    return parts.map((part) => ({ ...part, width: (Math.max(0, part.amount) / total) * 100 }));
  });
  let taxes = $derived(
    budget
      ? [
          { label: 'Federal income tax', amount: budget.federalMonthly },
          { label: 'Social Security & Medicare', amount: budget.ficaMonthly },
          {
            label: `${STATE_NAME[city.state] ?? city.state} income tax`,
            amount: budget.stateMonthly
          },
          ...(budget.localMonthly > 0 ? [{ label: 'Local tax', amount: budget.localMonthly }] : [])
        ]
      : []
  );
  let taxTotal = $derived(taxes.reduce((sum, tax) => sum + tax.amount, 0));
  let others = $derived.by(() => {
    if (ceiling == null) return '';
    const two = housingRent(city, '2br');
    const shared = housingRent(city, 'shared-2br');
    const parts: string[] = [];
    if (options.housing !== '1br' && city.r1 != null) {
      parts.push(`a one-bedroom averages ${money(city.r1)}, which ${fitWord(city.r1)}`);
    }
    if (options.housing !== '2br' && two != null) {
      parts.push(`a two-bedroom averages ${money(two)}, which ${fitWord(two)}`);
    }
    if (options.housing !== 'shared-2br' && shared != null) {
      parts.push(`splitting one puts your share near ${money(shared)}`);
    }
    if (!parts.length) return '';
    const sentence = parts.join('; ');
    return sentence[0].toUpperCase() + sentence.slice(1) + '.';
  });

  function fitWord(amount: number) {
    const fit = readRent(amount, ceiling).fit;
    return fit === 'within' ? 'fits' : fit === 'near' ? 'is tight' : 'is over';
  }
</script>

{#if budget && room}
  <section class="pc-section" aria-labelledby="money-heading" id="money">
    <h2 id="money-heading" class="pc-h2">Where the money goes</h2>
    {#if segments.length}
      <div
        class="pc-money-bar"
        role="img"
        aria-label={`Monthly take-home of ${money(takeHome)}: ${segments
          .map((segment) => `${segment.label.toLowerCase()} ${money(segment.amount)}`)
          .join(', ')}`}
      >
        {#each segments as segment (segment.key)}
          {#if segment.width > 0}
            <div
              class="pc-money-part"
              data-part={segment.key}
              style:width={`${segment.width}%`}
              title={`${segment.label} ${money(segment.amount)}`}
            >
              <span>{segment.label} {money(segment.amount)}</span>
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      <p class="pc-lede">
        There's no rent estimate for {city.city}, so there's nothing to split yet.
      </p>
    {/if}
    <p class="pc-lede">
      Out of about {money(takeHome)} take-home a month{presentation.actualTakeHomeMonthly != null
        ? ' (the amount you entered)'
        : `, after an estimated ${money(taxTotal)} in federal, FICA and ${STATE_NAME[city.state] ?? city.state} tax`}.
      {others}
    </p>
    {#if presentation.actualTakeHomeMonthly == null}
      <dl class="pc-taxes">
        <div>
          <dt>Gross pay</dt>
          <dd>{money(budget.grossMonthly)}</dd>
        </div>
        {#each taxes as tax (tax.label)}
          <div>
            <dt>{tax.label}</dt>
            <dd>−{money(tax.amount)}</dd>
          </div>
        {/each}
        <div>
          <dt>Effective tax rate</dt>
          <dd>{(budget.effRate * 100).toFixed(1)}%</dd>
        </div>
      </dl>
    {/if}
  </section>
{/if}

<style>
  .pc-money-bar {
    display: flex;
    height: 4rem;
    margin-top: 1.75rem;
    overflow: hidden;
    border-radius: 999px;
    background: var(--card);
  }
  .pc-money-part {
    display: flex;
    min-width: 0;
    align-items: center;
    padding: 0 1.25rem;
    overflow: hidden;
    font-weight: 600;
    white-space: nowrap;
  }
  .pc-money-part span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pc-money-part[data-part='rent'] {
    background: var(--navy);
    color: #fff;
  }
  .pc-money-part[data-part='costs'] {
    background: var(--slate);
    color: var(--navy);
  }
  .pc-money-part[data-part='left'] {
    background: var(--sage);
    color: var(--navy);
  }
  .pc-lede {
    max-width: 75ch;
    margin-top: 0.875rem;
    font-size: 0.9375rem;
  }
  .pc-taxes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 2rem;
    margin: 1.25rem 0 0;
  }
  .pc-taxes dt {
    color: var(--muted);
    font-size: 0.8125rem;
  }
  .pc-taxes dd {
    margin: 0.125rem 0 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  @media (max-width: 600px) {
    .pc-money-bar {
      height: 3rem;
    }
    .pc-money-part {
      padding: 0 0.75rem;
      font-size: 0.8125rem;
    }
  }
</style>
