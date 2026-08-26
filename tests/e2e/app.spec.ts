import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function selectCity(page: Page, query: string, label: string) {
  const city = page.getByRole('combobox', { name: 'City' });
  await city.fill(query);
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const option = page
    .getByRole('option')
    .filter({ hasText: new RegExp(`^${escapedLabel}(?:\\s|$)`) });
  await expect(option).toHaveCount(1);
  await expect(option).toBeVisible();
  // CitySearch commits on mousedown; dispatching the same event avoids racing
  // the list's entrance animation while the debounced response is settling.
  await option.dispatchEvent('mousedown');
}

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => document.querySelector('main')?.dataset.hydrated === 'true');
}

test('serves bundled HUD rents without an upstream API', async ({ request }) => {
  const response = await request.get('/api/fmr?state=12&county=057');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    ok: true,
    r1: expect.any(Number),
    r2: expect.any(Number),
    year: 'FY2026',
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

test('does not server-render the landing state before a saved city hydrates', async ({
  request
}) => {
  const response = await request.get('/?salary=80000&city=Tampa%2C+FL');
  const html = await response.text();
  expect(html).toContain('Loading saved rent plan');
  expect(html).not.toContain('Know what rent fits before you move.');
});

test('restores an off-list selected city and seed comparison from a shared URL', async ({
  page
}) => {
  await page.route('**/api/geocode**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        stateFips: '12',
        countyFips: '057',
        county: 'Hillsborough'
      })
    })
  );
  await page.route('**/api/fmr**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        r1: 1_250,
        r2: 1_600,
        year: 'FY2026',
        county: 'Hillsborough',
        bundled: true
      })
    })
  );
  await page.route('**/api/population**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, pop: 250_000 })
    })
  );

  await page.evaluate(() => localStorage.clear());
  const search = new URLSearchParams({
    salary: '80000',
    city: 'Shared Town, ZZ',
    lat: '40',
    lng: '-74'
  });
  search.append('compare-offlist', JSON.stringify({ name: 'Shared Town, ZZ', lat: 40, lng: -74 }));
  search.append('compare', 'New York, NY');
  await page.goto(`/?${search}`);
  await waitForHydration(page);

  await expect(page.getByRole('heading', { name: 'Shared Town, ZZ', exact: true })).toBeVisible();
  const comparison = page.locator('#comparison-section');
  await expect(
    comparison.getByRole('button', { name: 'Shared Town, ZZ', exact: true })
  ).toBeVisible();
  await expect(comparison.getByRole('button', { name: 'New York, NY', exact: true })).toBeVisible();
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/city-suggest**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ suggestions: [] })
    })
  );
  await page.route('https://*.basemaps.cartocdn.com/**', (route) => route.abort());
  await page.goto('/');
  await waitForHydration(page);
});

test('canonicalizes a shared URL after the client router is ready', async ({ page }) => {
  const routerErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('replaceState')) {
      routerErrors.push(message.text());
    }
  });

  await page.goto('/?city=Tampa%2C+FL&salary=80000');
  await waitForHydration(page);

  await expect(page.getByRole('heading', { name: 'Tampa, FL', exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).search).toBe('?salary=80000&city=Tampa%2C+FL');
  expect(routerErrors).toEqual([]);
});

test('focuses a visible calculator without scrolling the landing page', async ({ page }) => {
  const city = page.getByRole('combobox', { name: 'City' });
  const before = await page.evaluate(() => window.scrollY);

  await page.getByRole('button', { name: 'Build my rent plan' }).click();

  await expect(city).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
});

test('supports keyboard city selection and salary results', async ({ page }) => {
  const city = page.getByRole('combobox', { name: 'City' });
  await city.click();
  await city.pressSequentially('New York', { delay: 20 });
  await expect(page.getByRole('option', { name: 'New York, NY' })).toBeVisible();
  await expect(city).toHaveAttribute('aria-activedescendant', 'city-option-0');
  await city.press('Enter');
  await page.getByLabel('Annual salary', { exact: true }).fill('100000');
  await expect(page.getByRole('heading', { name: 'New York, NY' })).toBeVisible();
  await expect(
    page.locator('[data-testid="fact"]').getByText('Estimated median 1BR rent', { exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'City snapshot' })).toBeVisible();
  await expect(page.getByText('Median household income', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '2020–2024 ACS 5-year estimates ↗' })).toBeVisible();
});

