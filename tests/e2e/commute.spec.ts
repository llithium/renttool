import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { chooseSelect } from './select';

const nearby = [
  {
    label: 'Evanston, IL',
    city: 'Evanston',
    state: 'IL',
    lat: 42.045,
    lng: -87.688,
    miles: 12,
    pop: 75000
  },
  {
    label: 'Oak Park, IL',
    city: 'Oak Park',
    state: 'IL',
    lat: 41.885,
    lng: -87.785,
    miles: 9,
    pop: 54000
  },
  {
    label: 'Skokie, IL',
    city: 'Skokie',
    state: 'IL',
    lat: 42.033,
    lng: -87.733,
    miles: 12,
    pop: 67000
  }
];

test('filters nearby cities, adjusts the limit, clears safely, and recovers from routing failure', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/api/nearby**', (route) => route.fulfill({ json: { nearby } }));
  await page.route('**/api/commute-address', (route) =>
    route.fulfill({
      json: {
        destinations: [{ label: 'Willis Tower, Chicago, Illinois', lat: 41.878, lng: -87.636 }]
      }
    })
  );
  let fail = false;
  await page.route('**/api/commute', (route) =>
    route.fulfill(
      fail
        ? { status: 502, json: { message: 'Unavailable' } }
        : { json: { minutes: [25, 45, null] } }
    )
  );
  await page.goto('/?salary=80000&city=Chicago%2C+IL');
  const region = page.getByRole('region', { name: 'Nearby rent options', exact: true });
  const address = region.getByRole('searchbox', { name: 'Commute destination' });
  await address.fill('Willis Tower');
  await region.getByRole('button', { name: 'Find', exact: true }).click();
  await region
    .getByRole('button', { name: 'Willis Tower, Chicago, Illinois', exact: true })
    .click();
  await expect(region).toContainText('1 of 3 nearby cities within 30 minutes');
  await expect(region).toContainText('25 min drive');
  await expect(region.getByText('Oak Park, IL', { exact: true })).toHaveCount(0);
  await expect(region).toContainText('1 without a route excluded');
  await region.getByText('Show commute filters', { exact: true }).click();
  await chooseSelect(region.getByLabel('Maximum drive time'), '45');
  await expect(region).toContainText('2 of 3 nearby cities within 45 minutes');
  await expect(region).toContainText('45 min drive');
  expect(page.url()).not.toContain('Willis');
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  ).not.toContain('Willis');
  await region.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/renttool-commute-mobile.png', fullPage: true });
  expect((await new AxeBuilder({ page }).include('#nearby-options').analyze()).violations).toEqual(
    []
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await region.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(region.getByText('Skokie, IL', { exact: true })).toBeVisible();
  fail = true;
  await address.fill('Willis Tower');
  await region.getByRole('button', { name: 'Find', exact: true }).click();
  await region
    .getByRole('button', { name: 'Willis Tower, Chicago, Illinois', exact: true })
    .click();
  await expect(region).toContainText('Showing all nearby cities');
  await expect(region.getByText('Skokie, IL', { exact: true })).toBeVisible();
  fail = false;
  await region.getByRole('button', { name: 'Retry driving times' }).click();
  await expect(region).toContainText('2 of 3 nearby cities within 45 minutes');
  await address.fill('Another address');
  await expect(region.getByText('Skokie, IL', { exact: true })).toBeVisible();
  await expect(region).not.toContainText('min drive');
});

test('ignores stale address results after editing the destination', async ({ page }) => {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/api/nearby**', (route) => route.fulfill({ json: { nearby } }));
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/commute-address', async (route) => {
    await paused;
    await route.fulfill({
      json: { destinations: [{ label: 'Old destination', lat: 41, lng: -87 }] }
    });
  });
  await page.goto('/?salary=80000&city=Chicago%2C+IL');
  await page.getByRole('searchbox', { name: 'Commute destination' }).fill('Old address');
  const request = page.waitForRequest('**/api/commute-address');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await request;
  await page.getByRole('searchbox', { name: 'Commute destination' }).fill('New address');
  release();
  await expect(page.getByRole('button', { name: 'Old destination', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Find', exact: true })).toBeEnabled();
});
