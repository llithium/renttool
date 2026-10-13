<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import type { CitySuggestion } from '$lib/types';
  import { STATE_NAME } from '$lib/data/states';
  import { findSeedCity, RENT_DATA_META } from '$lib/data/cities';
  import { money } from '$lib/format';
  import { createCitySearchDiscovery } from './citySearchDiscovery';
  import { housingRent, housingShortLabel, type HousingChoice } from '$lib/planning';

  let {
    onselect,
    selectedName = null,
    pendingName = null,
    housing = '1br'
  }: {
    onselect: (sug: CitySuggestion) => void;
    selectedName?: string | null;
    pendingName?: string | null;
    housing?: HousingChoice;
  } = $props();

  let input: HTMLInputElement;
  let popup = $state<HTMLDivElement>();
  let list = $state<HTMLUListElement>();
  let popupStyle = $state('');
  let listHeight = $state(320);
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

  function positionSuggestions() {
    const rect = input.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const flip = below < 240 && above > below;
    const height = Math.max(100, Math.min(400, flip ? above : below));
    const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    listHeight = height - 44;
    popupStyle = `left:${left}px;${flip ? 'bottom' : 'top'}:${flip ? window.innerHeight - rect.top + 6 : rect.bottom + 6}px;width:${width}px`;
  }

  $effect(() => {
    if (!discoveryState.open || !discoveryState.suggestions.length || !popup) return;
    positionSuggestions();
    popup.showPopover?.();
    window.addEventListener('resize', positionSuggestions);
    window.addEventListener('scroll', positionSuggestions, true);
    return () => {
      window.removeEventListener('resize', positionSuggestions);
      window.removeEventListener('scroll', positionSuggestions, true);
    };
  });

  $effect(() => {
    const index = discoveryState.activeIndex;
    if (!discoveryState.open || !list) return;
    void tick().then(() => {
      const option = list?.querySelector<HTMLElement>(`[data-index="${index}"]`);
      if (!list || !option) return;
      if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    });
  });

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
    const q = discoveryState.query.split(',')[0].trim();
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
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
      ><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5" /><path
        d="m13 13 4 4"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      /></svg
    >
    <input
      bind:this={input}
      id="city-input"
      name="city-search"
      class="w-full appearance-none rounded-xl border border-line-strong bg-card-2 py-3 pr-20 pl-10 text-body font-semibold text-ink transition-colors duration-200 placeholder:text-faint hover:border-ink focus:border-transparent focus:outline-2 focus:outline-accent [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
      type="search"
      role="combobox"
      aria-expanded={discoveryState.open}
      aria-controls={discoveryState.open && discoveryState.suggestions.length
        ? 'city-listbox'
        : undefined}
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
      placeholder="City or city, state"
      value={discoveryState.query}
      oninput={onInput}
      onkeydown={onKeydown}
      onfocus={(event) => {
        discovery.focus();
        if (selectedName && discoveryState.query === selectedName) event.currentTarget.select();
      }}
      onblur={() => discovery.blur()}
    />
    <div class="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
      {#if discoveryState.loading}<span
          aria-hidden="true"
          class="mr-1 size-3 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
        ></span>{/if}
      {#if discoveryState.query}<button
          type="button"
          aria-label="Clear city search"
          onclick={() => {
            discovery.input('');
            input.focus();
          }}
          class="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-card hover:text-ink"
          ><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" class="size-4"
            ><path
              d="m6 6 8 8m0-8-8 8"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            /></svg
          ></button
        >{/if}
    </div>
  </div>

  {#if discoveryState.open && discoveryState.suggestions.length}
    <div
      bind:this={popup}
      popover="manual"
      style={popupStyle}
      class="fixed inset-auto z-50 m-0 overflow-hidden rounded-xl border border-line-strong bg-card text-ink shadow-pop"
    >
      <ul
        bind:this={list}
        id="city-listbox"
        role="listbox"
        aria-label="City suggestions"
        style:max-height={`${listHeight}px`}
        class="relative overflow-y-auto overscroll-contain p-1.5"
      >
        {#each discoveryState.suggestions as sug, i (sug.label)}
          {@const parts = highlight(sug.label)}
          {@const known = findSeedCity(sug.label)}
          {@const rent = known ? housingRent(known, housing) : null}
          <li
            id={`city-option-${i}`}
            role="option"
            aria-label={sug.label}
            aria-describedby={`city-option-state-${i} city-option-rent-${i}`}
            aria-selected={i === discoveryState.activeIndex}
            data-index={i}
            class="flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-lg p-3 text-body {i ===
            discoveryState.activeIndex
              ? 'bg-accent-soft'
              : 'hover:bg-card-2'}"
            onmousedown={(event) => {
              event.preventDefault();
              choose(i);
            }}
            onmouseenter={() => discovery.hover(i)}
          >
            <div class="min-w-0">
              <span class="block leading-snug font-semibold"
                >{parts.before}{#if parts.match}<mark class="bg-transparent font-bold text-accent"
                    >{parts.match}</mark
                  >{/if}{parts.after}</span
              >
              <span id={`city-option-state-${i}`} class="mt-1 block text-meta text-muted"
                >{`${STATE_NAME[sug.state] ?? sug.state}${sug.label === selectedName ? ' · Current plan' : ''}`}</span
              >
            </div>
            <div id={`city-option-rent-${i}`} class="shrink-0 text-right">
              {#if rent != null}<span
                  class="block text-sm font-semibold whitespace-nowrap tabular-nums"
                  >{money(rent)}/mo</span
                ><span class="mt-1 block text-meta text-muted"
                  >{housingShortLabel(housing)} estimate</span
                >
              {:else}<span class="text-meta text-muted">Area rent lookup</span>{/if}
            </div>
          </li>
        {/each}
      </ul>
      <div
        class="flex min-h-11 items-center justify-between gap-2 border-t border-line px-4 py-2 text-meta text-muted"
      >
        <span
          >{discoveryState.loading
            ? 'Finding more places…'
            : discoveryState.suggestions.some((suggestion) => findSeedCity(suggestion.label))
              ? `Apartment List · ${RENT_DATA_META.label}`
              : 'Area rents checked on selection'}</span
        ><span aria-hidden="true" class="hidden whitespace-nowrap sm:inline"
          >↑ ↓ to move · Enter to choose</span
        >
      </div>
    </div>
  {/if}
  {#if discoveryState.open && !discoveryState.loading && !discoveryState.suggestions.length && discoveryState.query.trim().length >= 2}
    <p role="status" class="mt-2 text-sm text-muted">
      No matching cities. Try the full city name and state.
    </p>
  {/if}
  <span class="sr-only" aria-live="polite">
    {discoveryState.loading
      ? `${discoveryState.suggestions.length} city suggestions available. Searching for more places.`
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