test('shows bundled city suggestions before a slow API response', async ({ page }) => {
  await page.route('**/api/city-suggest**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ suggestions: [] })
    });
  });

  const city = page.getByRole('combobox', { name: 'City' });
  await city.fill('Gastonia');
  await expect(page.getByRole('option', { name: 'Gastonia, NC' })).toBeVisible({ timeout: 700 });
});

test('keeps bundled city suggestions when autocomplete is throttled', async ({ page }) => {
  await page.unroute('**/api/city-suggest**');
  await page.route('**/api/city-suggest**', (route) =>
    route.fulfill({
      status: 429,
      headers: { 'Retry-After': '60' },
      contentType: 'application/json',
      body: JSON.stringify({ suggestions: [] })
    })
  );

  const city = page.getByRole('combobox', { name: 'City' });
  await city.fill('Gastonia');
  await expect(page.getByRole('option', { name: 'Gastonia, NC' })).toBeVisible({ timeout: 700 });
});

test('keeps the accepted city explicit while a different city is being typed', async ({ page }) => {
  await selectCity(page, 'Tampa', 'Tampa, FL');
  await page.getByLabel('Annual salary', { exact: true }).fill('80000');
  const city = page.getByRole('combobox', { name: 'City' });
  await city.fill('Austin');
  await expect(
    page.getByText(
      'Choose a city from the list to update your plan. Your current plan remains Tampa, FL.'
    )
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tampa, FL' })).toBeVisible();
});

test('credits the bundled Apartment List estimates', async ({ page }) => {
  await selectCity(page, 'Tampa', 'Tampa, FL');
  await page.getByLabel('Annual salary', { exact: true }).fill('80000');
  const source = page.getByRole('link', { name: 'Apartment List Rent Estimates' });
  await expect(source).toHaveAttribute(
    'href',
    'https://www.apartmentlist.com/research/category/data-rent-estimates'
  );
  await expect(page.locator('footer')).toContainText('© Apartment List, Inc.');
});

test('has no serious accessibility violations in populated state', async ({ page }) => {
  const city = page.getByRole('combobox', { name: 'City' });
  await city.click();
  await city.pressSequentially('Tampa', { delay: 20 });
  await expect(page.getByRole('option', { name: 'Tampa, FL' })).toBeVisible();
  await city.press('Enter');
  await page.getByLabel('Annual salary', { exact: true }).fill('80000');
  await expect(page.getByRole('heading', { name: 'Tampa, FL' })).toBeVisible();
  // Result/side cards fade in via an entrance animation; wait for them to reach
  // full opacity so axe measures settled colors rather than mid-fade contrast.
  await page.waitForFunction(() =>
    [
      ...document.querySelectorAll('[data-testid="results"] > *, [data-testid="sidebar"] > *')
    ].every((el) => getComputedStyle(el).opacity === '1')
  );
  const results = await new AxeBuilder({ page }).exclude('.leaflet-control-container').analyze();
  expect(
    results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
  ).toEqual([]);
});

test('does not overflow a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const city = page.getByRole('combobox', { name: 'City' });
  await city.click();
  await city.pressSequentially('Tampa', { delay: 20 });
  await expect(page.getByRole('option', { name: 'Tampa, FL' })).toBeVisible();
  await city.press('Enter');
  await page.getByLabel('Annual salary', { exact: true }).fill('80000');
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));
  expect(widths.scroll).toBe(widths.client);
});

test('enforces the five-city comparison limit', async ({ page }) => {
  await page.getByLabel('Annual salary', { exact: true }).fill('100000');
  for (const [query, label] of [
    ['Tampa', 'Tampa, FL'],
    ['New York', 'New York, NY'],
    ['Austin', 'Austin, TX'],
    ['Boston', 'Boston, MA'],
    ['Miami', 'Miami, FL']
  ]) {
    await selectCity(page, query, label);
    await page.getByRole('button', { name: '+ Compare' }).click();
  }
  await selectCity(page, 'Seattle', 'Seattle, WA');
  await expect(
    page.getByTestId('sidebar').getByRole('button', { name: 'Comparison full' })
  ).toBeDisabled();
  await expect(page.getByText('5 / 5', { exact: true })).toBeVisible();
});

