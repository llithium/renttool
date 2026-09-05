<script lang="ts">
  import type { City, NearbyPlace } from '$lib/types';
  import { fetchNearby } from '$lib/api';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import SectionHeading from '$lib/components/ui/SectionHeading.svelte';

  let {
    presentation,
    city,
    class: className = ''
  }: { presentation: RentPlanPresentation; city: City; class?: string } = $props();

  /** Compact population label: 1.2M / 15k / 850. */
  function fmtPop(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(n);
  }

  let places = $state<NearbyPlace[]>([]);
  let loading = $state(false);
  let expanded = $state(false);
  let status = $state('');
  let visiblePlaces = $derived(expanded ? places : places.slice(0, 4));
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
    if (lat == null || lng == null) {
      places = [];
      loading = false;
      return;
    }
    const controller = new AbortController();
    loading = true;
    // Keep the current chips on screen until the replacement arrives — clearing
    // them here would collapse the card to the loading line and back on every
    // click, which reads as a flash. The swap below is atomic.
    fetchNearby(lat, lng, cityName, state, controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      places = res;
      expanded = false;
      loading = false;
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
      Keep {city.city} as your active plan while you add a nearby place to compare. Distances are straight-line,
      within roughly 25 miles.
    </p>
    <p aria-live="polite" class="mb-3 text-sm text-muted">{status}</p>

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
          <li
            class="grid gap-3 border-b border-line px-0 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
          >
            <div>
              <p class="font-semibold tracking-tight text-ink">{p.city}, {p.state}</p>
              <p class="mt-1 text-meta text-muted tabular-nums">
                {#if p.pop != null}{fmtPop(p.pop)} population ·
                {/if}{p.miles} mi away
              </p>
            </div>
            <button
              disabled={pending || (!compared && compareFull)}
              onclick={() => toggleComparison(p)}
              class="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border px-3 py-2 text-sm font-semibold transition duration-200 sm:self-auto {pending
                ? 'cursor-default border-accent bg-accent-soft text-accent'
                : compared
                  ? 'cursor-pointer border-line-strong bg-card-2 text-ink hover:border-red hover:text-red'
                  : compareFull
                    ? 'cursor-not-allowed border-line bg-card-2 text-faint'
                    : 'cursor-pointer border-line-strong text-ink hover:border-accent hover:bg-accent-soft hover:text-accent'}"
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

      {#if places.length > 4}
        <button
          onclick={() => (expanded = !expanded)}
          class="mt-3 cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-accent hover:bg-accent-soft hover:text-accent-deep"
        >
          {expanded ? 'Show fewer places' : `Show ${places.length - 4} more places`}
        </button>
      {/if}
    {/if}
  </section>
{/if}
