<script lang="ts">
  import type { Budget, City } from '$lib/types';
  import { money, pctTrend, rentMetricLabel } from '$lib/format';
  import SectionHeading from '$lib/components/ui/SectionHeading.svelte';
  import { housingRent, housingRentLabel, type HousingChoice } from '$lib/planning';

  let {
    city,
    budget,
    housing = '1br',
    target = budget.maxRent,
    class: className = ''
  }: {
    city: City;
    budget: Budget;
    housing?: HousingChoice;
    target?: number;
    class?: string;
  } = $props();

  interface Bar {
    label: string;
    value: number;
    kind: 'rent' | 'budget';
  }

  let bars = $derived.by<Bar[]>(() => {
    const out: Bar[] = [];
    if (city.r1 != null)
      out.push({
        label: rentMetricLabel(city.rentMetric, '1BR').replace(' rent', ''),
        value: city.r1,
        kind: 'rent'
      });
    if (city.r2 != null)
      out.push({
        label: rentMetricLabel(city.rentMetric, '2BR').replace(' rent', ''),
        value: city.r2,
        kind: 'rent'
      });
    if (housing === 'shared-2br') {
      const rent = housingRent(city, housing);
      if (rent != null)
        out.push({ label: housingRentLabel(city, housing), value: rent, kind: 'rent' });
    }
    out.push({ label: 'Your rent ceiling', value: target, kind: 'budget' });
    return out;
  });

  let max = $derived(Math.max(...bars.map((b) => b.value), 1));

  function barTone(b: Bar): string {
    if (b.kind === 'budget') return 'bg-accent';
    return b.value <= target ? 'bg-green' : 'bg-red';
  }
</script>

<section class={className}>
  <SectionHeading title="Rent vs your budget">
    {#if city.yoy != null}
      <span
        class="text-meta font-semibold whitespace-nowrap {city.yoy > 0
          ? 'text-red'
          : city.yoy < 0
            ? 'text-green'
            : 'text-muted'}"
      >
        1BR {pctTrend(city.yoy)}
      </span>
    {/if}
  </SectionHeading>

  <div class="flex flex-col gap-3.5">
    {#each bars as b (b.label)}
      <div>
        <div class="mb-1 flex justify-between text-label">
          <span class="text-muted">{b.label}</span>
          <span class="font-semibold tracking-tight tabular-nums">{money(b.value)}</span>
        </div>
        <!-- bg-line, not bg-card-2: the track sits on the page background rather
             than inside a card, and card-2 against the canvas is almost invisible
             — an unfilled track still has to read as a bar. -->
        <div class="h-3 overflow-hidden rounded-full bg-line">
          <div
            class="motion-fill size-full origin-left animate-grow-x rounded-full {barTone(b)}"
            style:--motion-fill={Math.max(0.03, b.value / max)}
          ></div>
        </div>
      </div>
    {/each}
  </div>
</section>
