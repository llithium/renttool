<script lang="ts">
  import type { City } from '$lib/types';
  import { money } from '$lib/format';
  import { housingRent, type HousingChoice } from '$lib/planning';
  import { housingWords, readRent } from '$lib/postcard';
  import { STATE_NAME } from '$lib/data/states';
  import CityFront from './CityFront.svelte';
  import Stamp from './Stamp.svelte';

  /** A small two-sided postcard for the home gallery. */
  let {
    city,
    ceiling,
    housing,
    miles = null,
    href,
    onopen,
    comparing,
    compareFull,
    oncompare
  }: {
    city: City;
    ceiling: number | null;
    housing: HousingChoice;
    miles?: number | null;
    href: string;
    onopen: (event: MouseEvent) => void;
    comparing: boolean;
    compareFull: boolean;
    oncompare: () => void;
  } = $props();

  let words = $derived(housingWords(housing));
  let rent = $derived(housingRent(city, housing));
  let reading = $derived(readRent(rent, ceiling));
  let other = $derived(
    housing === '1br'
      ? city.r2 != null
        ? `2-bed ${money(city.r2)}`
        : ''
      : city.r1 != null
        ? `1-bed ${money(city.r1)}`
        : ''
  );
  let trend = $derived(
    city.yoy == null
      ? ''
      : city.yoy === 0
        ? 'flat in a year'
        : `${city.yoy > 0 ? '+' : '−'}${Math.abs(city.yoy)}% in a year`
  );
</script>

<article class="pc-card pc-mini" data-testid="gallery-card">
  <CityFront
    place={city}
    variant="mini"
    heading="h3"
    detail={`${STATE_NAME[city.state] ?? city.state}${miles != null ? ` · ${Math.round(miles).toLocaleString('en-US')} mi away` : ''}`}
  />
  <div class="pc-mini-back">
    <Stamp
      size={96}
      fit={reading.fit}
      share={reading.share}
      label={ceiling == null ? money(rent) : undefined}
      description={ceiling == null
        ? `${words.rent} ${money(rent)}`
        : `${words.rent} uses ${reading.percentLabel} of your ceiling`}
    />
    <div>
      <p class="pc-mini-rent pc-display">{money(rent)}</p>
      <p class="pc-mini-of">{words.rent}{ceiling != null ? ` of ${money(ceiling)}` : ''}</p>
      <p class="pc-mini-verdict pc-display">{reading.shortVerdict}</p>
    </div>
  </div>
  <div class="pc-mini-foot">
    {#if other || trend}<span class="pc-mini-more">{[other, trend].filter(Boolean).join(', ')}</span
      >{/if}
    <span class="pc-mini-acts">
      <button
        type="button"
        onclick={oncompare}
        disabled={!comparing && compareFull}
        aria-label={comparing
          ? `Remove ${city.name} from comparison`
          : compareFull
            ? `Comparison full, can't add ${city.name}`
            : `Add ${city.name} to comparison`}
        aria-pressed={comparing}>{comparing ? '✓ Comparing' : '+ Compare'}</button
      >
      <a {href} onclick={onopen}>Open {city.city}</a>
    </span>
  </div>
</article>

<style>
  .pc-mini {
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
  }
  .pc-mini-back {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    padding: 1.125rem;
  }
  .pc-mini-rent {
    margin: 0;
    font-size: 2.125rem;
    font-weight: 800;
    line-height: 1;
  }
  .pc-mini-of {
    margin: 0.25rem 0 0;
    color: var(--muted);
    font-size: 0.8125rem;
  }
  .pc-mini-verdict {
    margin: 0.625rem 0 0;
    font-size: 1.125rem;
    font-weight: 700;
    line-height: 1.2;
  }
  .pc-mini-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 0.625rem;
    margin-top: auto;
    padding: 0.75rem 1.125rem 1rem;
    border-top: 1px solid var(--line);
    font-size: 0.8125rem;
  }
  .pc-mini-more {
    flex-basis: 100%;
    color: var(--muted);
  }
  .pc-mini-acts {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 0.875rem;
  }
  .pc-mini-acts button,
  .pc-mini-acts a {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    padding: 0;
    border: 0;
    background: none;
    color: var(--navy);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }
  .pc-mini-acts a {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .pc-mini-acts button[disabled] {
    color: var(--muted);
    cursor: not-allowed;
  }
</style>
