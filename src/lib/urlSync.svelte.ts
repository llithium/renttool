import { pushState, replaceState } from '$app/navigation';
import { canonicalizeRentPlanSearch, restoreRentPlan } from '$lib/planRepresentation';
import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';

/**
 * Two-way sync between the shared app state and the address bar, so any view is
 * a shareable deep link.
 *
 * The salary contribution is debounced (city/compare changes are discrete and
 * write immediately) so dragging the slider or typing doesn't thrash the address
 * bar. `lastWritten` guards against the read→write echo and against redundant
 * replaceState calls.
 *
 * Call this once at component init — it registers an `$effect`, so it must run
 * inside a component's effect context.
 */
export function createUrlSync(plan: RentPlanPresentation) {
  let hydrated = $state(false);
  let salaryForUrl = $state<number | null>(null);
  let salaryTimer: ReturnType<typeof setTimeout> | undefined;
  let lastWritten = '';
  // Tracks the city in the last-written URL so the write effect can tell a city
  // change (→ pushState, a real history entry) from an incidental salary/compare
  // change (→ replaceState). Browser back/forward then steps through cities only.
  let lastCity: string | null = null;

  $effect(() => {
    // Always read the state so deps are tracked, but hold off writing until
    // start() has hydrated from the URL and seeded lastWritten — otherwise this
    // could strip the query string before hydrateFromSearch reads it.
    const params = plan.buildSearch(salaryForUrl);
    // URL restoration can resolve an off-list active city asynchronously. Keep
    // the URL authoritative until every pending lane has caught up, otherwise
    // the intermediate placeholder state would write a partial plan back.
    if (
      !hydrated ||
      params === lastWritten ||
      plan.looking ||
      plan.pendingComparisonNames.length > 0
    ) {
      return;
    }
    const cityChanged = plan.selectedName !== lastCity;
    lastWritten = params;
    lastCity = plan.selectedName;
    const url = params ? `?${params}` : location.pathname;
    // New city → push a history entry so Back/Forward returns here. Salary/compare
    // tweaks replace the current entry so they don't clutter the history stack.
    if (cityChanged) pushState(url, history.state ?? {});
    else replaceState(url, history.state ?? {});
  });

  return {
    get hydrated() {
      return hydrated;
    },

    /** Queue the salary that should appear in the URL once typing settles. */
    scheduleSalary(value: number | null) {
      clearTimeout(salaryTimer);
      salaryTimer = setTimeout(() => (salaryForUrl = value), 350);
    },

    /**
     * Hydrate from the initial URL, then keep watching history navigation.
     * `onStateApplied` re-seeds whatever the component mirrors locally (the
     * salary text field). Returns an onMount-style teardown.
     */
    start(initialSearch: URLSearchParams, onStateApplied: () => void) {
      // A URL with plan state wins. A stateful client-side visit keeps the
      // in-memory plan; otherwise restore the last session and then reapply a
      // salary-only URL value.
      const hadUrlState = plan.hydrateFromSearch(initialSearch);
      if (!hadUrlState) {
        const urlSalary = plan.salary;
        if (!plan.activeCity && !plan.comparisonCities.length) plan.restoreSession();
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
      const shouldCanonicalize = lastWritten !== location.search.replace(/^\?/, '');
      hydrated = true;
      onStateApplied();
      if (shouldCanonicalize) {
        // Normalize the current entry without asking the router to navigate
        // while the initial page is still hydrating.
        history.replaceState(
          history.state ?? {},
          '',
          lastWritten ? `?${lastWritten}` : location.pathname
        );
      }

      // Re-hydrate on browser back/forward. Shallow routing (pushState/replaceState)
      // doesn't update `page.url`, so we read the authoritative live URL instead.
      // Native popstate fires only on genuine history navigation — never on our own
      // push/replace above — so no echo guard beyond the redundant-write
      // short-circuit is needed.
      const onPopState = () => {
        const params = new URLSearchParams(location.search);
        const search = canonicalizeRentPlanSearch(params);
        if (!hydrated || search === lastWritten) return;
        lastWritten = search;
        lastCity = restoreRentPlan(params).selected?.name ?? null;
        plan.applyUrlNavigation(params);
        salaryForUrl = plan.salary;
        onStateApplied();
      };

      window.addEventListener('popstate', onPopState);
      return () => {
        clearTimeout(salaryTimer);
        window.removeEventListener('popstate', onPopState);
      };
    }
  };
}
