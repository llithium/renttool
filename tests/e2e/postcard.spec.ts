import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import rentData from '../../src/lib/data/apartment-list-rents.json' with { type: 'json' };
import imageData from '../../src/lib/data/city-images.json' with { type: 'json' };

const RENTS = rentData.cities as Record<string, { r1: number; r2: number }>;
const IMAGES = imageData as Record<string, { alt: string; photographerName: string }>;
const NO_PHOTO = Object.keys(RENTS).find((name) => !IMAGES[name])!;
const dollars = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

const SLC = 'Salt Lake City, UT';
const SLC_URL = `/?salary=58000&city=${encodeURIComponent(SLC)}`;
const nearby = [
  {
    label: 'Murray, UT',
    city: 'Murray',
    state: 'UT',
    lat: 40.66,
    lng: -111.89,
    miles: 9,
    pop: 50000
  },
  {
    label: 'West Valley City, UT',
    city: 'West Valley City',
    state: 'UT',
    lat: 40.69,
    lng: -112.0,
    miles: 8,
    pop: 140000
  },
  {
    label: 'Draper, UT',
    city: 'Draper',
    state: 'UT',
    lat: 40.52,
    lng: -111.86,
    miles: 20,
    pop: 51000
  }
];
const PIXEL =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 2"><rect width="4" height="2" fill="black"/></svg>';

async function hydrated(page: Page) {
  await page.waitForFunction(() => document.querySelector('main')?.dataset.hydrated === 'true');
}

async function seriousViolations(page: Page) {
  const result = await new AxeBuilder({ page }).exclude('.leaflet-container').analyze();
  return result.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
}

async function noSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0
  );
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/city-suggest**', (route) =>
    route.fulfill({ json: { suggestions: [] } })
  );
  await page.route('**/api/nearby**', (route) => route.fulfill({ json: { nearby } }));
  await page.route('https://images.unsplash.com/**', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: PIXEL })
  );
  await page.route(/^https:\/\/(upload|thumb)\.wikimedia\.org\//, (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: PIXEL })
  );
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('https://en.wikipedia.org/api/**', (route) =>
    route.fulfill({ status: 404, json: { type: 'not_found' } })
  );
});

test('server-renders a loading card, not the home page, before a saved city hydrates', async ({
  request
}) => {
  const html = await (await request.get(`/?salary=80000&city=Tampa%2C+FL`)).text();
  expect(html).toContain('Loading your rent plan');
  expect(html).not.toContain('See the city');
});

test('addresses the postcard on the home page and opens the city', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  await expect(page.getByRole('heading', { name: /Find your city/ })).toBeVisible();
  await page.getByLabel('Salary offer, per year').fill('58000');
  await expect(page.getByRole('img', { name: 'Rent ceiling $1,450 a month' })).toBeVisible();
  await expect(page.getByTestId('ceiling-tally')).toContainText('cities at this ceiling');
  await expect(page.getByRole('heading', { name: /cities within \$1,450/ })).toBeVisible();

  const city = page.getByRole('combobox', { name: 'City', exact: true });
  await city.fill('Salt Lake');
  await expect(page.getByRole('option', { name: SLC, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'See the city' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Salt Lake City' })).toBeVisible();
  const rent = RENTS[SLC].r1;
  await expect(page.getByTestId('city-rent')).toHaveText(dollars(rent));
  await expect(page.getByTestId('rent-ceiling')).toHaveText('$1,450');
  await expect(page.getByTestId('verdict')).toHaveText(
    `Fits, with ${dollars(1450 - rent)} to spare`
  );
  await expect(page).toHaveURL(/city=Salt\+Lake\+City/);
});

test('shows the city photo with credit, and draws a ridgeline when a city has none', async ({
  page
}) => {
  await page.goto(SLC_URL);
  await hydrated(page);
  const card = page.getByTestId('city-postcard');
  await expect(card.getByRole('img', { name: IMAGES[SLC].alt })).toBeVisible();
  await expect(card.getByRole('link', { name: IMAGES[SLC].photographerName })).toBeVisible();

  await page.goto(`/?salary=58000&city=${encodeURIComponent(NO_PHOTO)}`);
  await hydrated(page);
  await expect(page.getByTestId('city-postcard').getByTestId('city-fallback-art')).toBeVisible();
  await expect(page.getByTestId('city-postcard')).toContainText('° N');
});

test('falls back to the ridgeline when a photo fails to load', async ({ page }) => {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.goto(SLC_URL);
  await hydrated(page);
  await expect(page.getByTestId('city-postcard').getByTestId('city-fallback-art')).toBeVisible();
});

test('links out to listings, Wikipedia, and Google Maps', async ({ page }) => {
  await page.goto(SLC_URL);
  await hydrated(page);
  const listings = page.locator('#listing-search');
  await expect(
    listings.getByRole('link', { name: 'Apartments.com, under $1,400' })
  ).toHaveAttribute('href', 'https://www.apartments.com/salt-lake-city-ut/under-1400/');
  await expect(listings.getByRole('link', { name: /^Zillow, under \$1,450/ })).toHaveAttribute(
    'href',
    /^https:\/\/www\.zillow\.com\/salt-lake-city-ut\/rentals\//
  );
  await expect(listings.getByRole('link', { name: 'Zumper' })).toHaveAttribute(
    'href',
    'https://www.zumper.com/apartments-for-rent/salt-lake-city-ut'
  );
  await expect(listings.getByRole('link', { name: 'HotPads' })).toHaveAttribute(
    'href',
    'https://hotpads.com/salt-lake-city-ut/apartments-for-rent'
  );
  const living = page.locator('#city-details');
  await expect(living.getByRole('link', { name: 'Wikipedia' })).toHaveAttribute(
    'href',
    'https://en.wikipedia.org/wiki/Salt_Lake_City%2C_Utah'
  );
  await expect(living.getByRole('link', { name: 'Google Maps' })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=Salt%20Lake%20City%2C%20UT'
  );
  await expect(page.getByRole('link', { name: 'Open in Google Maps' })).toBeVisible();
});

test('uses the Wikipedia lead on the back of the card when there is one', async ({ page }) => {
  await page.route('https://en.wikipedia.org/api/**', (route) =>
    route.fulfill({
      json: {
        type: 'standard',
        extract:
          'Salt Lake City is the capital and most populous city of Utah. The Wasatch Range rises behind downtown.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Salt_Lake_City' } }
      }
    })
  );
  await page.goto(SLC_URL);
  await hydrated(page);
  await expect(page.getByTestId('city-lead')).toHaveText(
    'Salt Lake City is the capital and most populous city of Utah.'
  );
  await expect(page.locator('#city-details')).toContainText(
    'The Wasatch Range rises behind downtown.'
  );
  await expect(
    page.locator('#city-details').getByRole('link', { name: 'Wikipedia' })
  ).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Salt_Lake_City');
});

