<script lang="ts">
  import type { City, NearbyPlace } from '$lib/types';
  import { fetchNearby } from '$lib/api';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import SectionHeading from '$lib/components/ui/SectionHeading.svelte';
  import CommuteFilter from './CommuteFilter.svelte';
  import { matchesCommute, type CommuteFilterResult } from '$lib/commute';
  import { money } from '$lib/format';
  import { housingRent, housingRentLabel } from '$lib/planning';

  let {
    presentation,
    city,
    class: className = ''
  }: { presentation: RentPlanPresentation; city: City; class?: string } = $props();

  let places = $state<NearbyPlace[]>([]);
  let loading = $state(false);
  let expanded = $state(false);
  let status = $state('');
  let pendingRentNames = $state<string[]>([]);
  let commute = $state<CommuteFilterResult | null>(null);
  let filteredPlaces = $derived(places.filter((place) => matchesCommute(place.label, commute)));
  let visiblePlaces = $derived(expanded ? filteredPlaces : filteredPlaces.slice(0, 4));
  let compareFull = $derived(presentation.comparisonFull);

  async function toggleComparison(place: NearbyPlace) {
    const known = presentation.cityByName(place.label);
    if (known && presentation.isComparing(known.name)) {
      presentation.removeComparison(known.name);
      status = `${known.name} removed from your comparison.`;
      return;
    }

    status = `Looking up rent for ${place.label}. Your ${city.name} plan stays open.`;
    const result = await presentation.addComparison(place);
    if (result.status === 'full') {
      status = `Comparison is full. Remove a city before adding ${result.name ?? place.label}.`;
      return;
    }
    if (result.status === 'already-compared') {
      status = `${result.name} is already in your comparison.`;
      return;
    }
    if (result.status === 'not-found') {
      status = `Could not add ${result.name} to your comparison.`;
      return;
    }

    status = result.rentAvailable
      ? `${result.name} added to comparison. Your ${city.name} plan is still selected.`
      : `${result.name} added to comparison. Rent data is not available yet.`;
  }

  // Refetch whenever the selected city (or its coords) changes; abort stale requests.
  $effect(() => {
    const { lat, lng, city: cityName, state } = city;
    pendingRentNames = [];
    commute = null;
    places = [];
    if (lat == null || lng == null) {
      places = [];
      loading = false;
      return;
    }
    const controller = new AbortController();
    loading = true;
    fetchNearby(lat, lng, cityName, state, controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      places = res;
      expanded = false;
      loading = false;
      const missingRents = res.filter((place) => {
        const known = presentation.cityByName(place.label);
        return (
          !known || (known.r1 == null && known.r2 == null && known.source !== 'apartment-list')
        );
      });
      pendingRentNames = missingRents.map((place) => place.label);
      for (const place of missingRents) {
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
  <section class={className}>
    <SectionHeading title="Explore nearby rent options">
      <span class="text-meta text-muted">SimpleMaps</span>
    </SectionHeading>
    <p class="mb-3.5 max-w-[66ch] text-sm/relaxed text-muted">
      Compare rents within roughly 25 miles of {city.city}, using your salary and housing setup.
    </p>
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
    <p aria-live="polite" class={status ? 'mb-3 text-sm text-muted' : 'sr-only'}>{status}</p>

    {#if !places.length}
      <div class="flex items-center gap-3 text-sm text-muted" aria-live="polite">
        <span class="size-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
        ></span>
        Finding nearby places…
      </div>
    {:else}
      <ol class="border-y border-line">
        {#each visiblePlaces as p (p.label)}
          {@const pending = presentation.isComparisonPending(p.label)}
          {@const compared = presentation.isComparing(p.label)}
          {@const known = presentation.cityByName(p.label)}
          {@const rent = known ? housingRent(known, presentation.options.housing) : null}
          {@const target = known ? presentation.rentTargetForCity(known) : null}
          {@const activeRent = housingRent(city, presentation.options.housing)}
          {@const difference =
            rent != null &&
            activeRent != null &&
            known?.rentMetric === city.rentMetric &&
            known?.rentYear === city.rentYear
              ? rent - activeRent
              : null}
          <li
            class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-line py-3 last:border-b-0 sm:gap-6"
          >
            <div>
              <p class="font-semibold tracking-tight text-ink">
                <span>{p.city}, {p.state}</span>
                <span class="ml-1 text-meta font-normal text-muted">{p.miles} mi</span>
                {#if commute && commute.minutes[p.label] != null}
                  <span class="text-meta font-normal"> · {commute.minutes[p.label]} min drive</span>
                {/if}
              </p>
              {#if rent != null && known}
                <p class="mt-1 text-sm tabular-nums">
                  <strong title={housingRentLabel(known, presentation.options.housing)}
                    >{money(rent)}/mo</strong
                  >
                  <span class="sr-only"
                    >{housingRentLabel(known, presentation.options.housing)}</span
                  >
                  {#if difference != null}
                    <span class="text-meta text-muted">
                      · {difference === 0
                        ? 'Same as'
                        : `${money(Math.abs(difference))} ${difference < 0 ? 'less' : 'more'} than`}
                      {city.city}
                    </span>
                  {:else}
                    <span class="text-meta text-muted"> · {known.rentArea} · {known.rentYear}</span>
                  {/if}
                </p>
                <p class="mt-1 text-meta text-muted">
                  {#if target != null}<span class={rent <= target ? 'text-green' : 'text-red'}
                      >{rent <= target ? 'Fits estimated budget' : 'Above estimated budget'}</span
                    >
                  {/if}
                </p>
              {:else}
                <p class="mt-2 text-meta text-muted" aria-live="polite">
                  {pendingRentNames.includes(p.label)
                    ? 'Checking area-level rent…'
                    : 'Rent estimate unavailable.'}
                </p>
              {/if}
            </div>
            <button
              disabled={pending || (!compared && compareFull)}
              onclick={() => toggleComparison(p)}
              class="inline-flex min-h-11 max-w-28 items-center justify-center gap-2 self-start rounded-md p-2 text-sm font-semibold transition duration-200 {pending
                ? 'cursor-default text-accent'
                : compared
                  ? 'cursor-pointer text-muted hover:bg-accent-soft hover:text-red'
                  : compareFull
                    ? 'cursor-not-allowed text-faint'
                    : 'cursor-pointer text-accent hover:bg-accent-soft hover:text-accent-deep'}"
            >
              {#if pending}
                <span
                  class="size-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
                ></span>
                Checking rent
              {:else if compared}
                Remove comparison
              {:else if compareFull}
                Comparison full
              {:else}
                Compare rent
              {/if}
            </button>
          </li>
        {/each}
      </ol>

      {#if filteredPlaces.length > 4}
        <button
          onclick={() => (expanded = !expanded)}
          class="mt-3 cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-accent hover:bg-accent-soft hover:text-accent-deep"
        >
          {expanded ? 'Show fewer places' : `Show ${filteredPlaces.length - 4} more places`}
        </button>
      {/if}
      <p class="mt-3 text-meta text-muted">
        Straight-line distances. Each nearby budget uses estimated pay at your current salary.
        Entered pay applies only to your selected city.
      </p>
    {/if}
  </section>
{/if}
