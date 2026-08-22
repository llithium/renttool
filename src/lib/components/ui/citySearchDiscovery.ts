import { fetchSuggestions as defaultFetchSuggestions } from '$lib/api';
import { SEED_CITIES } from '$lib/data/cities';
import type { CitySuggestion } from '$lib/types';

const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 8;
const DEFAULT_DEBOUNCE_MS = 220;
const DEFAULT_BLUR_DELAY_MS = 150;

/** The clock adapter keeps debounce and blur transitions deterministic in tests. */
export interface CitySearchDiscoveryScheduler {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
}

const browserScheduler: CitySearchDiscoveryScheduler = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
};

export interface CitySearchDiscoveryState {
  readonly query: string;
  readonly suggestions: readonly CitySuggestion[];
  readonly open: boolean;
  readonly loading: boolean;
  readonly activeIndex: number;
}

export interface CitySearchKeyResult {
  readonly handled: boolean;
  readonly selection?: CitySuggestion;
}

export interface CitySearchDiscoveryOptions {
  fetchSuggestions?: (query: string, signal: AbortSignal) => Promise<CitySuggestion[]>;
  localMatches?: (query: string) => readonly CitySuggestion[];
  scheduler?: CitySearchDiscoveryScheduler;
  debounceMs?: number;
  blurDelayMs?: number;
}

export interface CitySearchDiscovery {
  readonly state: CitySearchDiscoveryState;
  subscribe(listener: (state: CitySearchDiscoveryState) => void): () => void;
  input(query: string): void;
  focus(): void;
  blur(): void;
  handleKey(key: string): CitySearchKeyResult;
  hover(index: number): void;
  select(index: number): CitySuggestion | undefined;
  setExternalQuery(query: string): void;
  dispose(): void;
}

function seedMatches(query: string): CitySuggestion[] {
  const term = query.trim().toLowerCase();
  return SEED_CITIES.filter((city) => city.name.toLowerCase().includes(term))
    .slice(0, MAX_SUGGESTIONS)
    .map((city) => ({
      label: city.name,
      city: city.city,
      state: city.state,
      lat: city.lat,
      lng: city.lng
    }));
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'AbortError';
}

/**
 * Owns CitySearch's discovery workflow and keyboard state.
 *
 * The Svelte module only renders the snapshot and forwards DOM events. Local
 * matching, debounce, cancellation, stale-request protection, fallback, and
 * selection transitions stay behind this internal seam so they can be tested
 * without a browser or animation timing.
 */
