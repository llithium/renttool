<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { CitySuggestion } from '$lib/types';
  import { findSeedCity } from '$lib/data/cities';
  import { money } from '$lib/format';
  import { createCitySearchDiscovery } from './citySearchDiscovery';

  /** Median 1BR rent for a suggestion, when it maps to a known city. */
  function rentFor(label: string): string {
    const seed = findSeedCity(label);
    return seed?.r1 != null ? money(seed.r1) : '';
  }

  let {
    onselect,
    selectedName = null,
    pendingName = null
  }: {
    onselect: (sug: CitySuggestion) => void;
    selectedName?: string | null;
    pendingName?: string | null;
  } = $props();

  const discovery = createCitySearchDiscovery();
  let discoveryState = $state(discovery.state);
  const unsubscribe = discovery.subscribe((state) => (discoveryState = state));

  onDestroy(() => {
    unsubscribe();
    discovery.dispose();
  });

  // Reflect an externally-driven selection (compare table, map marker, restored
  // state) in the field. This only re-runs when selectedName actually changes, so
  // it never clobbers the query while the user is typing (typing leaves the current
  // selection untouched until they choose a suggestion).
  $effect(() => {
    if (selectedName != null) discovery.setExternalQuery(selectedName);
  });
  let awaitingSelection = $derived(
    selectedName != null &&
      discoveryState.query.trim().length >= 2 &&
      discoveryState.query.trim() !== selectedName
  );
  let planStatus = $derived(
    pendingName
      ? `Loading a rent estimate for ${pendingName}. Your current plan remains ${selectedName ?? 'unchanged'}.`
      : awaitingSelection
        ? `Choose a city from the list to update your plan. Your current plan remains ${selectedName}.`
        : ''
  );

  function onInput(e: Event) {
    discovery.input((e.target as HTMLInputElement).value);
  }

  function choose(index: number) {
    const selection = discovery.select(index);
    if (selection) onselect(selection);
  }

  function onKeydown(e: KeyboardEvent) {
    const result = discovery.handleKey(e.key);
    if (result.handled) e.preventDefault();
    if (result.selection) onselect(result.selection);
  }

  function highlight(label: string): { before: string; match: string; after: string } {
    const q = discoveryState.query.trim();
    if (!q) return { before: label, match: '', after: '' };
    const i = label.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return { before: label, match: '', after: '' };
    return {
      before: label.slice(0, i),
      match: label.slice(i, i + q.length),
      after: label.slice(i + q.length)
    };
  }
</script>

<div class="relative min-w-0">
  <label for="city-input" class="mb-2 block text-label text-muted"> City </label>
  <div class="relative">
    <input
      id="city-input"
      name="city-search"
      class="w-full rounded-lg border border-line-strong bg-card-2 py-3 pr-10 pl-3 text-body font-semibold text-ink transition-colors duration-200 placeholder:text-faint hover:border-ink focus:border-transparent focus:outline-2 focus:outline-accent"
      type="search"
      role="combobox"
      aria-expanded={discoveryState.open}
      aria-controls="city-listbox"
      aria-autocomplete="list"
      aria-activedescendant={discoveryState.open && discoveryState.activeIndex >= 0
        ? `city-option-${discoveryState.activeIndex}`
        : undefined}
      aria-busy={discoveryState.loading}
      aria-describedby={planStatus ? 'city-plan-status' : undefined}
      autocomplete="off"
      data-1p-ignore
      data-lpignore="true"
      data-form-type="other"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder="Start typing a city…"
      value={discoveryState.query}
      oninput={onInput}
      onkeydown={onKeydown}
      onfocus={() => discovery.focus()}
      onblur={() => discovery.blur()}
    />
    {#if discoveryState.loading}
      <span
        aria-hidden="true"
        class="absolute top-1/2 right-3 h-2 w-6 -translate-y-1/2 animate-pulse rounded-full bg-line-strong"
      ></span>
    {/if}
  </div>

  {#if discoveryState.open && discoveryState.suggestions.length}
    <ul
      id="city-listbox"
      role="listbox"
      class="absolute inset-x-0 top-[calc(100%+0.3125rem)] z-40 max-h-72 animate-overlay-settle overflow-y-auto rounded-xl border border-line-strong bg-card p-1.5 shadow-pop"
    >
      {#each discoveryState.suggestions as sug, i (sug.label)}
        {@const parts = highlight(sug.label)}
        <li
          id={`city-option-${i}`}
          role="option"
          aria-selected={i === discoveryState.activeIndex}
          style:animation-delay={`${Math.min(i * 24, 120)}ms`}
          class="motion-option flex cursor-pointer items-baseline justify-between gap-2.5 rounded-lg px-3 py-2.5 text-body {i ===
          discoveryState.activeIndex
            ? 'bg-accent-soft'
            : ''}"
          onmousedown={(e) => {
            e.preventDefault();
            choose(i);
          }}
          onmouseenter={() => discovery.hover(i)}
        >
          <span>
            {parts.before}{#if parts.match}<mark class="bg-transparent font-bold text-accent"
                >{parts.match}</mark
              >{/if}{parts.after}
          </span>
          {#if rentFor(sug.label)}
            <span class="text-meta whitespace-nowrap text-muted tabular-nums">
              {rentFor(sug.label)}/mo
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if discoveryState.open && !discoveryState.loading && !discoveryState.suggestions.length && discoveryState.query.trim().length >= 2}
    <p role="status" class="mt-2 text-sm text-muted">
      No matching cities. Try the full city name and state.
    </p>
  {/if}
  <span class="sr-only" aria-live="polite">
    {discoveryState.loading
      ? 'Searching cities'
      : discoveryState.open
        ? `${discoveryState.suggestions.length} city suggestions available`
        : ''}
  </span>
  {#if planStatus}
    <p id="city-plan-status" aria-live="polite" class="mt-2 text-meta text-muted">
      {planStatus}
    </p>
  {/if}
</div>
