<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import type { CitySuggestion } from '$lib/types';
  import { STATE_NAME } from '$lib/data/states';
  import { findSeedCity, RENT_DATA_META } from '$lib/data/cities';
  import { money } from '$lib/format';
  import { createCitySearchDiscovery } from '$lib/components/ui/citySearchDiscovery';
  import { housingRent, type HousingChoice } from '$lib/planning';
  import { housingWords } from '$lib/postcard';

  /**
   * City autocomplete in the postcard look. `pill` sits in the top bar, `line`
   * is the handwritten address line on the home card, and `add` adds a city to
   * a comparison and clears itself afterwards.
   */
  let {
    onselect,
    selectedName = null,
    pendingName = null,
    housing = '1br',
    variant = 'pill',
    id = 'city-input',
    label = 'City',
    placeholder = 'City or city, state'
  }: {
    onselect: (suggestion: CitySuggestion) => void;
    selectedName?: string | null;
    pendingName?: string | null;
    housing?: HousingChoice;
    variant?: 'pill' | 'line' | 'add';
    id?: string;
    label?: string;
    placeholder?: string;
  } = $props();

  let input: HTMLInputElement;
  let popup = $state<HTMLDivElement>();
  let list = $state<HTMLUListElement>();
  let popupStyle = $state('');
  let listHeight = $state(320);
  const discovery = createCitySearchDiscovery();
  let discoveryState = $state(discovery.state);
  const unsubscribe = discovery.subscribe((state) => (discoveryState = state));
  let listboxId = $derived(`${id}-listbox`);

  onDestroy(() => {
    unsubscribe();
    discovery.dispose();
  });

  // Reflect a selection made elsewhere (map marker, restored plan) in the field.
  $effect(() => {
    if (variant !== 'add' && selectedName != null) discovery.setExternalQuery(selectedName);
  });

  let status = $derived(
    pendingName
      ? `Looking up rent for ${pendingName}.`
      : variant !== 'add' &&
          selectedName != null &&
          discoveryState.query.trim().length >= 2 &&
          discoveryState.query.trim() !== selectedName &&
          !discoveryState.open
        ? `Pick a city from the list to switch. Still showing ${selectedName}.`
        : ''
  );

  function positionSuggestions() {
    const rect = input.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const flip = below < 240 && above > below;
    const height = Math.max(100, Math.min(400, flip ? above : below));
    const width = Math.min(Math.max(rect.width + 48, 300), window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.left - 24, window.innerWidth - width - 16));
    listHeight = height - 44;
    popupStyle = `left:${left}px;${flip ? 'bottom' : 'top'}:${flip ? window.innerHeight - rect.top + 10 : rect.bottom + 10}px;width:${width}px`;
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

  function finish(selection: CitySuggestion | undefined) {
    if (!selection) return;
    onselect(selection);
    if (variant === 'add') discovery.input('');
  }

  function choose(index: number) {
    finish(discovery.select(index));
  }

  function onKeydown(event: KeyboardEvent) {
    const result = discovery.handleKey(event.key);
    if (result.handled) event.preventDefault();
    finish(result.selection);
  }

  /** Take the highlighted (or first) suggestion, for a form's submit button. */
  export function submit(): boolean {
    const index = discoveryState.activeIndex >= 0 ? discoveryState.activeIndex : 0;
    if (discoveryState.suggestions[index]) {
      choose(index);
      return true;
    }
    input.focus();
    return false;
  }

  export function focus() {
    input.focus();
  }

  function highlight(text: string): { before: string; match: string; after: string } {
    const q = discoveryState.query.split(',')[0].trim();
    const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (i < 0) return { before: text, match: '', after: '' };
    return {
      before: text.slice(0, i),
      match: text.slice(i, i + q.length),
      after: text.slice(i + q.length)
    };
  }
</script>

