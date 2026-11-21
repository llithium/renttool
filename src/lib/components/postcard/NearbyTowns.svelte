<script lang="ts">
  import type { City, NearbyPlace } from '$lib/types';
  import { fetchNearby } from '$lib/api';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import CommuteFilter from '$lib/components/city/CommuteFilter.svelte';
  import { matchesCommute, type CommuteFilterResult } from '$lib/commute';
  import { money } from '$lib/format';
  import { housingRent } from '$lib/planning';
  import { housingWords, readRent } from '$lib/postcard';

  /** The towns around the active city, each measured against the same ceiling. */
  let { presentation, city }: { presentation: RentPlanPresentation; city: City } = $props();

  const SHOWN = 10;
  let places = $state<NearbyPlace[]>([]);
  let loading = $state(false);
  let expanded = $state(false);
  let status = $state('');
  let pendingRentNames = $state<string[]>([]);
  let commute = $state<CommuteFilterResult | null>(null);
  let filtered = $derived(places.filter((place) => matchesCommute(place.label, commute)));
  let visible = $derived(expanded ? filtered : filtered.slice(0, SHOWN));
  let words = $derived(housingWords(presentation.options.housing));
  let ceiling = $derived(presentation.rentTarget);
  let rows = $derived(
    visible.map((place) => {
      const known = presentation.cityByName(place.label);
      const rent = known ? housingRent(known, presentation.options.housing) : null;
      const target = known ? presentation.rentTargetForCity(known) : ceiling;
      return { place, known, rent, target, reading: readRent(rent, target) };
    })
  );
  // The meter's right edge sits a little past the largest of rent and ceiling.
  let scale = $derived(
    Math.max(
      ceiling ?? 0,
      ...rows.map((row) => row.rent ?? 0),
      ...rows.map((row) => row.target ?? 0)
    ) * 1.08 || 1
  );

  async function toggleComparison(place: NearbyPlace) {
    const known = presentation.cityByName(place.label);
    if (known && presentation.isComparing(known.name)) {
      presentation.removeComparison(known.name);
      status = `${known.name} removed from your comparison.`;
      return;
    }
    status = `Adding ${place.label}…`;
    const result = await presentation.addComparison(place);
    status =
      result.status === 'full'
        ? `Your comparison is full. Remove a city before adding ${result.name ?? place.label}.`
        : result.status === 'already-compared'
          ? `${result.name} is already in your comparison.`
          : result.status === 'not-found'
            ? `Couldn't add ${result.name}.`
            : result.rentAvailable
              ? `${result.name} added to your comparison.`
              : `${result.name} added. There's no rent estimate for it yet.`;
  }

  $effect(() => {
    const { lat, lng, city: cityName, state } = city;
    pendingRentNames = [];
    commute = null;
    places = [];
    if (lat == null || lng == null) {
      loading = false;
      return;
    }
    const controller = new AbortController();
    loading = true;
    fetchNearby(lat, lng, cityName, state, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      places = [...result].sort((a, b) => a.miles - b.miles);
      expanded = false;
      loading = false;
      const missing = result.filter((place) => {
        const known = presentation.cityByName(place.label);
        return (
          !known || (known.r1 == null && known.r2 == null && known.source !== 'apartment-list')
        );
      });
      pendingRentNames = missing.map((place) => place.label);
      for (const place of missing) {
        void presentation.checkRent(place, controller.signal).finally(() => {
          if (controller.signal.aborted) return;
          pendingRentNames = pendingRentNames.filter((name) => name !== place.label);
        });
      }
    });
    return () => controller.abort();
  });
</script>

