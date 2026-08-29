<script lang="ts">
  import type { Budget, City } from '$lib/types';
  import { money, rentMetricLabel, sentenceLabel } from '$lib/format';
  import { salaryForRent } from '$lib/budget';

  let {
    budget,
    city,
    class: className = ''
  }: { budget: Budget; city: City; class?: string } = $props();

  let cushion = $derived(city.r1 != null ? budget.maxRent - city.r1 : null);
  let good = $derived(cushion != null && cushion >= 0);
  let rentLabel = $derived(sentenceLabel(rentMetricLabel(city.rentMetric, '1BR')));
  let rentLabel2 = $derived(sentenceLabel(rentMetricLabel(city.rentMetric, '2BR')));
  let rentShare = $derived(
    city.r1 != null && budget.takeHomeMonthly > 0 ? (city.r1 / budget.takeHomeMonthly) * 100 : null
  );
  let cushionLabel = $derived(
    cushion == null ? '—' : cushion >= 0 ? `${money(cushion)} under` : `${money(-cushion)} over`
  );

  // Built as one string rather than an inline {#if}: the clause has to start with
  // a space and the "else" branch with none, which template whitespace can't
  // express reliably.
  let twoBrClause = $derived(
    city.r2 != null && budget.maxRent >= city.r2
      ? ` — it even covers the ${rentLabel2} (${money(city.r2)}).`
      : '.'
  );
</script>

{#if city.r1 != null && cushion != null}
  <section
    aria-labelledby="affordability-heading"
    class="border-b border-line-strong pt-0 pb-6 md:pb-8 {className}"
  >
    <div class="flex items-start gap-4">
      <!-- No delay and no fill-mode: the status icon must be visible whether or
           not the animation ever runs. -->
      <span aria-hidden="true" class="shrink-0 animate-pop {good ? 'text-green' : 'text-red'}">
        {#if good}
          <svg class="mt-0.5 size-6" viewBox="0 0 24 24" fill="none">
            <path
              d="m5 12.5 4.5 4.5L19 7"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {:else}
          <svg class="mt-0.5 size-6" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 8v5m0 3.5v.01M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {/if}
      </span>
      <div>
        <h2 id="affordability-heading" class="mb-2 text-title {good ? 'text-green' : 'text-red'}">
          {good ? 'Fits your 30% gross-income target' : 'Above your gross-income target'}
        </h2>
        {#key `${good}-${cushion}`}
          <div class="motion-copy max-w-2xl text-body text-ink">
            {#if good}
              Your {money(budget.maxRent)} target covers the {rentLabel} ({money(city.r1)}) with
              {money(cushion)}/mo under the target{twoBrClause}
            {:else}
              The {rentLabel} ({money(city.r1)}) runs {money(-cushion)}/mo over your 30% target.
              You’d want roughly {money(salaryForRent(city.r1))}/yr for it — consider below-median
              units, a roommate, or nearby suburbs.
            {/if}
          </div>
        {/key}
      </div>
    </div>

    <dl class="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
      <div>
        <dt class="text-meta text-muted">Monthly target</dt>
        <dd class="mt-1 text-data tabular-nums">
          {money(budget.maxRent)}
        </dd>
      </div>
      <div>
        <dt class="text-meta text-muted">{rentLabel}</dt>
        <dd class="mt-1 text-data tabular-nums">{money(city.r1)}</dd>
      </div>
      <div>
        <dt class="text-meta text-muted">Market rent vs target</dt>
        <dd class="mt-1 text-data tabular-nums">{cushionLabel}</dd>
      </div>
      <div>
        <dt class="text-meta text-muted">Rent share of take-home</dt>
        <dd
          class="mt-1 text-data tabular-nums {rentShare != null && rentShare > 30
            ? 'text-red'
            : 'text-green'}"
        >
          {rentShare != null ? `${rentShare.toFixed(0)}%` : '—'}
        </dd>
      </div>
    </dl>
  </section>
{/if}
