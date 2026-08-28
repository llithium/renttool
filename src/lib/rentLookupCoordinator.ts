import type { LookupResult } from '$lib/types';

export interface RentLookupAdapters {
  /** Resolve a city's rent data, with cancellation owned by the coordinator. */
  lookupRent: (lat: number, lng: number, signal?: AbortSignal) => Promise<LookupResult>;
  /** Resolve coordinates for an exact city/state identity. */
  coordinatesForPlace: (
    city: string,
    state: string
  ) => Promise<readonly [number, number] | undefined>;
}

export interface RentLookupTarget {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

export interface RentLookupLease {
  readonly promise: Promise<LookupResult>;
  release(): void;
}

export interface RentLookupCoordinator {
  coordinatesFor(city: string, state: string): Promise<readonly [number, number] | undefined>;
  acquireRent(target: RentLookupTarget): RentLookupLease;
}

interface SharedRentLookup {
  readonly controller: AbortController;
  promise: Promise<LookupResult>;
  readonly consumers: Set<symbol>;
}

function unavailableLookup(): LookupResult {
  return {
    r1: null,
    r2: null,
    yoy: null,
    source: 'none',
    rentMetric: 'unknown',
    rentArea: '',
    rentYear: ''
  };
}

/**
 * Coordinates the network side of city resolution without owning plan state.
 *
 * Coordinate requests are shared by city identity. Rent requests are shared by
 * canonical city name and stay alive while at least one active or comparison
 * intent holds a lease; the last release aborts the request.
 */
export function createRentLookupCoordinator(
  adapters: RentLookupAdapters,
  onRentResolved: (name: string, result: LookupResult) => void = () => undefined
): RentLookupCoordinator {
  const coordinateLookups = new Map<string, Promise<readonly [number, number] | undefined>>();
  const rentLookups = new Map<string, SharedRentLookup>();

  function coordinatesFor(
    city: string,
    state: string
  ): Promise<readonly [number, number] | undefined> {
    const key = `${city.toLowerCase()},${state.toLowerCase()}`;
    const existing = coordinateLookups.get(key);
    if (existing) return existing;

    let request: Promise<readonly [number, number] | undefined>;
    try {
      request = Promise.resolve(adapters.coordinatesForPlace(city, state));
    } catch {
      request = Promise.resolve(undefined);
    }
    const lookup = request
      .catch(() => undefined)
      .finally(() => {
        if (coordinateLookups.get(key) === lookup) coordinateLookups.delete(key);
      });
    coordinateLookups.set(key, lookup);
    return lookup;
  }

  function acquireRent(target: RentLookupTarget): RentLookupLease {
    const key = target.name.toLowerCase();
    let lookup = rentLookups.get(key);
    if (lookup?.controller.signal.aborted) {
      rentLookups.delete(key);
      lookup = undefined;
    }

    if (!lookup) {
      const controller = new AbortController();
      const shared: SharedRentLookup = {
        controller,
        promise: Promise.resolve(unavailableLookup()),
        consumers: new Set()
      };
      rentLookups.set(key, shared);

      let request: Promise<LookupResult>;
      try {
        request = Promise.resolve(adapters.lookupRent(target.lat, target.lng, controller.signal));
      } catch {
        request = Promise.resolve(unavailableLookup());
      }
      shared.promise = request
        .catch(() => unavailableLookup())
        .then((result) => {
          if (!controller.signal.aborted) onRentResolved(target.name, result);
          return result;
        })
        .finally(() => {
          if (rentLookups.get(key) === shared) rentLookups.delete(key);
        });
      lookup = shared;
    }

    const shared = lookup;
    const consumer = Symbol();
    shared.consumers.add(consumer);
    let released = false;

    return {
      promise: shared.promise,
      release() {
        if (released) return;
        released = true;
        shared.consumers.delete(consumer);
        if (!shared.consumers.size && rentLookups.get(key) === shared) {
          shared.controller.abort();
        }
      }
    };
  }

  return { coordinatesFor, acquireRent };
}