test('switches housing and keeps it in the address', async ({ page }) => {
  await page.goto(SLC_URL);
  await hydrated(page);
  await page
    .getByRole('group', { name: 'Housing' })
    .getByRole('button', { name: '2 bed', exact: true })
    .click();
  await expect(page.getByTestId('plan-summary')).toContainText('2-bed rent');
  await expect(page.getByTestId('city-rent')).toHaveText(dollars(RENTS[SLC].r2));
  await expect(page).toHaveURL(/housing=2br/);
});

test('tightens the ceiling with personal costs', async ({ page }) => {
  await page.goto(SLC_URL);
  await hydrated(page);
  await page.getByRole('button', { name: 'Tighten with your costs' }).click();
  const expenses = page.getByLabel('Recurring expenses');
  await expect(expenses).toBeFocused();
  await expenses.fill('2600');
  const ceiling =
    Number((await page.getByTestId('take-home').innerText()).replace(/\D/g, '')) - 2600;
  await expect(page.getByTestId('rent-ceiling')).toHaveText(dollars(ceiling));
  await expect(page.getByTestId('left-after-rent')).toBeVisible();
  await page.getByRole('button', { name: '30% of gross' }).click();
  await expect(page.getByTestId('rent-ceiling')).toHaveText('$1,450');
});

