import { describe, expect, it, vi } from 'vitest';
import type { CitySuggestion } from '$lib/types';
import {
  createCitySearchDiscovery,
  type CitySearchDiscoveryScheduler,
  type CitySearchKeyResult
} from './citySearchDiscovery';

const alpha: CitySuggestion = {
  label: 'Alpha, AA',
  city: 'Alpha',
  state: 'AA',
  lat: 40,
  lng: -74
};

const alpine: CitySuggestion = {
  label: 'Alpine, AA',
  city: 'Alpine',
  state: 'AA',
  lat: 41,
  lng: -75
};

const remote: CitySuggestion = {
  label: 'Remote, RR',
  city: 'Remote',
  state: 'RR',
  lat: 42,
  lng: -76
};

class TestScheduler implements CitySearchDiscoveryScheduler {
  private now = 0;
  private nextId = 0;
  private readonly tasks = new Map<number, { at: number; callback: () => void }>();

  set(callback: () => void, delayMs: number): number {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + delayMs, callback });
    return id;
  }

  clear(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  advanceBy(milliseconds: number): void {
    const target = this.now + milliseconds;
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= target)
        .sort(([, left], [, right]) => left.at - right.at)[0];
      if (!next) break;
      this.now = next[1].at;
      this.tasks.delete(next[0]);
      next[1].callback();
    }
    this.now = target;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function settleAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

function resultOf(result: CitySearchKeyResult): CitySuggestion | undefined {
  return result.selection;
}

