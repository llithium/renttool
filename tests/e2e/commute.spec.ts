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
  await expect(page.getByText('Map & nearby rents', { exact: true }).locator('..')).toHaveAttribute(
    'open',
    ''
  );
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
  ).toContain('Willis');
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
  await expect(page.getByText('Map & nearby rents', { exact: true }).locator('..')).toHaveAttribute(
    'open',
    ''
  );
  await page.getByRole('searchbox', { name: 'Commute destination' }).fill('Old address');
  const request = page.waitForRequest('**/api/commute-address');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await request;
  await page.getByRole('searchbox', { name: 'Commute destination' }).fill('New address');
  release();
  await expect(page.getByRole('button', { name: 'Old destination', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Find', exact: true })).toBeEnabled();
});

test('saves different destinations and limits for comparison cities and shows their map pins', async ({
  page
}) => {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/api/nearby**', (route) => route.fulfill({ json: { nearby } }));
  const chicagoDestination = {
    label: 'Willis Tower, Chicago, Illinois',
    lat: 41.878,
    lng: -87.636
  };
  const tampaDestination = { label: 'Tampa office, Florida', lat: 27.95, lng: -82.46 };
  await page.route('**/api/commute-address', (route) =>
    route.fulfill({
      json: {
        destinations: [
          route.request().postDataJSON().query.includes('Tampa')
            ? tampaDestination
            : chicagoDestination
        ]
      }
    })
  );
  const routedDestinations: string[] = [];
  await page.route('**/api/commute', (route) => {
    const body = route.request().postDataJSON();
    routedDestinations.push(body.destination.label);
    return route.fulfill({
      json: {
        minutes: body.origins.map(() =>
          body.destination.label === chicagoDestination.label ? 25 : 45
        )
      }
    });
  });
  await page.goto('/?salary=80000&city=Chicago%2C+IL&compare=Chicago%2C+IL&compare=Tampa%2C+FL');
  await expect(page.locator('main')).toHaveAttribute('data-hydrated', 'true');
  const address = page.getByRole('searchbox', { name: 'Commute destination' });
  await address.fill('Willis Tower');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await page.getByRole('button', { name: chicagoDestination.label, exact: true }).click();
  const pin = page.getByRole('button', {
    name: `Commute destination: ${chicagoDestination.label}`,
    exact: true
  });
  await expect(pin).toBeVisible();
  await pin.focus();
  await expect(page.getByRole('tooltip')).toContainText(chicagoDestination.label);
  const nearbyRegion = page.getByRole('region', { name: 'Nearby rent options', exact: true });
  await nearbyRegion.getByText('Show commute filters', { exact: true }).click();
  await chooseSelect(nearbyRegion.getByLabel('Maximum drive time'), '30');
  await page.reload();
  await expect(address).toHaveValue(chicagoDestination.label);
  await expect(pin).toBeVisible();
  await page
    .getByRole('link', { name: /^Compare/ })
    .first()
    .click();
  const chicago = page.getByRole('region', { name: 'Commute for Chicago, IL', exact: true });
  const tampa = page.getByRole('region', { name: 'Commute for Tampa, FL', exact: true });
  await expect(chicago.getByRole('searchbox')).toHaveValue(chicagoDestination.label);
  await expect(tampa.getByRole('searchbox')).toHaveValue('');
  await expect(chicago).toContainText('25 min drive');
  await tampa.getByRole('searchbox').fill('Tampa office');
  await tampa.getByRole('button', { name: 'Find', exact: true }).click();
  await tampa.getByRole('button', { name: tampaDestination.label, exact: true }).click();
  await tampa.getByText('Show commute filters', { exact: true }).click();
  await chooseSelect(tampa.getByLabel('Maximum drive time'), '15');
  await expect(tampa).toContainText('45 min drive');
  await expect(tampa).toContainText('Over 15-minute limit');
  await expect(chicago).toContainText('Within 30-minute limit');
  await page.getByText('Full breakdown', { exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Drive to saved destination' });
  await expect(row).toContainText(chicagoDestination.label);
  await expect(row).toContainText(tampaDestination.label);
  await expect(row).toContainText('25 min');
  await expect(row).toContainText('45 min');
  await page.getByRole('button', { name: 'Edit details for Tampa, FL', exact: true }).click();
  await expect(page.getByTestId('scenario')).toContainText('Over 15-minute limit');
  expect(page.url()).not.toContain('office');
  expect(page.url()).not.toContain('Willis');
  const beforeSalaryChange = routedDestinations.length;
  await page.getByLabel('Annual salary in Tampa, FL').fill('90000');
  await expect(tampa).toContainText('45 min drive');
  expect(routedDestinations.length).toBe(beforeSalaryChange);
  await page.reload();
  await expect(chicago.getByRole('searchbox')).toHaveValue(chicagoDestination.label);
  await expect(tampa.getByRole('searchbox')).toHaveValue(tampaDestination.label);
  await expect(tampa).toContainText('Over 15-minute limit');
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({ path: '/tmp/renttool-commute-compare.png', fullPage: true });
  await tampa.getByRole('link', { name: 'View map', exact: true }).click();
  await expect(page).toHaveURL(/\/\?.*#rent-map$/);
  await expect(address).toHaveValue(tampaDestination.label);
  await expect(
    page.getByRole('button', {
      name: `Commute destination: ${tampaDestination.label}`,
      exact: true
    })
  ).toBeVisible();
  await expect(pin).toHaveCount(0);
  await page
    .getByRole('region', { name: 'Nearby rent options', exact: true })
    .getByRole('button', { name: 'Clear', exact: true })
    .click();
  await expect(page.locator('.commute-destination-pin')).toHaveCount(0);
  await page
    .getByRole('link', { name: /^Compare/ })
    .first()
    .click();
  await expect(chicago.getByRole('searchbox')).toHaveValue(chicagoDestination.label);
  await expect(tampa.getByRole('searchbox')).toHaveValue('');
});