test('lists nearby towns nearest first against the ceiling and adds one to compare', async ({
  page
}) => {
  await page.goto(SLC_URL);
  await hydrated(page);
  const section = page.locator('#nearby-options');
  const towns = section.locator('tbody th');
  await expect(towns).toHaveCount(3);
  await expect(towns.nth(0)).toContainText('West Valley City');
  await expect(towns.nth(1)).toContainText('Murray');
  await expect(towns.nth(2)).toContainText('Draper');
  await section.getByRole('button', { name: 'Compare Murray, UT' }).click();
  await expect(
    section.getByRole('button', { name: 'Remove Murray, UT from comparison' })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Compare 1 city' })).toBeVisible();
});

test('builds a postcard rack, ranks it, edits an offer, and removes a city', async ({ page }) => {
  await page.goto(SLC_URL);
  await hydrated(page);
  await page.getByRole('button', { name: 'Add to compare' }).click();
  await expect(page.getByRole('button', { name: 'In your comparison' })).toBeVisible();
  await page.getByRole('link', { name: /^Compare/ }).click();
  await expect(page).toHaveURL(/\/compare/);
  await hydrated(page);

  const add = page.getByRole('combobox', { name: 'Add a city' });
  await add.fill('Boise');
  await page.getByRole('option', { name: 'Boise, ID', exact: true }).dispatchEvent('mousedown');
  await expect(page.getByTestId('rack-card')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Two offers, side by side' })).toBeVisible();
  await expect(page.getByTestId('decision-brief')).toContainText('leaves the most');

  await page
    .getByRole('group', { name: 'Decision brief' })
    .getByRole('combobox')
    .selectOption('rent');
  await expect(page.getByTestId('decision-brief')).toHaveText(
    `Salt Lake City has the lowest rent: ${dollars(RENTS[SLC].r1)} a month, ${dollars(
      RENTS['Boise, ID'].r1 - RENTS[SLC].r1
    )} less than Boise.`
  );

  const boise = page.getByRole('article', { name: 'Boise, ID' });
  await boise.getByLabel('Salary offer in Boise, ID').fill('50000');
  await expect(boise).toContainText(`of a ${dollars(1250)} ceiling`);
  await expect(page.getByTestId('salary-equivalence')).toContainText('needed');
  await expect(page.getByRole('table')).toContainText('Annual salary');

  await boise.getByRole('button', { name: 'Remove Boise, ID' }).click();
  await expect(page.getByTestId('rack-card')).toHaveCount(1);
});

test('keeps a comparison to five cities', async ({ page }) => {
  const search = new URLSearchParams({ salary: '70000' });
  for (const name of ['Boise, ID', 'Denver, CO', 'Raleigh, NC', 'Austin, TX', 'Tampa, FL'])
    search.append('compare', name);
  await page.goto(`/compare?${search}`);
  await hydrated(page);
  await expect(page.getByTestId('rack-card')).toHaveCount(5);
  await expect(page.getByText("That's five cities, the most a comparison holds.")).toBeVisible();
});

test('restores the city and salary after a reload', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  await page.getByLabel('Salary offer, per year').fill('64000');
  await page.getByRole('combobox', { name: 'City', exact: true }).fill('Boise');
  await page.getByRole('option', { name: 'Boise, ID', exact: true }).dispatchEvent('mousedown');
  await expect(page.getByRole('heading', { level: 1, name: 'Boise' })).toBeVisible();
  await page.reload();
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Boise' })).toBeVisible();
  await expect(page.getByLabel('Salary', { exact: true })).toHaveValue('64,000');
});

test('canonicalizes a shared address once the router is ready', async ({ page }) => {
  const routerErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /replaceState|pushState/.test(message.text()))
      routerErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    if (/replaceState|pushState/.test(error.message)) routerErrors.push(error.message);
  });
  await page.goto('/?salary=080000&city=Salt%20Lake%20City%2C%20UT&unused=1');
  await hydrated(page);
  await expect(page).toHaveURL(/salary=80000/);
  expect(routerErrors).toEqual([]);
});

test('gives map pins names a screen reader can use', async ({ page }) => {
  await page.goto(SLC_URL);
  await hydrated(page);
  const pin = page.locator('.pc-pin-icon[aria-label^="Salt Lake City, UT, 1-bed"]');
  await expect(pin).toHaveAttribute('aria-label', /fits your ceiling, showing now/);
  await expect(pin).toHaveAttribute('tabindex', '0');
});

for (const width of [390, 1280]) {
  test(`fits the screen and passes accessibility checks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?salary=58000');
    await hydrated(page);
    await noSideScroll(page);
    expect(await seriousViolations(page)).toEqual([]);

    await page.goto(SLC_URL);
    await hydrated(page);
    await expect(page.locator('#nearby-options tbody tr')).toHaveCount(3);
    await noSideScroll(page);
    expect(await seriousViolations(page)).toEqual([]);

    const search = new URLSearchParams({ salary: '58000' });
    search.append('compare', SLC);
    search.append('compare', 'Boise, ID');
    await page.goto(`/compare?${search}`);
    await hydrated(page);
    await expect(page.getByTestId('rack-card')).toHaveCount(2);
    await noSideScroll(page);
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test('narrows nearby towns to a commute without putting the address in the link', async ({
  page
}) => {
  await page.route('**/api/commute-address', (route) =>
    route.fulfill({
      json: {
        destinations: [{ label: 'Temple Square, Salt Lake City, Utah', lat: 40.77, lng: -111.89 }]
      }
    })
  );
  await page.route('**/api/commute', (route) =>
    route.fulfill({ json: { minutes: [25, 45, null] } })
  );
  await page.goto(SLC_URL);
  await hydrated(page);
  const section = page.locator('#nearby-options');
  await expect(section.locator('tbody tr')).toHaveCount(3);
  await section.getByRole('searchbox', { name: 'Commute destination' }).fill('Temple Square');
  await section.getByRole('button', { name: 'Find', exact: true }).click();
  await section
    .getByRole('button', { name: 'Temple Square, Salt Lake City, Utah', exact: true })
    .click();
  await expect(section).toContainText('within 30 minutes');
  await expect(section.locator('tbody tr')).toHaveCount(1);
  await expect(section.locator('tbody th')).toContainText('West Valley City');
  await expect(section.getByRole('columnheader', { name: 'Drive' })).toBeVisible();
  await expect(section.locator('tbody')).toContainText('25 min');
  expect(page.url()).not.toContain('Temple');
});