describe('CitySearchDiscovery', () => {
  it('shows local matches before a debounced remote refinement completes', async () => {
    const scheduler = new TestScheduler();
    const response = deferred<CitySuggestion[]>();
    const fetchSuggestions = vi.fn(() => response.promise);
    const discovery = createCitySearchDiscovery({
      localMatches: () => [alpha],
      fetchSuggestions,
      scheduler,
      debounceMs: 220
    });

    discovery.input('alpha');

    expect(discovery.state).toMatchObject({
      query: 'alpha',
      suggestions: [alpha],
      open: true,
      loading: false,
      activeIndex: 0
    });
    expect(fetchSuggestions).not.toHaveBeenCalled();

    scheduler.advanceBy(219);
    expect(fetchSuggestions).not.toHaveBeenCalled();

    scheduler.advanceBy(1);
    expect(fetchSuggestions).toHaveBeenCalledWith('alpha', expect.any(AbortSignal));
    expect(discovery.state.loading).toBe(true);

    response.resolve([remote]);
    await settleAsyncWork();

    expect(discovery.state).toMatchObject({
      suggestions: [remote],
      open: true,
      loading: false,
      activeIndex: 0
    });
  });

  it.each([
    ['empty', (response: ReturnType<typeof deferred<CitySuggestion[]>>) => response.resolve([])],
    [
      'failed',
      (response: ReturnType<typeof deferred<CitySuggestion[]>>) =>
        response.reject(new Error('upstream unavailable'))
    ]
  ])('keeps local matches when the remote request is %s', async (_label, finishResponse) => {
    const scheduler = new TestScheduler();
    const response = deferred<CitySuggestion[]>();
    const discovery = createCitySearchDiscovery({
      localMatches: () => [alpha],
      fetchSuggestions: () => response.promise,
      scheduler,
      debounceMs: 0
    });

    discovery.input('alpha');
    scheduler.advanceBy(0);
    finishResponse(response);
    await settleAsyncWork();

    expect(discovery.state.suggestions).toEqual([alpha]);
    expect(discovery.state.loading).toBe(false);
    expect(discovery.state.activeIndex).toBe(0);
  });

  it('keeps local matches when a throttled adapter turns a 429 into no results', async () => {
    const scheduler = new TestScheduler();
    const fetchSuggestions = vi.fn(async () => {
      const upstreamStatus = 429;
      return upstreamStatus === 429 ? [] : [remote];
    });
    const discovery = createCitySearchDiscovery({
      localMatches: () => [alpha],
      fetchSuggestions,
      scheduler,
      debounceMs: 0
    });

    discovery.input('alpha');
    scheduler.advanceBy(0);
    await settleAsyncWork();

    expect(fetchSuggestions).toHaveBeenCalledOnce();
    expect(discovery.state.suggestions).toEqual([alpha]);
    expect(discovery.state.loading).toBe(false);
    expect(discovery.state.activeIndex).toBe(0);
  });

  it('keeps local matches when the current request reports AbortError', async () => {
    const scheduler = new TestScheduler();
    const response = deferred<CitySuggestion[]>();
    const discovery = createCitySearchDiscovery({
      localMatches: () => [alpha],
      fetchSuggestions: () => response.promise,
      scheduler,
      debounceMs: 0
    });

    discovery.input('alpha');
    scheduler.advanceBy(0);
    response.reject(new DOMException('Request aborted', 'AbortError'));
    await settleAsyncWork();

    expect(discovery.state.suggestions).toEqual([alpha]);
    expect(discovery.state.loading).toBe(false);
    expect(discovery.state.activeIndex).toBe(0);
  });

  it('preserves the newer query when an older request resolves after being aborted', async () => {
    const scheduler = new TestScheduler();
    const firstResponse = deferred<CitySuggestion[]>();
    const secondResponse = deferred<CitySuggestion[]>();
    const fetchSuggestions = vi.fn((query: string, signal: AbortSignal) => {
      void signal;
      return query === 'alpha' ? firstResponse.promise : secondResponse.promise;
    });
    const discovery = createCitySearchDiscovery({
      localMatches: (query) => (query === 'alpha' ? [alpha] : [alpine, alpha]),
      fetchSuggestions,
      scheduler,
      debounceMs: 0
    });

    discovery.input('alpha');
    scheduler.advanceBy(0);
    const firstCall = fetchSuggestions.mock.calls[0];
    if (!firstCall) throw new Error('The first remote request did not start.');
    const firstSignal = firstCall[1];
    expect(firstSignal).toBeInstanceOf(AbortSignal);
    if (!firstSignal) throw new Error('The first request has no abort signal.');

    discovery.input('alpine');
    discovery.hover(1);
    scheduler.advanceBy(0);

    expect(firstSignal.aborted).toBe(true);
    expect(discovery.state).toMatchObject({
      query: 'alpine',
      suggestions: [alpine, alpha],
      loading: true,
      activeIndex: 1
    });

    firstResponse.resolve([remote]);
    await settleAsyncWork();

    expect(discovery.state).toMatchObject({
      query: 'alpine',
      suggestions: [alpine, alpha],
      loading: true,
      activeIndex: 1
    });

    secondResponse.resolve([remote]);
    await settleAsyncWork();

    expect(discovery.state).toMatchObject({
      query: 'alpine',
      suggestions: [remote],
      loading: false,
      activeIndex: 0
    });
  });

  it('keeps keyboard navigation, escape, reopening, and selection in one state transition seam', () => {
    const scheduler = new TestScheduler();
    const createDiscoveryAfterInput = (key: string) => {
      const discovery = createCitySearchDiscovery({
        localMatches: () => [alpha, alpine],
        fetchSuggestions: vi.fn(),
        scheduler,
        debounceMs: 220
      });
      discovery.input('al');
      return { discovery, result: discovery.handleKey(key) };
    };

    const { discovery, result: down } = createDiscoveryAfterInput('ArrowDown');
    expect(down).toEqual({ handled: true });
    expect(discovery.state.activeIndex).toBe(1);

    expect(discovery.handleKey('ArrowUp')).toEqual({ handled: true });
    expect(discovery.state.activeIndex).toBe(0);

    expect(discovery.handleKey('Escape')).toEqual({ handled: true });
    expect(discovery.state.open).toBe(false);
    expect(discovery.state.suggestions).toEqual([alpha, alpine]);

    expect(discovery.handleKey('ArrowDown')).toEqual({ handled: true });
    expect(discovery.state.open).toBe(true);
    expect(discovery.state.activeIndex).toBe(0);

    const selection = discovery.handleKey('ArrowDown');
    expect(selection).toEqual({ handled: true });
    expect(discovery.state.activeIndex).toBe(1);
    expect(resultOf(discovery.handleKey('Enter'))).toEqual(alpine);
    expect(discovery.state).toMatchObject({
      query: alpine.label,
      suggestions: [],
      open: false,
      loading: false,
      activeIndex: -1
    });
  });

  it('reopens suggestions on focus and closes after the blur grace period', () => {
    const scheduler = new TestScheduler();
    const discovery = createCitySearchDiscovery({
      localMatches: () => [alpha],
      fetchSuggestions: vi.fn(),
      scheduler,
      debounceMs: 220,
      blurDelayMs: 150
    });

    discovery.input('alpha');
    discovery.handleKey('Escape');
    discovery.focus();
    expect(discovery.state.open).toBe(true);

    discovery.blur();
    scheduler.advanceBy(149);
    expect(discovery.state.open).toBe(true);
    scheduler.advanceBy(1);
    expect(discovery.state.open).toBe(false);

    discovery.focus();
    expect(discovery.state.open).toBe(true);
  });

  it('invalidates pending discovery when an external selection updates the field', async () => {
    const scheduler = new TestScheduler();
    const response = deferred<CitySuggestion[]>();
    const discovery = createCitySearchDiscovery({
      localMatches: () => [alpha],
      fetchSuggestions: () => response.promise,
      scheduler,
      debounceMs: 0
    });

    discovery.input('alpha');
    scheduler.advanceBy(0);
    discovery.setExternalQuery('Selected, SS');
    response.resolve([remote]);
    await settleAsyncWork();

    expect(discovery.state).toMatchObject({
      query: 'Selected, SS',
      suggestions: [],
      open: false,
      loading: false,
      activeIndex: -1
    });
  });
});