{#if city.lat != null && city.lng != null && (loading || places.length)}
  <section class="pc-section" aria-labelledby="nearby-heading" id="nearby-options">
    <h2 id="nearby-heading" class="pc-h2">Nearby towns against your ceiling</h2>
    <p class="pc-lede">
      Places within about 25 miles of {city.city}, nearest first{ceiling != null
        ? `. The dark tick is your ${money(ceiling)} ceiling.`
        : '.'}
    </p>

    <div class="pc-panel pc-near-commute">
      {#key city.name}
        <CommuteFilter
          {places}
          {presentation}
          onfilter={(result) => {
            commute = result;
            expanded = false;
          }}
        />
      {/key}
    </div>

    <p aria-live="polite" class={status ? 'pc-near-status' : 'sr-only'}>{status}</p>

    {#if !places.length}
      <p class="pc-lede" aria-live="polite">Finding nearby places…</p>
    {:else}
      <div class="pc-panel pc-near-table">
        <table>
          <caption class="sr-only"
            >Nearby towns, {words.rent}, and how it compares with your ceiling</caption
          >
          <thead>
            <tr>
              <th scope="col">Town</th>
              <th scope="col">Distance</th>
              {#if commute}<th scope="col">Drive</th>{/if}
              <th scope="col">{words.short}</th>
              <th scope="col" class="pc-near-meter-col">Rent against ceiling</th>
              <th scope="col"><span class="sr-only">Compare</span></th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row (row.place.label)}
              {@const pending = presentation.isComparisonPending(row.place.label)}
              {@const compared = presentation.isComparing(row.place.label)}
              <tr data-fit={row.reading.fit}>
                <th scope="row">
                  {#if row.known}
                    <button
                      type="button"
                      class="pc-near-town"
                      onclick={() => presentation.selectCity(row.known!.name)}
                      >{row.place.city}</button
                    >
                  {:else}{row.place.city}{/if}
                  <span class="pc-near-state">{row.place.state}</span>
                </th>
                <td>{row.place.miles} mi</td>
                {#if commute}<td
                    >{commute.minutes[row.place.label] != null
                      ? `${commute.minutes[row.place.label]} min`
                      : '—'}</td
                  >{/if}
                <td class="pc-near-rent">
                  {#if row.rent != null}{money(
                      row.rent
                    )}{:else if pendingRentNames.includes(row.place.label)}<span
                      class="pc-near-muted">Checking…</span
                    >{:else}<span class="pc-near-muted">No estimate</span>{/if}
                </td>
                <td>
                  {#if row.rent != null}
                    <div
                      class="pc-meter"
                      role="img"
                      aria-label={row.target != null
                        ? `${money(row.rent)} against a ${money(row.target)} ceiling: ${row.reading.shortVerdict}`
                        : `${money(row.rent)}`}
                    >
                      <i style:width={`${Math.min(100, (row.rent / scale) * 100)}%`}></i>
                      {#if row.target != null}<u style:left={`${(row.target / scale) * 100}%`}
                        ></u>{/if}
                    </div>
                    <span class="pc-near-verdict">{row.reading.shortVerdict}</span>
                  {/if}
                </td>
                <td class="pc-near-action">
                  <button
                    type="button"
                    class="pc-btn pc-btn-quiet"
                    disabled={pending || (!compared && presentation.comparisonFull)}
                    aria-label={compared
                      ? `Remove ${row.place.label} from comparison`
                      : `Compare ${row.place.label}`}
                    onclick={() => toggleComparison(row.place)}
                  >
                    {pending
                      ? 'Adding…'
                      : compared
                        ? 'Remove'
                        : presentation.comparisonFull
                          ? 'Compare full'
                          : 'Compare'}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if filtered.length > SHOWN}
        <button type="button" class="pc-btn pc-near-more" onclick={() => (expanded = !expanded)}>
          {expanded ? 'Show fewer towns' : `Show ${filtered.length - SHOWN} more towns`}
        </button>
      {/if}
      <p class="pc-near-foot">
        Straight-line distances. Each town's ceiling uses estimated pay at your salary; take-home
        you entered applies only to {city.city}.
      </p>
    {/if}
  </section>
{/if}

<style>
  .pc-near-commute {
    padding: 1.25rem 1.5rem 0.5rem;
  }
  .pc-near-status {
    margin: 1rem 0 0;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .pc-near-table {
    position: relative;
    overflow-x: auto;
  }
  table {
    width: 100%;
    min-width: 46rem;
    border-collapse: collapse;
    font-size: 0.9375rem;
  }
  thead th {
    padding: 0.875rem 1.25rem;
    border-bottom: 1.5px solid var(--navy);
    color: var(--muted);
    font-size: 0.8125rem;
    font-weight: 500;
    text-align: left;
  }
  .pc-near-meter-col {
    width: 34%;
  }
  tbody th,
  td {
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: middle;
  }
  tbody tr:last-child > * {
    border-bottom: 0;
  }
  tbody th {
    font-weight: 600;
    white-space: nowrap;
  }
  .pc-near-town {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: #c5cdd5;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .pc-near-town:hover {
    text-decoration-color: var(--navy);
  }
  .pc-near-state {
    margin-left: 0.25rem;
    color: var(--muted);
    font-size: 0.8125rem;
    font-weight: 400;
  }
  .pc-near-rent {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .pc-near-muted,
  .pc-near-verdict {
    color: var(--muted);
    font-size: 0.8125rem;
  }
  .pc-near-verdict {
    display: block;
    margin-top: 0.25rem;
  }
  .pc-meter {
    position: relative;
    height: 0.75rem;
    border-radius: 6px;
    background: #edf0f3;
  }
  .pc-meter i {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    border-radius: 6px;
    background: var(--pink);
  }
  [data-fit='near'] .pc-meter i {
    background: #fff;
    box-shadow: inset 0 0 0 3px var(--navy);
  }
  [data-fit='above'] .pc-meter i {
    background: var(--slate);
  }
  [data-fit='unknown'] .pc-meter i {
    background: #c5cdd5;
  }
  .pc-meter u {
    position: absolute;
    top: -5px;
    bottom: -5px;
    width: 3px;
    margin-left: -1.5px;
    border-radius: 2px;
    background: var(--navy);
  }
  .pc-near-action {
    text-align: right;
  }
  .pc-near-more {
    margin-top: 1rem;
  }
  .pc-near-foot {
    margin: 0.875rem 0 0;
    color: var(--muted);
    font-size: 0.8125rem;
  }
  @media (max-width: 600px) {
    .pc-near-commute {
      padding: 1rem 1rem 0.25rem;
    }
  }
</style>
