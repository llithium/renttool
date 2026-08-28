import { describe, expect, it, vi } from 'vitest';
import { createRentLookupCoordinator, type RentLookupTarget } from './rentLookupCoordinator';
import type { LookupResult } from '$lib/types';

const rent: LookupResult = {
  r1: 1_250,
  r2: 1_600,
  yoy: null,
  source: 'hud-fmr',
  rentMetric: 'fair-market-rent',
  rentArea: 'Test County area',
  rentYear: 'FY2026'
};

const target: RentLookupTarget = { name: 'Shared, ZZ', lat: 40, lng: -74 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

describe('RentLookupCoordinator', () => {
  it('shares one rent request and aborts only after the last lease releases', async () => {
    const request = deferred<LookupResult>();
    const lookupRent = vi.fn((_lat: number, _lng: number, signal?: AbortSignal) => {
      void signal;
      return request.promise;
    });
    const onRentResolved = vi.fn();
    const coordinator = createRentLookupCoordinator(
      {
        lookupRent,
        coordinatesForPlace: vi.fn(async () => undefined)
      },
      onRentResolved
    );

    const first = coordinator.acquireRent(target);
    const second = coordinator.acquireRent({ ...target, name: target.name.toUpperCase() });
    const signal = lookupRent.mock.calls[0]?.[2];

    expect(lookupRent).toHaveBeenCalledOnce();
    expect(first.promise).toBe(second.promise);
    expect(signal).toBeInstanceOf(AbortSignal);

    first.release();
    expect(signal?.aborted).toBe(false);
    second.release();
    expect(signal?.aborted).toBe(true);

    request.resolve(rent);
    await expect(first.promise).resolves.toEqual(rent);
    expect(onRentResolved).not.toHaveBeenCalled();
  });

  it('restarts an aborted request and reports the successful shared result once', async () => {
    const firstRequest = deferred<LookupResult>();
    const secondRequest = deferred<LookupResult>();
    const signals: AbortSignal[] = [];
    const lookupRent = vi.fn((_lat: number, _lng: number, signal?: AbortSignal) => {
      signals.push(signal!);
      return signals.length === 1 ? firstRequest.promise : secondRequest.promise;
    });
    const onRentResolved = vi.fn();
    const coordinator = createRentLookupCoordinator(
      {
        lookupRent,
        coordinatesForPlace: vi.fn(async () => undefined)
      },
      onRentResolved
    );

    const canceled = coordinator.acquireRent(target);
    canceled.release();
    const retry = coordinator.acquireRent(target);

    expect(lookupRent).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    secondRequest.resolve(rent);
    await expect(retry.promise).resolves.toEqual(rent);
    expect(onRentResolved).toHaveBeenCalledOnce();
    expect(onRentResolved).toHaveBeenCalledWith(target.name, rent);

    firstRequest.resolve(rent);
    await expect(canceled.promise).resolves.toEqual(rent);
    expect(onRentResolved).toHaveBeenCalledOnce();
  });

  it('shares coordinate resolution and converts adapter failure into no coordinates', async () => {
    const request = deferred<readonly [number, number] | undefined>();
    const coordinatesForPlace = vi.fn(() => request.promise);
    const coordinator = createRentLookupCoordinator({
      lookupRent: vi.fn(async () => rent),
      coordinatesForPlace
    });

    const first = coordinator.coordinatesFor('City', 'ZZ');
    const second = coordinator.coordinatesFor('city', 'zz');
    expect(coordinatesForPlace).toHaveBeenCalledOnce();

    request.resolve([40.7, -74]);
    await expect(first).resolves.toEqual([40.7, -74]);
    await expect(second).resolves.toEqual([40.7, -74]);

    coordinatesForPlace.mockRejectedValueOnce(new Error('unavailable'));
    await expect(coordinator.coordinatesFor('Other', 'ZZ')).resolves.toBeUndefined();
  });
});
