<script lang="ts">
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import type { City } from '$lib/types';
  import { money } from '$lib/format';
  import { housingRent } from '$lib/planning';
  import { housingWords, readRent } from '$lib/postcard';
  import { STATE_NAME } from '$lib/data/states';
  import CityFront from './CityFront.svelte';
  import PostcardMap from './PostcardMap.svelte';
  import Stamp from './Stamp.svelte';

  let {
    presentation,
    city,
    lead,
    oneditcosts
  }: {
    presentation: RentPlanPresentation;
    city: City;
    lead: string | null;
    oneditcosts: () => void;
  } = $props();

  let housing = $derived(presentation.options.housing);
  let words = $derived(housingWords(housing));
  let rent = $derived(housingRent(city, housing));
  let ceiling = $derived(presentation.rentTarget);
  let reading = $derived(readRent(rent, ceiling));
  let room = $derived(presentation.spendingRoom);
  let budget = $derived(presentation.budget);
  let usesGross = $derived(budget != null && ceiling != null && ceiling === budget.maxRent);
  let stateName = $derived(STATE_NAME[city.state] ?? city.state);
  let hasCosts = $derived(
    presentation.options.monthlyExpenses + presentation.options.monthlySavings > 0
  );
  let description = $derived(
    lead ??
      (city.citySnapshot
        ? `A city of ${city.citySnapshot.population.toLocaleString('en-US')} people in ${stateName}.`
        : city.pop
          ? `A place of about ${city.pop.toLocaleString('en-US')} people in ${stateName}.`
          : `${city.city}, in ${stateName}.`)
  );
  let trend = $derived(
    city.yoy == null || housing !== '1br'
      ? ''
      : city.yoy === 0
        ? ' 1-bed rent is flat from a year ago.'
        : ` 1-bed rent is ${city.yoy > 0 ? 'up' : 'down'} ${Math.abs(city.yoy)}% from a year ago.`
  );
  let stampDescription = $derived(
    rent == null
      ? `No ${words.short} rent estimate for ${city.name}`
      : ceiling == null
        ? `${words.rent} ${money(rent)}. Add a salary to compare it with a ceiling.`
        : `${words.rent} of ${money(rent)} uses ${reading.percentLabel} of your ${money(ceiling)} ceiling`
  );
</script>

<article
  class="pc-card pc-city"
  aria-label={`${city.name} at a glance`}
  data-testid="city-postcard"
>
  <div class="pc-city-front">
    <CityFront place={city} variant="hero" heading="h1" />
  </div>

  <div class="pc-city-back">
    <div class="pc-city-area">
      <p class="pc-city-lead" data-testid="city-lead">{description}</p>
      <PostcardMap {presentation} />
      <p class="pc-legend">
        <span><i class="pc-key pc-key-fits"></i> Fits</span>
        <span><i class="pc-key pc-key-tight"></i> Within 5%</span>
        <span><i class="pc-key pc-key-over"></i> Over</span>
        <span><i class="pc-key pc-key-unknown"></i> No estimate</span>
      </p>
    </div>

    <i class="pc-city-rule" aria-hidden="true"></i>

    <div class="pc-city-reading" data-testid="plan-summary" id="plan-summary">
      <div class="pc-city-stamp">
        <Stamp
          fit={reading.fit}
          share={reading.share}
          label={ceiling == null && rent != null ? money(rent) : undefined}
          description={stampDescription}
        />
        <p class="pc-city-label">{words.rent}</p>
        {#if presentation.looking && rent == null}
          <p class="pc-city-rent pc-display">…</p>
          <p class="pc-city-of" role="status">Looking up rent for {city.city}</p>
        {:else}
          <p class="pc-city-rent pc-display" data-testid="city-rent">{money(rent)}</p>
          {#if ceiling != null}
            <p class="pc-city-of">
              of a <strong data-testid="rent-ceiling">{money(ceiling)}</strong> ceiling
            </p>
          {/if}
        {/if}
        <p class="pc-city-verdict pc-display" data-testid="verdict" role="status">
          {reading.verdict}
        </p>
      </div>

      {#if budget && room}
        <div class="pc-city-pay">
          <dl>
            <div>
              <dt>Take-home</dt>
              <dd data-testid="take-home">{money(room.takeHomeMonthly)}</dd>
            </div>
            <div>
              <dt>{hasCosts ? 'Left after rent & costs' : 'Left after rent'}</dt>
              <dd data-testid="left-after-rent">
                {money(hasCosts ? room.available : room.afterRent)}
              </dd>
            </div>
          </dl>
          <p class="pc-city-note">
            Monthly, on a {money(presentation.salary)} salary.{trend}
            {usesGross ? 'Ceiling is 30% of gross pay.' : 'Ceiling is what your costs leave.'}
          </p>
          <button type="button" class="pc-btn pc-btn-quiet" onclick={oneditcosts}>
            {hasCosts || !usesGross ? 'Edit your costs' : 'Tighten with your costs'}
          </button>
        </div>
      {:else}
        <p class="pc-city-note">Put a yearly salary in the bar above to see what fits.</p>
      {/if}
    </div>
  </div>
</article>

<style>
  .pc-city {
    display: grid;
    grid-template-columns: minmax(0, 44fr) minmax(0, 56fr);
    margin-top: 0.75rem;
    overflow: hidden;
  }
  .pc-city-front {
    min-width: 0;
  }
  .pc-city-back {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 1px 16.25rem;
    gap: 1.5rem;
    padding: 1.75rem;
  }
  .pc-city-area {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.75rem;
  }
  .pc-city-lead {
    max-width: 52ch;
    margin: 0;
    color: var(--muted);
    font-size: 0.9375rem;
    line-height: 1.5;
  }
  .pc-city-rule {
    background: var(--navy);
    opacity: 0.25;
  }
  .pc-city-reading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    text-align: center;
  }
  .pc-city-stamp {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .pc-city-label {
    margin: 1.125rem 0 0;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .pc-city-rent {
    margin: 0.125rem 0 0;
    font-size: 3rem;
    font-weight: 800;
    line-height: 1;
  }
  .pc-city-of {
    margin: 0.375rem 0 0;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .pc-city-of strong {
    color: var(--navy);
  }
  .pc-city-verdict {
    margin: 1.25rem 0 0;
    font-size: 1.375rem;
    font-weight: 700;
    line-height: 1.2;
  }
  .pc-city-pay {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: center;
    gap: 0.875rem;
  }
  dl {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    margin: 0;
    padding-top: 1rem;
    border-top: 1.5px solid var(--navy);
  }
  dt {
    color: var(--muted);
    font-size: 0.8125rem;
  }
  dd {
    margin: 0.125rem 0 0;
    font-size: 1.25rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .pc-city-note {
    margin: 0;
    color: var(--muted);
    font-size: 0.8125rem;
    line-height: 1.5;
  }
  @media (max-width: 1060px) {
    .pc-city {
      grid-template-columns: minmax(0, 1fr);
    }
    .pc-city-back {
      grid-template-columns: minmax(0, 1fr);
    }
    .pc-city-rule {
      display: none;
    }
    .pc-city-reading {
      order: -1;
    }
  }
  @media (max-width: 600px) {
    .pc-city-back {
      padding: 1rem;
    }
  }
</style>
