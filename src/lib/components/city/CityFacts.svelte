<script lang="ts">
  import type { City, Stat } from '$lib/types';
  import { money, pctTrend, rentMetricLabel } from '$lib/format';
  import { ACS_DATA_META } from '$lib/data/cities';
  import { STATE_NAME } from '$lib/data/states';
  import SectionHeading from '$lib/components/ui/SectionHeading.svelte';
  import StatGrid from '$lib/components/ui/StatGrid.svelte';

  let {
    city,
    looking,
    class: className = ''
  }: { city: City; looking: boolean; class?: string } = $props();

  let wikiUrl = $derived.by(() => {
    const query = `${city.city}, ${STATE_NAME[city.state] ?? city.state}`;
    return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}&go=Go`;
  });

  // Metric-aware labels keep Apartment List estimates distinct from HUD FMRs.
  let rentFacts = $derived.by((): Stat[] =>
    [
      { label: rentMetricLabel(city.rentMetric, '1BR'), value: money(city.r1) },
      { label: rentMetricLabel(city.rentMetric, '2BR'), value: money(city.r2) },
      {
        label: '1BR trend',
        value: pctTrend(city.yoy),
        tone: city.yoy == null || city.yoy === 0 ? undefined : city.yoy > 0 ? 'up' : 'down'
      } satisfies Stat,
      ...(!city.citySnapshot && city.pop != null
        ? [
            {
              label: 'Population',
              value: city.pop.toLocaleString('en-US')
            }
          ]
        : [])
    ].filter((f) => f.value && f.value !== '—')
  );

  let snapshotFacts = $derived.by((): Stat[] => {
    const f = city.citySnapshot;
    if (!f) return [];
    return [
      { label: 'Population', value: f.population.toLocaleString('en-US') },
      { label: 'Median household income', value: money(f.householdIncome) },
      {
        label: 'Mean commute',
        value: f.commuteMinutes == null ? '' : `${f.commuteMinutes.toFixed(1)} min`
      },
      {
        label: 'Renter-occupied homes',
        value: f.renterShare == null ? '' : `${f.renterShare.toFixed(1)}%`
      },
      {
        label: 'Rental vacancy rate',
        value: f.rentalVacancy == null ? '' : `${f.rentalVacancy.toFixed(1)}%`
      }
    ].filter((fact) => fact.value);
  });
</script>

<section class="@container {className}">
  {#if looking}
    <p class="mb-4 text-sm/relaxed text-muted">Looking up rent data for this city…</p>
  {:else if city.r1 == null}
    <p class="mb-4 text-sm/relaxed text-muted">
      No rent figure available for this city — the search links below still work.
    </p>
  {/if}

  {#if rentFacts.length}
    <StatGrid stats={rentFacts} size="lead" class="grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]" />
  {/if}

  {#if city.rentArea || city.rentYear}
    <p class="mt-3.5 text-meta text-muted">
      {city.rentArea}{city.rentYear ? ` · ${city.rentYear}` : ''}
    </p>
  {/if}

  <div class="mt-7 border-t border-line pt-6">
    <div>
      {#if snapshotFacts.length}
        <SectionHeading title="City snapshot" class="mb-3.5">
          {#if city.citySnapshot}
            <a
              href={ACS_DATA_META.dataUrl}
              target="_blank"
              rel="noopener"
              class="text-meta text-accent underline decoration-1 underline-offset-2 hover:text-accent-deep"
            >
              {ACS_DATA_META.label} ↗
            </a>
          {/if}
        </SectionHeading>
        <!-- Five across on a wide results column, two across (last cell full width)
             once the column itself gets narrow — a container query, so it tracks the
             column rather than the viewport. -->
        <StatGrid
          stats={snapshotFacts}
          class="grid-cols-5 @max-2xl:grid-cols-2 @max-2xl:[&>*:last-child]:col-span-full"
        />
        {#if city.citySnapshot}
          <p class="mt-3.5 text-meta text-muted">{ACS_DATA_META.geography} · U.S. Census Bureau</p>
        {/if}
      {/if}

      <a
        href={wikiUrl}
        target="_blank"
        rel="noopener"
        class="{snapshotFacts.length
          ? 'mt-5'
          : ''} inline-block text-label text-accent hover:text-accent-deep hover:underline"
      >
        Read about {city.city} on Wikipedia ↗
      </a>
    </div>
  </div>
</section>
