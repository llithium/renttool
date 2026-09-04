import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { pushState, replaceState } from '$app/navigation';
import { createUrlSync, type UrlSyncPlan } from './urlSync.svelte';

vi.mock('$app/navigation', () => ({
  pushState: vi.fn(),
  replaceState: vi.fn()
}));

const INITIAL_SEARCH = 'salary=80000&city=Tampa%2C+FL';
const UPDATED_SALARY_SEARCH = 'salary=81000&city=Tampa%2C+FL';
const ACTIVE_CITY_SEARCH = 'salary=81000&city=Austin%2C+TX';
const ACTIVE_CITY_UPDATED_SALARY_SEARCH = 'salary=90000&city=Austin%2C+TX';
const COMPARISON_SEARCH =
  'salary=80000&city=Tampa%2C+FL&compare=Austin%2C+TX&compare-salary=%7B%22name%22%3A%22Austin%2C+TX%22%2C%22salary%22%3A80000%7D';

type PopStateListener = () => void;

interface BrowserShim {
  readonly location: { pathname: string; search: string };
  readonly history: {
    state: { readonly marker: string };
  };
  readonly window: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  readonly dispatchPopState: () => void;
}

interface FakePlan extends UrlSyncPlan {
  salary: number | null;
  activeCity: { name: string } | null;
  comparisonNames: string[];
  selectedName: string | null;
  looking: boolean;
  pendingComparisonNames: string[];
  currentSearch: string;
  hadUrlState: boolean;
  searchBySalary: Record<string, string>;
  hydratedSearches: URLSearchParams[];
  appliedSearches: URLSearchParams[];
  readonly buildSearch: Mock<UrlSyncPlan['buildSearch']>;
  readonly hydrateFromSearch: Mock<UrlSyncPlan['hydrateFromSearch']>;
  readonly applyUrlNavigation: Mock<UrlSyncPlan['applyUrlNavigation']>;
  readonly restoreSession: Mock<UrlSyncPlan['restoreSession']>;
  readonly setSalary: Mock<UrlSyncPlan['setSalary']>;
}

interface TestEffect {
  readonly register: (callback: () => void) => void;
  readonly flush: () => void;
}

function createTestEffect(): TestEffect {
  let callback: (() => void) | undefined;
  return {
    register(effect) {
      callback = effect;
    },
    flush() {
      callback?.();
    }
  };
}

let flushEffects = () => {};

function flushSync(): void {
  flushEffects();
}

function installBrowserShim(initialSearch: string): BrowserShim {
  const locationShim = { pathname: '/rent', search: initialSearch };
  const listeners = new Set<PopStateListener>();
  const historyShim = {
    state: { marker: 'history-state' }
  };
  vi.mocked(replaceState).mockImplementation((url) => {
    const serializedUrl = url.toString();
    const queryStart = serializedUrl.indexOf('?');
    locationShim.search = queryStart >= 0 ? serializedUrl.slice(queryStart) : '';
  });
  const windowShim = {
    addEventListener: vi.fn((type: string, listener: PopStateListener) => {
      if (type === 'popstate') listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: PopStateListener) => {
      if (type === 'popstate') listeners.delete(listener);
    })
  };
  vi.stubGlobal('location', locationShim);
  vi.stubGlobal('history', historyShim);
  vi.stubGlobal('window', windowShim);

  return {
    location: locationShim,
    history: historyShim,
    window: windowShim,
    dispatchPopState() {
      for (const listener of listeners) listener();
    }
  };
}

function createFakePlan(options: Partial<FakePlan> = {}): FakePlan {
  const plan: FakePlan = {
    salary: 80_000,
    activeCity: { name: 'Tampa, FL' },
    comparisonNames: [],
    selectedName: 'Tampa, FL',
    looking: false,
    pendingComparisonNames: [],
    currentSearch: INITIAL_SEARCH,
    hadUrlState: true,
    searchBySalary: {},
    hydratedSearches: [],
    appliedSearches: [],
    buildSearch: vi.fn(function (this: FakePlan, salaryOverride?: number | null) {
      const override = salaryOverride === undefined ? 'undefined' : String(salaryOverride);
      return this.searchBySalary[override] ?? this.currentSearch;
    }),
    hydrateFromSearch: vi.fn(function (this: FakePlan, search: URLSearchParams) {
      this.hydratedSearches.push(new URLSearchParams(search));
      return this.hadUrlState;
    }),
    applyUrlNavigation: vi.fn(function (this: FakePlan, search: URLSearchParams) {
      this.appliedSearches.push(new URLSearchParams(search));
    }),
    restoreSession: vi.fn(),
    setSalary: vi.fn(function (this: FakePlan, value: number | null) {
      this.salary = value;
    })
  } satisfies FakePlan;

  Object.assign(plan, options);
  return plan;
}

function setSearchForSalary(plan: FakePlan, salary: number | null, search: string): void {
  plan.searchBySalary = { ...plan.searchBySalary, [String(salary)]: search };
}