export function createCitySearchDiscovery(
  options: CitySearchDiscoveryOptions = {}
): CitySearchDiscovery {
  const fetchSuggestions = options.fetchSuggestions ?? defaultFetchSuggestions;
  const localMatches = options.localMatches ?? seedMatches;
  const scheduler = options.scheduler ?? browserScheduler;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const blurDelayMs = options.blurDelayMs ?? DEFAULT_BLUR_DELAY_MS;

  let currentState: CitySearchDiscoveryState = {
    query: '',
    suggestions: [],
    open: false,
    loading: false,
    activeIndex: -1
  };
  let requestVersion = 0;
  let debounceHandle: unknown;
  let blurHandle: unknown;
  let controller: AbortController | undefined;
  let disposed = false;
  const listeners = new Set<(state: CitySearchDiscoveryState) => void>();

  function update(patch: Partial<CitySearchDiscoveryState>) {
    currentState = {
      ...currentState,
      ...patch,
      suggestions: patch.suggestions ? [...patch.suggestions] : currentState.suggestions
    };
    for (const listener of listeners) listener(currentState);
  }

  function clearScheduledHandle(handle: unknown): undefined {
    if (handle !== undefined) scheduler.clear(handle);
    return undefined;
  }

  function clearDebounce() {
    debounceHandle = clearScheduledHandle(debounceHandle);
  }

  function clearBlur() {
    blurHandle = clearScheduledHandle(blurHandle);
  }

  function invalidateRequests() {
    requestVersion += 1;
    clearDebounce();
    controller?.abort();
    controller = undefined;
  }

  function isCurrent(version: number): boolean {
    return !disposed && version === requestVersion;
  }

  function matchesFor(query: string): CitySuggestion[] {
    return [...localMatches(query)].slice(0, MAX_SUGGESTIONS);
  }

  async function runRemote(query: string, version: number, requestController: AbortController) {
    let nextSuggestions: readonly CitySuggestion[] | undefined;
    try {
      const remote = await fetchSuggestions(query, requestController.signal);
      if (!isCurrent(version)) return;
      nextSuggestions = remote.length ? remote : matchesFor(query);
    } catch (cause) {
      if (!isCurrent(version)) return;
      // An abort normally belongs to a newer request and is therefore stale.
      // If an adapter reports an abort for the current request, retain the
      // already-visible local matches just as any other unavailable response.
      if (!isAbortError(cause)) nextSuggestions = matchesFor(query);
    } finally {
      if (controller === requestController) controller = undefined;
      if (isCurrent(version)) {
        const suggestions = nextSuggestions ?? currentState.suggestions;
        update({
          suggestions,
          loading: false,
          activeIndex: suggestions.length ? 0 : -1
        });
      }
    }
  }

  function startRemote(query: string, version: number) {
    if (!isCurrent(version)) return;
    if (controller) return;
    const requestController = new AbortController();
    controller = requestController;
    update({ loading: true });
    void runRemote(query, version, requestController);
  }

  function startImmediateRemote() {
    const query = currentState.query.trim();
    if (query.length < MIN_QUERY_LENGTH || currentState.loading) return;
    clearDebounce();
    startRemote(query, requestVersion);
  }

  function select(index: number): CitySuggestion | undefined {
    const selection = currentState.suggestions[index];
    if (!selection) return undefined;
    clearBlur();
    invalidateRequests();
    update({
      query: selection.label,
      suggestions: [],
      open: false,
      loading: false,
      activeIndex: -1
    });
    return selection;
  }

  function handleKey(key: string): CitySearchKeyResult {
    if (key === 'Escape') {
      if (!currentState.open) return { handled: false };
      update({ open: false });
      return { handled: true };
    }

    if (key === 'ArrowDown') {
      if (!currentState.open) {
        if (currentState.suggestions.length) {
          update({
            open: true,
            activeIndex: currentState.activeIndex >= 0 ? currentState.activeIndex : 0
          });
          return { handled: true };
        }
        if (currentState.query.trim().length >= MIN_QUERY_LENGTH) {
          update({ open: true });
          startImmediateRemote();
          return { handled: true };
        }
        return { handled: false };
      }

      if (!currentState.suggestions.length) {
        if (currentState.query.trim().length < MIN_QUERY_LENGTH) return { handled: false };
        startImmediateRemote();
        return { handled: true };
      }

      update({
        activeIndex: (currentState.activeIndex + 1) % currentState.suggestions.length
      });
      return { handled: true };
    }

    if (key === 'ArrowUp') {
      if (!currentState.open || !currentState.suggestions.length) return { handled: false };
      update({
        activeIndex:
          (currentState.activeIndex - 1 + currentState.suggestions.length) %
          currentState.suggestions.length
      });
      return { handled: true };
    }

    if (key === 'Enter') {
      if (!currentState.open || currentState.activeIndex < 0) return { handled: false };
      const selection = select(currentState.activeIndex);
      return selection ? { handled: true, selection } : { handled: false };
    }

    return { handled: false };
  }

  const discovery: CitySearchDiscovery = {
    get state() {
      return currentState;
    },

    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      listener(currentState);
      return () => listeners.delete(listener);
    },

    input(query) {
      if (disposed) return;
      clearBlur();
      invalidateRequests();
      const normalizedQuery = query.trim();
      if (normalizedQuery.length < MIN_QUERY_LENGTH) {
        update({
          query,
          suggestions: [],
          open: true,
          loading: false,
          activeIndex: -1
        });
        return;
      }

      const suggestions = matchesFor(normalizedQuery);
      update({
        query,
        suggestions,
        open: true,
        loading: false,
        activeIndex: suggestions.length ? 0 : -1
      });
      const version = requestVersion;
      debounceHandle = scheduler.set(() => {
        debounceHandle = undefined;
        startRemote(normalizedQuery, version);
      }, debounceMs);
    },

    focus() {
      if (disposed) return;
      clearBlur();
      update({ open: currentState.suggestions.length > 0 });
    },

    blur() {
      if (disposed) return;
      clearBlur();
      blurHandle = scheduler.set(() => {
        blurHandle = undefined;
        if (disposed) return;
        update({ open: false });
      }, blurDelayMs);
    },

    handleKey,

    hover(index) {
      if (
        disposed ||
        index < 0 ||
        index >= currentState.suggestions.length ||
        index === currentState.activeIndex
      ) {
        return;
      }
      update({ activeIndex: index });
    },

    select,

    setExternalQuery(query) {
      if (disposed || query === currentState.query) return;
      clearBlur();
      invalidateRequests();
      update({
        query,
        suggestions: [],
        open: false,
        loading: false,
        activeIndex: -1
      });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      clearDebounce();
      clearBlur();
      controller?.abort();
      controller = undefined;
      listeners.clear();
    }
  };

  return discovery;
}
