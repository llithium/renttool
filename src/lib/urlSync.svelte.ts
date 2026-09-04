import { pushState, replaceState } from '$app/navigation';
import { canonicalizeRentPlanSearch, restoreRentPlan } from '$lib/planRepresentation';
export interface UrlSyncPlan {
  readonly salary: number | null;
  readonly activeCity: { readonly name: string } | null;
  readonly comparisonNames: readonly string[];
  readonly selectedName: string | null;
  readonly looking: boolean;
  readonly pendingComparisonNames: readonly string[];
  buildSearch(salaryOverride?: number | null): string;
  hydrateFromSearch(search: URLSearchParams): boolean;
  applyUrlNavigation(search: URLSearchParams): void;
  restoreSession(): void;
  setSalary(salary: number | null): void;
}

type EffectRegistrar = (callback: () => void) => void;

/**
 * Two-way sync between the shared app state and the address bar, so any view is
 * a shareable deep link.
 *
 * The salary contribution is debounced (city/compare changes are discrete and
 * write immediately) so dragging the slider or typing doesn't thrash the address
 * bar. `lastWritten` guards against the read→write echo and against redundant
 * replaceState calls.
 *
 * Call this once at component init — production callers omit the optional
 * registrar so this registers an `$effect` inside the component's effect context.
 * The registrar is a deterministic test seam for the URL-sync contract.
 */
export function createUrlSync(plan: UrlSyncPlan, registerEffect?: EffectRegistrar) {
  let hydrated = $state(false);
  let salaryForUrl = $state<number | null>(null);
  let salaryWritePending = $state(false);
  let salaryTimer: ReturnType<typeof setTimeout> | undefined;
  let canonicalizationTimer: ReturnType<typeof setTimeout> | undefined;
  let lastWritten = '';
  let stopped = false;
  // Tracks the city in the last-written URL so the write effect can tell a city
  // change (→ pushState, a real history entry) from an incidental salary/compare
  // change (→ replaceState). Browser back/forward then steps through cities only.
  let lastCity: string | null = null;
  let lastComparisonKey = '';

  const comparisonKey = () => plan.comparisonNames.join('\u001f');

  const synchronize = () => {
    if (stopped) return;
    // Always read the state so deps are tracked, but hold off writing until
    // start() has hydrated from the URL and seeded lastWritten — otherwise this
    // could strip the query string before hydrateFromSearch reads it.
    const params = plan.buildSearch(salaryForUrl);
    const cityChanged = plan.selectedName !== lastCity;
    const comparisonsChanged = comparisonKey() !== lastComparisonKey;
    // URL restoration can resolve an off-list active city asynchronously. Keep
    // the URL authoritative until every pending lane has caught up, otherwise
    // the intermediate placeholder state would write a partial plan back.
    if (
      !hydrated ||
      (salaryWritePending && !cityChanged && !comparisonsChanged) ||
      params === lastWritten ||
      plan.looking ||
      plan.pendingComparisonNames.length > 0
    ) {
      return;
    }
    lastWritten = params;
    lastCity = plan.selectedName;
    lastComparisonKey = comparisonKey();
    const url = params ? `?${params}` : location.pathname;
    // New city → push a history entry so Back/Forward returns here. Salary/compare
    // tweaks replace the current entry so they don't clutter the history stack.
    if (cityChanged) pushState(url, history.state ?? {});
    else replaceState(url, history.state ?? {});
  };

  if (registerEffect) registerEffect(synchronize);
  else $effect(synchronize);

  return {
    get hydrated() {
      return hydrated;
    },

    /** Queue the salary URL write without hiding it from a discrete navigation. */
    scheduleSalary(value: number | null) {
      clearTimeout(salaryTimer);
      salaryWritePending = true;
      salaryForUrl = value;
      salaryTimer = setTimeout(() => {
        salaryTimer = undefined;
        salaryWritePending = false;
      }, 350);
    },

    /**
     * Hydrate from the initial URL, then keep watching history navigation.
     * `onStateApplied` re-seeds whatever the component mirrors locally (the
     * salary text field). Returns an onMount-style teardown.
     */
    start(initialSearch: URLSearchParams, onStateApplied: () => void) {
      stopped = false;
      // A URL with plan state wins. A stateful client-side visit keeps the
      // in-memory plan; otherwise restore the last session and then reapply a
      // salary-only URL value.
      const hadUrlState = plan.hydrateFromSearch(initialSearch);
      if (!hadUrlState) {
        const urlSalary = plan.salary;
        if (!plan.activeCity && !plan.comparisonNames.length) plan.restoreSession();
        if (urlSalary != null) plan.setSalary(urlSalary);
      }
      salaryForUrl = plan.salary;
      if (hadUrlState) {
        lastWritten = canonicalizeRentPlanSearch(initialSearch);
        lastCity = restoreRentPlan(initialSearch).selected?.name ?? null;
      } else {
        lastWritten = plan.buildSearch(salaryForUrl);
        lastCity = plan.selectedName;
      }
      lastComparisonKey = comparisonKey();
      const shouldCanonicalize = lastWritten !== location.search.replace(/^\?/, '');
      hydrated = true;
      onStateApplied();
      if (shouldCanonicalize) {
        // Normalize the current entry through SvelteKit's shallow-routing API
        // so its router stays in sync with the address bar. Defer one task: on
        // an initial load, onMount can run just before the client router marks
        // itself ready for shallow-routing calls.
        canonicalizationTimer = setTimeout(() => {
          replaceState(lastWritten ? `?${lastWritten}` : location.pathname, history.state ?? {});
          canonicalizationTimer = undefined;
        });
      }

      // Re-hydrate on browser back/forward. Shallow routing (pushState/replaceState)
      // doesn't update `page.url`, so we read the authoritative live URL instead.
      // Native popstate fires only on genuine history navigation — never on our own
      // push/replace above — so no echo guard beyond the redundant-write
      // short-circuit is needed.
      const onPopState = () => {
        clearTimeout(salaryTimer);
        salaryTimer = undefined;
        salaryWritePending = false;
        const params = new URLSearchParams(location.search);
        const search = canonicalizeRentPlanSearch(params);
        if (!hydrated || search === lastWritten) return;
        lastWritten = search;
        lastCity = restoreRentPlan(params).selected?.name ?? null;
        plan.applyUrlNavigation(params);
        salaryForUrl = plan.salary;
        lastComparisonKey = comparisonKey();
        onStateApplied();
      };

      window.addEventListener('popstate', onPopState);
      return () => {
        stopped = true;
        clearTimeout(salaryTimer);
        salaryTimer = undefined;
        salaryWritePending = false;
        clearTimeout(canonicalizationTimer);
        window.removeEventListener('popstate', onPopState);
      };
    }
  };
}
