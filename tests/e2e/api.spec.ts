import { expect, test } from '@playwright/test';
import fmrData from '../../src/lib/data/fmr-county.json' with { type: 'json' };

test('serves bundled HUD rents without an upstream API', async ({ request }) => {
  const response = await request.get('/api/fmr?state=12&county=057');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    ok: true,
    r1: expect.any(Number),
    r2: expect.any(Number),
    year: fmrData.meta.year,
    bundled: true
  });
});

test('validates bundled HUD lookup FIPS and handles missing counties', async ({ request }) => {
  const malformed = await request.get('/api/fmr?state=1&county=57');
  expect(malformed.status()).toBe(400);

  const missing = await request.get('/api/fmr?state=99&county=999');
  expect(missing.ok()).toBe(true);
  expect(await missing.json()).toEqual({ ok: false, reason: 'not-found' });
});
