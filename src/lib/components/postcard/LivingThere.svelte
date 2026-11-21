<script lang="ts">
  import type { City } from '$lib/types';
  import { money } from '$lib/format';
  import { STATE_NAME } from '$lib/data/states';
  import { googleMapsUrl } from '$lib/postcard';
  import { wikipediaUrl } from '$lib/wikipedia';

  let { city, story, articleUrl }: { city: City; story: string | null; articleUrl: string | null } =
    $props();

  let stateName = $derived(STATE_NAME[city.state] ?? city.state);
  let facts = $derived.by(() => {
    const snapshot = city.citySnapshot;
    const list: { label: string; value: string }[] = [];
    const population = snapshot?.population ?? city.pop;
    if (population != null)
      list.push({ label: 'Population', value: population.toLocaleString('en-US') });
    if (snapshot) {
      list.push({ label: 'Median household income', value: money(snapshot.householdIncome) });
      if (snapshot.commuteMinutes != null)
        list.push({ label: 'Average commute', value: `${snapshot.commuteMinutes.toFixed(1)} min` });
      if (snapshot.renterShare != null)
        list.push({ label: 'Homes that are rented', value: `${snapshot.renterShare.toFixed(1)}%` });
      if (snapshot.rentalVacancy != null)
        list.push({
          label: 'Rentals sitting empty',
          value: `${snapshot.rentalVacancy.toFixed(1)}%`
        });
    }
    if (city.r1 != null) list.push({ label: '1-bed rent', value: money(city.r1) });
    if (city.r2 != null) list.push({ label: '2-bed rent', value: money(city.r2) });
    if (city.yoy != null)
      list.push({
        label: '1-bed rent, past year',
        value: city.yoy === 0 ? 'Flat' : `${city.yoy > 0 ? '+' : '−'}${Math.abs(city.yoy)}%`
      });
    if (city.tax) list.push({ label: 'State income tax', value: city.tax });
    return list;
  });
</script>

<section class="pc-section" aria-labelledby="living-heading" id="city-details">
  <h2 id="living-heading" class="pc-h2">Living there</h2>
  <div class="pc-living">
    <div>
      {#if story}
        <p class="pc-living-story">{story}</p>
        <p class="pc-living-src">
          From Wikipedia{city.citySnapshot ? ' and the Census Bureau' : ''}
        </p>
      {:else}
        <p class="pc-living-story">
          {city.city} is in {stateName}. Read up on the place, or open it on a map to see what's
          around.
        </p>
      {/if}
      <div class="pc-living-links">
        <a
          class="pc-btn pc-btn-lg"
          href={articleUrl ?? wikipediaUrl(city)}
          target="_blank"
          rel="noopener">Wikipedia</a
        >
        <a class="pc-btn pc-btn-lg" href={googleMapsUrl(city)} target="_blank" rel="noopener"
          >Google Maps</a
        >
      </div>
    </div>
    {#if facts.length}
      <dl data-testid="city-facts">
        {#each facts as fact (fact.label)}
          <div>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        {/each}
      </dl>
    {/if}
  </div>
  {#if city.rentArea || city.rentYear}
    <p class="pc-living-src">
      Rent: {city.rentArea}{city.rentYear ? `, ${city.rentYear}` : ''}{city.rentMetric ===
      'fair-market-rent'
        ? '. HUD Fair Market Rents are area-wide 40th-percentile rents with utilities.'
        : ''}
    </p>
  {/if}
</section>

<style>
  .pc-living {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 3.5rem;
    margin-top: 1.5rem;
  }
  .pc-living-story {
    max-width: 52ch;
    margin: 0;
    font-size: 1.25rem;
    line-height: 1.55;
  }
  .pc-living-src {
    margin: 0.75rem 0 0;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .pc-living-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 2rem;
    margin: 0;
    align-content: start;
  }
  dl > div {
    padding: 0.875rem 0;
    border-bottom: 1.5px solid var(--navy);
  }
  dt {
    color: var(--muted);
    font-size: 0.875rem;
  }
  dd {
    margin: 0.25rem 0 0;
    font-size: 1.625rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  dl > div:has(dd:not(:empty)) dd {
    line-height: 1.2;
  }
  @media (max-width: 1060px) {
    .pc-living {
      grid-template-columns: minmax(0, 1fr);
      gap: 2rem;
    }
  }
  @media (max-width: 600px) {
    .pc-living-story {
      font-size: 1.0625rem;
    }
    dd {
      font-size: 1.25rem;
    }
  }
</style>