<div class="pc-search" data-variant={variant}>
  <label for={id} class="pc-search-field">
    <span class="pc-search-label">{label}</span>
    <input
      bind:this={input}
      {id}
      name={`${id}-search`}
      type="search"
      role="combobox"
      aria-expanded={discoveryState.open}
      aria-controls={discoveryState.open && discoveryState.suggestions.length
        ? listboxId
        : undefined}
      aria-autocomplete="list"
      aria-activedescendant={discoveryState.open && discoveryState.activeIndex >= 0
        ? `${id}-option-${discoveryState.activeIndex}`
        : undefined}
      aria-busy={discoveryState.loading}
      aria-describedby={status ? `${id}-status` : undefined}
      autocomplete="off"
      data-1p-ignore
      data-lpignore="true"
      data-form-type="other"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      {placeholder}
      value={discoveryState.query}
      oninput={(event) => discovery.input(event.currentTarget.value)}
      onkeydown={onKeydown}
      onfocus={(event) => {
        discovery.focus();
        if (selectedName && discoveryState.query === selectedName) event.currentTarget.select();
      }}
      onblur={() => discovery.blur()}
    />
    {#if discoveryState.loading}<span class="pc-search-spin" aria-hidden="true"></span>{/if}
  </label>

  {#if discoveryState.open && discoveryState.suggestions.length}
    <div bind:this={popup} popover="manual" style={popupStyle} class="pc-search-pop">
      <ul
        bind:this={list}
        id={listboxId}
        role="listbox"
        aria-label="City suggestions"
        style:max-height={`${listHeight}px`}
      >
        {#each discoveryState.suggestions as suggestion, i (suggestion.label)}
          {@const known = findSeedCity(suggestion.label)}
          {@const rent = known ? housingRent(known, housing) : null}
          {@const parts = highlight(suggestion.city)}
          <li
            id={`${id}-option-${i}`}
            role="option"
            aria-label={suggestion.label}
            aria-describedby={`${id}-option-detail-${i}`}
            aria-selected={i === discoveryState.activeIndex}
            data-index={i}
            onmousedown={(event) => {
              event.preventDefault();
              choose(i);
            }}
            onmouseenter={() => discovery.hover(i)}
          >
            <span class="pc-opt-name"
              >{parts.before}{#if parts.match}<mark>{parts.match}</mark>{/if}{parts.after}</span
            >
            <span class="pc-opt-rent">{rent != null ? money(rent) : 'Area rent'}</span>
            <span id={`${id}-option-detail-${i}`} class="pc-opt-detail"
              >{STATE_NAME[suggestion.state] ?? suggestion.state}{suggestion.label === selectedName
                ? ' · showing now'
                : ''}</span
            >
            <span class="pc-opt-detail pc-opt-rent"
              >{rent != null ? housingWords(housing).short : 'checked on pick'}</span
            >
          </li>
        {/each}
      </ul>
      <p class="pc-search-foot">
        <span
          >{discoveryState.loading
            ? 'Finding more places…'
            : `Rents: Apartment List, ${RENT_DATA_META.label}`}</span
        ><span aria-hidden="true" class="pc-search-keys">↑ ↓ then Enter</span>
      </p>
    </div>
  {/if}
  {#if discoveryState.open && !discoveryState.loading && !discoveryState.suggestions.length && discoveryState.query.trim().length >= 2}
    <p role="status" class="pc-search-note">
      No matching cities. Try the full city name and state.
    </p>
  {/if}
  <span class="sr-only" aria-live="polite">
    {discoveryState.open ? `${discoveryState.suggestions.length} city suggestions available` : ''}
  </span>
  {#if status}<p id={`${id}-status`} aria-live="polite" class="pc-search-note">{status}</p>{/if}
</div>

<style>
  .pc-search {
    position: relative;
    min-width: 0;
  }
  .pc-search-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
  input {
    min-width: 0;
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--navy);
    font-weight: 600;
    outline: none;
    appearance: none;
  }
  input::-webkit-search-cancel-button,
  input::-webkit-search-decoration {
    appearance: none;
  }
  input::placeholder {
    color: #8794a3;
    font-weight: 500;
  }
  .pc-search-label {
    flex: none;
    color: var(--muted);
  }

  /* Top bar pill */
  [data-variant='pill'] .pc-search-field,
  [data-variant='add'] .pc-search-field {
    height: 2.75rem;
    padding: 0 1rem;
    border: 1.5px solid var(--navy);
    border-radius: 999px;
    background: #fff;
    font-size: 0.9375rem;
  }
  [data-variant='pill'] input {
    width: 10rem;
  }
  [data-variant='add'] .pc-search-field {
    height: 3.5rem;
    border: 2px dashed #9aa6b2;
    border-radius: 8px;
    background: transparent;
    font-size: 1rem;
  }
  [data-variant='add'] .pc-search-label {
    color: var(--navy);
    font-weight: 600;
  }
  .pc-search-field:focus-within {
    outline: 2px solid var(--navy);
    outline-offset: 2px;
  }

  /* Address line on the home card */
  [data-variant='line'] .pc-search-field {
    display: block;
    padding: 0.625rem 0 0.375rem;
    border-bottom: 1.5px solid var(--navy);
  }
  [data-variant='line'] .pc-search-field:focus-within {
    outline: none;
    border-bottom-width: 3px;
    padding-bottom: calc(0.375rem - 1.5px);
  }
  [data-variant='line'] .pc-search-label {
    display: block;
    font-size: 0.8125rem;
  }
  [data-variant='line'] input {
    display: block;
    width: 100%;
    padding: 2px 0;
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
  }

  .pc-search-spin {
    width: 0.75rem;
    height: 0.75rem;
    flex: none;
    border: 2px solid rgb(23 38 59 / 20%);
    border-top-color: var(--navy);
    border-radius: 50%;
    animation: pc-spin 0.8s linear infinite;
  }
  @keyframes pc-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .pc-search-pop {
    position: fixed;
    inset: auto;
    z-index: 60;
    margin: 0;
    padding: 0;
    overflow: hidden;
    border: 1.5px solid var(--navy);
    border-radius: 8px;
    background: #fff;
    color: var(--navy);
    box-shadow: var(--elevation-pop);
  }
  ul {
    margin: 0;
    padding: 0.375rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.125rem 1rem;
    padding: 0.625rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
  }
  li[aria-selected='true'] {
    background: var(--pink-soft);
  }
  li:hover {
    background: var(--card-2);
  }
  .pc-opt-name {
    font-weight: 600;
  }
  mark {
    background: linear-gradient(transparent 60%, var(--pink) 60%);
    color: inherit;
  }
  .pc-opt-rent {
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .pc-opt-detail {
    color: var(--muted);
    font-size: 0.8125rem;
    font-weight: 400;
  }
  .pc-search-foot {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    margin: 0;
    padding: 0.625rem 1rem;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 0.8125rem;
  }
  .pc-search-note {
    margin: 0.5rem 0 0;
    color: var(--muted);
    font-size: 0.8125rem;
  }
  [data-variant='pill'] .pc-search-note {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 5;
    width: max-content;
    max-width: 20rem;
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    background: var(--navy);
    color: #fff;
  }
  @media (max-width: 600px) {
    .pc-search-keys {
      display: none;
    }
    [data-variant='pill'] input {
      width: 100%;
    }
    [data-variant='line'] input {
      font-size: 1.625rem;
    }
  }
</style>