test('restores the comparison set from browser history links', async ({ page }) => {
  await page.getByLabel('Annual salary', { exact: true }).fill('80000');
  await expect.poll(() => new URL(page.url()).searchParams.get('salary')).toBe('80000');

  await selectCity(page, 'Tampa', 'Tampa, FL');
  await page.getByRole('button', { name: '+ Compare' }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.getAll('compare'))
    .toEqual(['Tampa, FL']);

  await selectCity(page, 'Austin', 'Austin, TX');
  await page.getByRole('button', { name: '+ Compare' }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.getAll('compare'))
    .toEqual(['Tampa, FL', 'Austin, TX']);

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Tampa, FL' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Tampa, FL' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Austin, TX' })).toHaveCount(0);
});

test('keeps each selected city with its salary when opening the detailed comparison', async ({
  page
}) => {
  await page.getByLabel('Annual salary', { exact: true }).fill('60000');
  await selectCity(page, 'Denver', 'Denver, CO');
  await page.getByRole('button', { name: '+ Compare' }).click();
  await page.getByLabel('Annual salary', { exact: true }).fill('90000');
  await selectCity(page, 'Nashville', 'Nashville, TN');
  await page.getByRole('button', { name: '+ Compare' }).click();

  await page.getByRole('link', { name: 'Detailed comparison →' }).click();
  await expect(page).toHaveURL(/\/compare\?/);
  await expect(page.getByRole('heading', { name: 'Denver, CO' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nashville, TN' })).toBeVisible();
  await expect(page.getByLabel('Annual salary in Denver, CO')).toHaveValue('60,000');
  await expect(page.getByLabel('Annual salary in Nashville, TN')).toHaveValue('90,000');
  await expect(page.getByText('$78 under budget', { exact: true })).toHaveCSS(
    'color',
    'rgb(20, 123, 59)'
  );
  const oneBedroomRow = page.getByRole('row').filter({ hasText: /^1BR rent/ });
  await expect(oneBedroomRow).toHaveCount(1);
  await expect(oneBedroomRow.locator('td[data-tone="best"]')).toContainText('$1,216/mo');
  await expect(oneBedroomRow.locator('td[data-tone="worst"]')).toContainText('$1,422/mo');

  await page.setViewportSize({ width: 734, height: 969 });
  const criterion = page.getByLabel('Decision criterion');
  await expect(criterion).toBeVisible();
  const tabletCriterionWidths = await criterion.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth
  }));
  expect(tabletCriterionWidths.scroll).toBe(tabletCriterionWidths.client);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCriterionWidths = await criterion.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth
  }));
  expect(mobileCriterionWidths.scroll).toBe(mobileCriterionWidths.client);

  const denverScenario = page.locator('[data-testid="scenario"]').filter({ hasText: 'Denver, CO' });
  await expect(denverScenario).toHaveCount(1);
  const planLinks = [
    denverScenario.getByRole('link', { name: 'Denver, CO', exact: true }),
    page
      .getByRole('region', { name: 'Decision brief' })
      .getByRole('link', { name: /Denver, CO|Nashville, TN/, exact: true }),
    page.locator('table thead').getByRole('link', { name: 'Denver, CO', exact: true })
  ];
  for (const link of planLinks) {
    await expect(link).toHaveCount(1);
    const href = await link.getAttribute('href');
    expect(href).not.toBeNull();
    const search = new URL(href!, 'http://rent.test').searchParams;
    expect(search.get('salary')).toBe('90000');
    expect(search.getAll('compare')).toEqual(['Denver, CO', 'Nashville, TN']);
    expect(
      search
        .getAll('compare-salary')
        .map((value) => JSON.parse(value) as { name: string; salary: number })
    ).toEqual([
      { name: 'Denver, CO', salary: 60_000 },
      { name: 'Nashville, TN', salary: 90_000 }
    ]);
  }

  await denverScenario.getByRole('link', { name: 'Denver, CO', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Denver, CO' })).toBeVisible();
  await expect(page.getByLabel('Annual salary', { exact: true })).toHaveValue('90,000');
  await expect.poll(() => new URL(page.url()).searchParams.get('salary')).toBe('90000');
  await page.goBack();
  await expect(page).toHaveURL(/\/compare\?/);
  await expect(page.getByLabel('Annual salary in Denver, CO')).toHaveValue('60,000');
  await expect(page.getByLabel('Annual salary in Nashville, TN')).toHaveValue('90,000');
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Denver, CO' })).toBeVisible();
  await expect(page.getByLabel('Annual salary', { exact: true })).toHaveValue('90,000');
});

