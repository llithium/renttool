import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/api/population**', (route) => route.fulfill({ json: { ok: false } }));
  await page.route('**/api/fmr**', (route) =>
    route.fulfill({ json: { ok: true, r1: 1250, r2: 1600, year: 'FY2026', county: 'Test County' } })
  );
});

for (const width of [1280, 390]) {
  test(`checks collapsed nearby rents and shares the result with the map and comparisons at ${width}px`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const nearby = [
      { city: 'Arlington', state: 'VA', lat: 38.88, lng: -77.1 },
      { city: 'Alexandria', state: 'VA', lat: 38.8, lng: -77.05 },
      { city: 'Silver Spring', state: 'MD', lat: 38.99, lng: -77.02 },
      { city: 'Centreville', state: 'VA', lat: 38.84, lng: -77.43 },
      { city: 'Dale City', state: 'VA', lat: 38.65, lng: -77.34 },
      { city: 'Missing Town', state: 'VA', lat: 38.66, lng: -77.35 }
    ].map((place) => ({ ...place, label: `${place.city}, ${place.state}`, pop: 71000, miles: 22 }));
    await page.route('**/api/nearby**', (route) => route.fulfill({ json: { nearby } }));
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const requests: string[] = [];
    await page.route('**/api/geocode**', async (route) => {
      const lat = new URL(route.request().url()).searchParams.get('lat')!;
      requests.push(lat);
      if (lat === '38.65') {
        await held;
        await route.fulfill({ json: { ok: true, stateFips: '51', countyFips: '153' } });
      } else {
        await route.fulfill({ json: { ok: false } });
      }
    });

    await page.goto('/?salary=80000&city=Washington%2C+DC');
    const section = page.locator('#nearby-options');
    await expect.poll(() => requests).toContain('38.65');
    await expect.poll(() => requests).toContain('38.66');
    expect(requests.filter((lat) => lat !== '38.65' && lat !== '38.66')).toEqual([]);
    expect(new URL(page.url()).searchParams.getAll('compare-offlist')).toEqual([]);
    await expect(section.getByText('Dale City, VA', { exact: true })).toHaveCount(0);
    await section.getByRole('button', { name: 'Show 2 more places' }).click();
    const dale = section.getByRole('listitem').filter({ hasText: 'Dale City, VA' });
    const missing = section.getByRole('listitem').filter({ hasText: 'Missing Town, VA' });
    await expect(dale.getByText('Checking area-level rent…')).toBeVisible();
    await expect(missing.getByText('Rent estimate unavailable.', { exact: true })).toBeVisible();
    const marker = page.getByRole('button', { name: /Dale City, VA, .*checking area-level rent/ });
    await expect(marker).toBeAttached();

    await dale.getByRole('button', { name: 'Compare rent', exact: true }).click();
    await expect(dale.getByRole('button', { name: 'Checking rent', exact: true })).toBeVisible();
    release();
    await expect(dale.getByText('$1,250/mo', { exact: false })).toBeVisible();
    await expect(dale.getByText(/Test County area/)).toBeVisible();
    await expect(dale.getByRole('button', { name: 'Remove comparison' })).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Dale City, VA, 1 bedroom $1,250, fits budget',
        exact: true
      })
    ).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Washington, DC', exact: true })).toBeVisible();
    expect(requests.filter((lat) => lat === '38.65')).toHaveLength(1);
    expect(requests.filter((lat) => lat === '38.66')).toHaveLength(1);
    await section.screenshot({ path: test.info().outputPath('nearby-rents.png') });
  });
}

test('checks missing map rents when they enter view and settles unavailable markers', async ({
  page
}) => {
  await page.route('**/api/nearby**', (route) => route.fulfill({ json: { nearby: [] } }));
  await page.addInitScript(() => {
    const city = (name: string, state: string, lat: number, lng: number) => ({
      name: `${name}, ${state}`,
      city: name,
      state,
      lat,
      lng,
      r1: null,
      r2: null,
      yoy: null,
      tax: 'varies',
      pop: null,
      populationSource: null,
      citySnapshot: null,
      source: 'none',
      rentMetric: 'unknown',
      rentArea: '',
      rentYear: ''
    });
    localStorage.setItem(
      'rentToolLast.v3',
      JSON.stringify({
        salary: 80000,
        selected: 'Tampa, FL',
        custom: [city('Map Town', 'FL', 27.99, -82.45), city('Far Town', 'WA', 47.6, -122.33)]
      })
    );
  });
  const requests: string[] = [];
  await page.route('**/api/geocode**', async (route) => {
    const lat = new URL(route.request().url()).searchParams.get('lat')!;
    requests.push(lat);
    await route.fulfill({
      json: lat === '27.99' ? { ok: true, stateFips: '12', countyFips: '057' } : { ok: false }
    });
  });

  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Map Town, FL, 1 bedroom $1,250, fits budget', exact: true })
  ).toBeVisible();
  expect(requests).toEqual(['27.99']);
  const map = page.locator('.leaflet-theme');
  for (let i = 0; i < 5; i++) await map.getByRole('button', { name: 'Zoom out' }).click();
  const unavailable = page.getByRole('button', { name: /Far Town, WA, .*rent data unavailable/ });
  await expect(unavailable).toBeVisible();
  expect(requests).toEqual(['27.99', '47.6']);
  await page.getByLabel('Annual salary', { exact: true }).fill('90000');
  await expect(
    page.getByRole('button', { name: 'Map Town, FL, 1 bedroom $1,250, fits budget', exact: true })
  ).toBeAttached();
  expect(new URL(page.url()).searchParams.get('city')).toBe('Tampa, FL');
  expect(new URL(page.url()).searchParams.getAll('compare-offlist')).toEqual([]);
  expect(requests).toEqual(['27.99', '47.6']);
});
