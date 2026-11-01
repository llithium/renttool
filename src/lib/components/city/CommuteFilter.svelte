<script lang="ts">
  import { onDestroy } from 'svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import type { NearbyPlace } from '$lib/types';
  import { matchesCommute, type CommuteDestination, type CommuteFilterResult } from '$lib/commute';

  let {
    places,
    onfilter
  }: { places: NearbyPlace[]; onfilter: (result: CommuteFilterResult | null) => void } = $props();
  let query = $state('');
  let destination = $state<CommuteDestination | null>(null);
  let suggestions = $state<CommuteDestination[]>([]);
  let searching = $state(false);
  let routing = $state(false);
  let message = $state('');
  let routeError = $state('');
  let maximum = $state('30');
  let minutes = $state<Record<string, number | null> | null>(null);
  let retry = $state(0);
  let searchController: AbortController | undefined;
  const options = ['15', '30', '45', '60', '90'].map((value) => ({
    value,
    label: `${value} minutes`
  }));
  let filter = $derived(minutes ? { minutes, maximum: Number(maximum) } : null);
  let matchCount = $derived(places.filter((place) => matchesCommute(place.label, filter)).length);
  let unknownCount = $derived(
    minutes ? Object.values(minutes).filter((value) => value === null).length : 0
  );

  $effect(() => onfilter(filter));

  function reset() {
    searchController?.abort();
    searching = false;
    destination = null;
    suggestions = [];
    minutes = null;
    message = '';
    routeError = '';
  }

  async function search(event: SubmitEvent) {
    event.preventDefault();
    reset();
    const controller = new AbortController();
    searchController = controller;
    searching = true;
    try {
      const response = await fetch('/api/commute-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Please wait a moment, then search again.'
            : 'Address search is unavailable. Try again.'
        );
      const data: { destinations: CommuteDestination[] } = await response.json();
      if (controller.signal.aborted) return;
      suggestions = data.destinations;
      message = suggestions.length
        ? 'Choose your destination below.'
        : 'No addresses found. Try a street address with city and state.';
    } catch (error) {
      if (!controller.signal.aborted)
        message =
          error instanceof Error ? error.message : 'Address search is unavailable. Try again.';
    } finally {
      if (!controller.signal.aborted) searching = false;
    }
  }

  $effect(() => {
    const target = destination;
    const origins = places;
    void retry;
    minutes = null;
    routeError = '';
    routing = false;
    if (!target || !origins.length) return;
    const controller = new AbortController();
    routing = true;
    void (async () => {
      try {
        const response = await fetch('/api/commute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: target,
            origins: origins.map(({ lat, lng }) => ({ lat, lng }))
          }),
          signal: controller.signal
        });
        if (!response.ok)
          throw new Error(
            response.status === 429
              ? 'Please wait a moment, then retry.'
              : 'Driving times are unavailable. Retry to filter nearby cities.'
          );
        const data: { minutes: (number | null)[] } = await response.json();
        if (controller.signal.aborted) return;
        minutes = Object.fromEntries(
          origins.map((place, index) => [place.label, data.minutes[index]])
        );
      } catch (error) {
        if (!controller.signal.aborted)
          routeError = error instanceof Error ? error.message : 'Driving times are unavailable.';
      } finally {
        if (!controller.signal.aborted) routing = false;
      }
    })();
    return () => controller.abort();
  });
  onDestroy(() => searchController?.abort());
</script>

<div class="mb-5 border-b border-line pb-5">
  <form onsubmit={search}>
    <label for="commute-address" class="mb-2 block text-sm font-semibold text-ink"
      >Commute time</label
    >
    <div class="flex gap-2">
      <div class="relative min-w-0 flex-1">
        <input
          id="commute-address"
          type="search"
          bind:value={query}
          oninput={reset}
          placeholder="Enter address, city, state or ZIP code"
          aria-label="Commute destination"
          autocomplete="off"
          required
          minlength="2"
          maxlength="200"
          class="min-h-12 w-full rounded-lg border border-line-strong bg-card py-3 pr-10 pl-3 text-sm text-ink placeholder:text-muted"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          class="pointer-events-none absolute top-3.5 right-3 size-5 text-muted"
        >
          <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle
            cx="12"
            cy="10"
            r="2.5"
          />
        </svg>
      </div>
      <button
        type="submit"
        disabled={searching || query.trim().length < 2}
        class="shrink-0 cursor-pointer rounded-lg bg-primary px-3 text-sm font-semibold text-primary-ink disabled:cursor-default disabled:opacity-50"
        >{searching ? 'Searching…' : 'Find'}</button
      >
    </div>
  </form>
  <p aria-live="polite" class="mt-2 text-sm text-muted">{message}</p>
  {#if suggestions.length}
    <ul
      aria-label="Commute destinations"
      class="mt-2 overflow-hidden rounded-lg border border-line-strong"
    >
      {#each suggestions as suggestion (suggestion.label)}
        <li class="border-b border-line last:border-b-0">
          <button
            type="button"
            class="min-h-11 w-full cursor-pointer p-3 text-left text-sm hover:bg-card-2"
            onclick={() => {
              destination = suggestion;
              query = suggestion.label;
              suggestions = [];
              message = '';
            }}
          >
            {suggestion.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <details class="mt-2">
    <summary class="min-h-10 cursor-pointer py-2 text-sm font-semibold text-accent"
      >Show commute filters</summary
    >
    <div class="mt-2 max-w-xs">
      <Select
        id="commute-maximum"
        label="Maximum drive time"
        value={maximum}
        {options}
        onchange={(value) => (maximum = value)}
      />
    </div>
  </details>
  {#if destination}
    <div class="mt-2 flex items-start justify-between gap-3">
      <p class="text-sm text-ink">Driving to <strong>{destination.label}</strong></p>
      <button
        type="button"
        onclick={() => {
          reset();
          query = '';
        }}
        class="min-h-10 shrink-0 cursor-pointer rounded-md px-2 text-sm font-semibold text-accent hover:bg-accent-soft"
        >Clear</button
      >
    </div>
  {/if}
  <div aria-live="polite" class="text-sm text-muted">
    {#if routing}<p class="mt-2">Calculating driving times… Nearby cities are not filtered yet.</p>
    {:else if routeError}<p class="mt-2">{routeError} Showing all nearby cities.</p>
      <button
        type="button"
        onclick={() => (retry += 1)}
        class="min-h-10 cursor-pointer rounded-md px-2 font-semibold text-accent hover:bg-accent-soft"
        >Retry driving times</button
      >
    {:else if filter}
      <p class="mt-2">
        {matchCount} of {places.length} nearby cities within {maximum} minutes.{unknownCount
          ? ` ${unknownCount} without a route excluded.`
          : ''}
      </p>
      {#if !matchCount}<p class="mt-2">
          Increase the drive-time limit or choose another destination.
        </p>{/if}
    {/if}
  </div>
  <p class="mt-2 text-meta text-muted">
    City-center driving estimates, without live traffic. This filters only the nearby list, not the
    map or listing sites.
  </p>
  <p class="mt-1 text-meta text-muted">
    Address search: Photon. Routes: <a
      href="https://routing.openstreetmap.de/about.html"
      target="_blank"
      rel="noreferrer"
      class="underline">OSRM / FOSSGIS</a
    >. ©
    <a
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer"
      class="underline">OpenStreetMap contributors</a
    >
    ·
    <a
      href="https://www.openstreetmap.org/fixthemap"
      target="_blank"
      rel="noreferrer"
      class="underline">Fix the map</a
    >
  </p>
</div>