test('compares equivalent salaries with a selectable reference city', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.goto(
    '/compare?salary=80000&city=Tampa%2C+FL&compare=Tampa%2C+FL&compare=Austin%2C+TX&compare=New%20York%2C+NY&compare-salary=%7B%22name%22%3A%22Tampa%2C+FL%22%2C%22salary%22%3A80000%7D&compare-salary=%7B%22name%22%3A%22Austin%2C+TX%22%2C%22salary%22%3A90000%7D&compare-salary=%7B%22name%22%3A%22New%20York%2C+NY%22%2C%22salary%22%3A70000%7D'
  );
  await waitForHydration(page);

  const equivalence = page.getByTestId('salary-equivalence');
  await expect(
    equivalence.getByRole('heading', { name: 'Equivalent salary by city' })
  ).toBeVisible();
  const reference = equivalence.getByLabel('Match spending room from', { exact: true });
  await expect(reference).toHaveValue('Tampa, FL');
  await expect(equivalence.getByText('Reference', { exact: true })).toHaveCount(1);
  const austinArticle = equivalence.locator('article').filter({ hasText: 'Austin, TX' });
  const austinRequiredSalary = austinArticle.locator('dd').nth(1);
  const austinRequiredBefore = await austinRequiredSalary.textContent();
  const targetBefore = await equivalence.getByText(/Target spending room:/).textContent();

  await reference.selectOption({ label: 'Austin, TX' });
  await expect(reference).toHaveValue('Austin, TX');
  await expect(equivalence.locator('article').filter({ hasText: 'Austin, TX' })).toContainText(
    'Reference'
  );
  await expect.poll(() => austinRequiredSalary.textContent()).not.toBe(austinRequiredBefore);
  await expect
    .poll(() => equivalence.getByText(/Target spending room:/).textContent())
    .not.toBe(targetBefore);

  await page.getByRole('button', { name: 'Remove Austin, TX' }).click();
  await expect(reference).toHaveValue('Tampa, FL');
  await expect(equivalence.getByText('Reference', { exact: true })).toHaveCount(1);
  await expect(equivalence.locator('article')).toHaveCount(2);

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    []
  );
});

test('shows salary equivalence only when two comparison entries are present', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.goto(
    '/compare?salary=80000&city=Tampa%2C+FL&compare=Tampa%2C+FL&compare-salary=%7B%22name%22%3A%22Tampa%2C+FL%22%2C%22salary%22%3A80000%7D'
  );
  await waitForHydration(page);
  await expect(page.getByTestId('salary-equivalence')).toHaveCount(0);

  await selectCity(page, 'Austin', 'Austin, TX');
  await expect(page.getByTestId('salary-equivalence')).toBeVisible();
});

test('exposes map markers to the keyboard', async ({ page }) => {
  await selectCity(page, 'Tampa', 'Tampa, FL');
  await page.getByLabel('Annual salary', { exact: true }).fill('80000');
  await expect(page.getByText('Current city: Tampa, FL', { exact: true })).toBeVisible();
  const marker = page.getByRole('button', {
    name: 'New York, NY, 1 bedroom $2,443, over budget'
  });
  // Selecting a city recenters the map on it, so a far-away marker like New York
  // starts off-screen (Leaflet culls off-viewport markers). Zoom out until it's
  // in view before exercising keyboard access.
  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  for (let i = 0; i < 5 && !(await marker.isVisible()); i++) {
    await zoomOut.click();
  }
  await expect(marker).toBeVisible();

  // A keyboard-focused marker must keep a visible ring. RentMap suppresses the
  // default `:focus` square from its scoped (unlayered) <style>, which outranks
  // the layered `:focus-visible` rule in app.css, so the ring has to be restored
  // there — easy to drop by accident, invisible to the assertions below.
  // Chromium only matches :focus-visible when the last interaction was a
  // keypress, so tab into the map before focusing the marker itself — a bare
  // .focus() from a mouse-driven test never qualifies.
  await page.keyboard.press('Tab');
  await marker.focus();
  const ring = await marker.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      focusVisible: element.matches(':focus-visible'),
      width: style.outlineWidth,
      style: style.outlineStyle
    };
  });
  expect(ring.focusVisible).toBe(true);
  expect(ring.style).not.toBe('none');
  expect(ring.width).toBe('2px');

  await marker.press('Enter');
  await expect(page.getByRole('heading', { name: 'New York, NY' })).toBeVisible();
});