let cleanupHarness: (() => void) | undefined;

function createHarness(plan: FakePlan, initialSearch: string) {
  const browser = installBrowserShim(initialSearch);
  const effect = createTestEffect();
  const urlSync = createUrlSync(plan, effect.register);
  flushEffects = effect.flush;
  flushSync();

  let teardown: (() => void) | undefined;
  cleanupHarness = () => {
    teardown?.();
  };

  return {
    browser,
    plan,
    start(onStateApplied = vi.fn()) {
      teardown = urlSync.start(new URLSearchParams(initialSearch), onStateApplied);
      flushSync();
      return { onStateApplied, teardown };
    },
    get urlSync() {
      return urlSync;
    }
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanupHarness?.();
  cleanupHarness = undefined;
  flushEffects = () => {};
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('createUrlSync', () => {
  it('hydrates rent-plan state once without echoing the initial URL', () => {
    const plan = createFakePlan();
    const harness = createHarness(plan, INITIAL_SEARCH);
    const { onStateApplied } = harness.start();

    expect(onStateApplied).toHaveBeenCalledTimes(1);
    expect(plan.hydrateFromSearch).toHaveBeenCalledTimes(1);
    expect(plan.hydratedSearches[0]?.toString()).toBe(INITIAL_SEARCH);
    expect(harness.browser.window.addEventListener).toHaveBeenCalledTimes(1);
    expect(harness.browser.window.addEventListener).toHaveBeenCalledWith(
      'popstate',
      expect.any(Function)
    );
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('canonicalizes a valid non-canonical URL with SvelteKit history replacement', () => {
    const nonCanonicalSearch = 'city=Tampa%2C+FL&salary=80000';
    const harness = createHarness(createFakePlan(), nonCanonicalSearch);
    harness.start();
    vi.runAllTimers();

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(`?${INITIAL_SEARCH}`, harness.browser.history.state);
    expect(pushState).not.toHaveBeenCalled();
    expect(harness.browser.location.search).toBe(`?${INITIAL_SEARCH}`);
  });

  it('uses restored session state as the initial written rent-plan state when the URL is empty', () => {
    const sessionSearch = 'salary=76000&city=Session%2C+FL';
    const plan = createFakePlan({
      salary: 76_000,
      selectedName: 'Session, FL',
      currentSearch: sessionSearch,
      hadUrlState: false
    });
    const harness = createHarness(plan, '');
    const { onStateApplied } = harness.start();
    vi.runAllTimers();

    expect(plan.restoreSession).not.toHaveBeenCalled();
    expect(plan.setSalary).toHaveBeenCalledWith(76_000);
    expect(plan.buildSearch).toHaveBeenCalledWith(76_000);
    expect(onStateApplied).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(`?${sessionSearch}`, harness.browser.history.state);
    expect(pushState).not.toHaveBeenCalled();
  });

  it('clears a pending salary timer and removes the exact registered popstate listener on teardown', () => {
    const plan = createFakePlan();
    setSearchForSalary(plan, 81_000, UPDATED_SALARY_SEARCH);
    const harness = createHarness(plan, INITIAL_SEARCH);
    const { teardown } = harness.start();
    const registeredListener = harness.browser.window.addEventListener.mock.calls[0]?.[1];

    harness.urlSync.scheduleSalary(81_000);
    teardown();
    vi.advanceTimersByTime(350);
    flushSync();

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    expect(harness.browser.window.removeEventListener).toHaveBeenCalledTimes(1);
    expect(harness.browser.window.removeEventListener).toHaveBeenCalledWith(
      'popstate',
      registeredListener
    );
  });

  it('does not write a salary-only URL before the 350 ms debounce expires', () => {
    const plan = createFakePlan();
    setSearchForSalary(plan, 81_000, UPDATED_SALARY_SEARCH);
    const harness = createHarness(plan, INITIAL_SEARCH);
    harness.start();

    harness.urlSync.scheduleSalary(81_000);
    vi.advanceTimersByTime(349);
    flushSync();

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('writes the latest debounced salary with replaceState at 350 ms', () => {
    const plan = createFakePlan();
    setSearchForSalary(plan, 81_000, UPDATED_SALARY_SEARCH);
    const harness = createHarness(plan, INITIAL_SEARCH);
    harness.start();

    harness.urlSync.scheduleSalary(81_000);
    vi.advanceTimersByTime(350);
    flushSync();

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(
      `?${UPDATED_SALARY_SEARCH}`,
      harness.browser.history.state
    );
    expect(pushState).not.toHaveBeenCalled();
  });

  it('does not write the same serialized rent plan more than once', () => {
    const plan = createFakePlan();
    setSearchForSalary(plan, 81_000, UPDATED_SALARY_SEARCH);
    const harness = createHarness(plan, INITIAL_SEARCH);
    harness.start();

    harness.urlSync.scheduleSalary(81_000);
    vi.advanceTimersByTime(350);
    flushSync();
    harness.urlSync.scheduleSalary(81_000);
    vi.advanceTimersByTime(350);
    flushSync();

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(pushState).not.toHaveBeenCalled();
  });

  it('uses pushState for a selected active-city change', () => {
    const plan = createFakePlan();
    const harness = createHarness(plan, INITIAL_SEARCH);
    harness.start();

    plan.selectedName = 'Austin, TX';
    plan.currentSearch = ACTIVE_CITY_SEARCH;
    flushSync();

    expect(pushState).toHaveBeenCalledTimes(1);
    expect(pushState).toHaveBeenCalledWith(`?${ACTIVE_CITY_SEARCH}`, harness.browser.history.state);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('uses the latest salary when a city changes during salary debounce', () => {
    const plan = createFakePlan();
    const staleSearch = 'salary=80000&city=Austin%2C+TX';
    setSearchForSalary(plan, 90_000, ACTIVE_CITY_UPDATED_SALARY_SEARCH);
    const harness = createHarness(plan, INITIAL_SEARCH);
    harness.start();

    harness.urlSync.scheduleSalary(90_000);
    plan.selectedName = 'Austin, TX';
    plan.currentSearch = staleSearch;
    flushSync();

    expect(pushState).toHaveBeenCalledTimes(1);
    expect(pushState).toHaveBeenCalledWith(
      `?${ACTIVE_CITY_UPDATED_SALARY_SEARCH}`,
      harness.browser.history.state
    );
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('uses replaceState for a comparison-set change', () => {
    const plan = createFakePlan();
    const harness = createHarness(plan, INITIAL_SEARCH);
    harness.start();

    plan.currentSearch = COMPARISON_SEARCH;
    flushSync();

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(
      `?${COMPARISON_SEARCH}`,
      harness.browser.history.state
    );
    expect(pushState).not.toHaveBeenCalled();
  });

  it('suppresses writes while the active city is pending, then writes after it clears', () => {
    const plan = createFakePlan({ selectedName: 'Austin, TX', looking: true });
    const harness = createHarness(plan, INITIAL_SEARCH);
    harness.start();

    plan.currentSearch = ACTIVE_CITY_SEARCH;
    flushSync();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();

    plan.looking = false;
    flushSync();

    expect(pushState).toHaveBeenCalledTimes(1);
    expect(pushState).toHaveBeenCalledWith(`?${ACTIVE_CITY_SEARCH}`, harness.browser.history.state);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('suppresses writes while a comparison entry is pending, then writes after it clears', () => {
    const plan = createFakePlan({ pendingComparisonNames: ['Austin, TX'] });
    const harness = createHarness(plan, INITIAL_SEARCH);
    harness.start();

    plan.currentSearch = COMPARISON_SEARCH;
    flushSync();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();

    plan.pendingComparisonNames = [];
    flushSync();

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(
      `?${COMPARISON_SEARCH}`,
      harness.browser.history.state
    );
    expect(pushState).not.toHaveBeenCalled();
  });

  it('applies a canonicalized browser-history URL without creating a navigation echo', () => {
    const plan = createFakePlan();
    const harness = createHarness(plan, INITIAL_SEARCH);
    const { onStateApplied } = harness.start();
    plan.applyUrlNavigation.mockImplementation((search: URLSearchParams) => {
      plan.appliedSearches.push(new URLSearchParams(search));
      plan.salary = 81_000;
      plan.selectedName = 'Austin, TX';
      plan.currentSearch = ACTIVE_CITY_SEARCH;
    });
    harness.browser.location.search = 'city=Austin%2C+TX&salary=81000';

    harness.browser.dispatchPopState();
    flushSync();

    expect(plan.appliedSearches[0]?.toString()).toBe('city=Austin%2C+TX&salary=81000');
    expect(onStateApplied).toHaveBeenCalledTimes(2);
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();

    const buildCallsBeforeUpdate = plan.buildSearch.mock.calls.length;
    plan.currentSearch = 'salary=82000&city=Austin%2C+TX';
    flushSync();
    expect(
      plan.buildSearch.mock.calls
        .slice(buildCallsBeforeUpdate)
        .some(([salary]) => salary === 81_000)
    ).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(
      '?salary=82000&city=Austin%2C+TX',
      harness.browser.history.state
    );
  });

  it('makes later popstate dispatches inert after teardown', () => {
    const plan = createFakePlan();
    const harness = createHarness(plan, INITIAL_SEARCH);
    const { teardown } = harness.start();
    const registeredListener = harness.browser.window.addEventListener.mock.calls[0]?.[1];

    teardown();
    harness.browser.location.search = `?${ACTIVE_CITY_SEARCH}`;
    harness.browser.dispatchPopState();

    expect(plan.applyUrlNavigation).not.toHaveBeenCalled();
    expect(harness.browser.window.removeEventListener).toHaveBeenCalledWith(
      'popstate',
      registeredListener
    );
  });
});