test('recenters the map when a comparison city is selected from the table', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?salary=69000&city=Lansing%2C+MI&compare=Lansing%2C+MI&compare=Gastonia%2C+NC');
  await waitForHydration(page);

  await page.getByRole('button', { name: 'Gastonia, NC', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gastonia, NC' })).toBeVisible();

  const selectedMarker = page.getByRole('button', {
    name: 'Gastonia, NC, 1 bedroom $983, fits budget'
  });
  await expect(selectedMarker).toBeVisible();
  const position = await selectedMarker.evaluate((marker) => {
    const mapElement = document.querySelector('.leaflet-container');
    if (!mapElement) return null;
    const markerRect = marker.getBoundingClientRect();
    const mapRect = mapElement.getBoundingClientRect();
    return {
      x: markerRect.left + markerRect.width / 2 - (mapRect.left + mapRect.width / 2),
      y: markerRect.top + markerRect.height / 2 - (mapRect.top + mapRect.height / 2)
    };
  });
  expect(position).not.toBeNull();
  if (!position) throw new Error('Map is missing.');
  expect(Math.abs(position.x)).toBeLessThan(4);
  expect(Math.abs(position.y)).toBeLessThan(4);
});

test('labels HUD data as Fair Market Rent', async ({ page }) => {
  await page.route('**/api/city-suggest**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        suggestions: [{ label: 'Ithaca, NY', city: 'Ithaca', state: 'NY', lat: 42.44, lng: -76.5 }]
      })
    })
  );
  await page.route('**/api/geocode**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, stateFips: '36', countyFips: '109', county: 'Tompkins' })
    })
  );
  await page.route('**/api/fmr**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        r1: 1400,
        r2: 1700,
        county: 'Tompkins County',
        year: 'FY2026',
        bundled: true
      })
    })
  );
  await page.route('**/api/population**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, pop: 32108, name: 'Ithaca', source: 'simplemaps' })
    })
  );
  await selectCity(page, 'Ithaca', 'Ithaca, NY');
  await page.getByLabel('Annual salary', { exact: true }).fill('80000');
  await expect(
    page.locator('[data-testid="fact"]').getByText('1BR Fair Market Rent', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('Tompkins County area · FY2026', { exact: true })).toBeVisible();
  await expect(
    page.locator('[data-testid="fact"]').getByText('Population', { exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'City snapshot' })).toHaveCount(0);
});

test('restores selected city and salary after reload', async ({ page }) => {
  await selectCity(page, 'Tampa', 'Tampa, FL');
  await page.getByLabel('Annual salary', { exact: true }).fill('80000');
  // State is mirrored into the URL, so the reload restores from the query string.
  await expect.poll(() => new URL(page.url()).searchParams.get('city')).toBe('Tampa, FL');
  await expect.poll(() => new URL(page.url()).searchParams.get('salary')).toBe('80000');
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: 'Tampa, FL' })).toBeVisible();
});

test('restores state from a deep link with no stored data', async ({ page, context }) => {
  // A shared link opened on a fresh device: no localStorage to fall back on.
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?salary=80000&city=Tampa%2C+FL&compare=Austin%2C+TX');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: 'Tampa, FL' })).toBeVisible();
  await expect(page.getByLabel('Annual salary', { exact: true })).toHaveValue('80,000');
  await expect(page.getByText('Austin, TX')).toBeVisible();
});

test('re-resolves an off-list city from deep-linked coordinates', async ({ page }) => {
  await page.route('**/api/geocode**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, stateFips: '36', countyFips: '109', county: 'Tompkins' })
    })
  );
  await page.route('**/api/fmr**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        r1: 1400,
        r2: 1700,
        county: 'Tompkins County',
        year: 'FY2026',
        bundled: true
      })
    })
  );
  await page.goto('/?salary=80000&city=Ithaca%2C+NY&lat=42.44&lng=-76.5');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: 'Ithaca, NY' })).toBeVisible();
  await expect(
    page.locator('[data-testid="fact"]').getByText('1BR Fair Market Rent', { exact: true })
  ).toBeVisible();
});
