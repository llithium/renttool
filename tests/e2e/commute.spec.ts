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

for (const view of ['reload', 'compare'] as const) {
  test(`retains the commute destination and time limit after ${view}`, async ({ page }) => {
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
    await page.route('**/api/commute', (route) => {
      const body = route.request().postDataJSON();
      return route.fulfill({
        json: {
          minutes: body.origins.map((origin: { lat: number }) => (origin.lat > 42 ? 25 : 45))
        }
      });
    });
    await page.goto('/?salary=80000&city=Chicago%2C+IL&compare=Tampa%2C+FL');
    await expect(
      page.getByText('Map & nearby rents', { exact: true }).locator('..')
    ).toHaveAttribute('open', '');
    await page.getByRole('searchbox', { name: 'Commute destination' }).fill('Willis Tower');
    await page.getByRole('button', { name: 'Find', exact: true }).click();
    await page
      .getByRole('button', { name: 'Willis Tower, Chicago, Illinois', exact: true })
      .click();
    await page.getByText('Show commute filters', { exact: true }).click();
    await chooseSelect(page.getByLabel('Maximum drive time'), '45');
    await expect(
      page.getByRole('region', { name: 'Nearby rent options', exact: true })
    ).toContainText('3 of 3 nearby cities within 45 minutes');
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('rent-tool-commute-v1') ?? '{}'))
    ).toMatchObject({ destination: { label: 'Willis Tower, Chicago, Illinois' }, maximum: 45 });
    if (view === 'reload') await page.reload();
    else
      await page
        .getByRole('link', { name: /^Compare/ })
        .first()
        .click();
    await expect(page.getByRole('searchbox', { name: 'Commute destination' })).toHaveValue(
      'Willis Tower, Chicago, Illinois'
    );
    if (view === 'compare') {
      await page.getByRole('button', { name: 'Edit details for Tampa, FL', exact: true }).click();
      await expect(page.getByTestId('scenario').filter({ hasText: 'Tampa, FL' })).toContainText(
        '45 min drive'
      );
      const controls = page.getByRole('region', { name: 'Commute times', exact: true });
      await expect(controls).toContainText('within 45 minutes');
      await page.getByText('Full breakdown', { exact: true }).click();
      const breakdown = page.getByRole('region', {
        name: 'Full city comparison; scroll horizontally for more'
      });
      await expect(breakdown.getByRole('row').filter({ hasText: 'Drive to Willis' })).toContainText(
        '45 min'
      );
      await controls.getByText('Show commute filters', { exact: true }).click();
      await chooseSelect(controls.getByLabel('Maximum drive time'), '15');
      await expect(page.getByTestId('scenario')).toHaveCount(1);
      await expect(page.getByTestId('scenario')).toContainText('Over 15-minute limit');
      await page.reload();
      await expect(page.getByRole('searchbox', { name: 'Commute destination' })).toHaveValue(
        'Willis Tower, Chicago, Illinois'
      );
      await page.getByRole('button', { name: 'Edit details for Tampa, FL', exact: true }).click();
      await expect(page.getByTestId('scenario')).toContainText('Over 15-minute limit');
      expect(
        (await new AxeBuilder({ page }).analyze()).violations.filter(
          (violation) => violation.impact === 'critical' || violation.impact === 'serious'
        )
      ).toEqual([]);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
      await page.screenshot({ path: '/tmp/renttool-commute-compare.png', fullPage: true });
      await page
        .getByTestId('scenario')
        .getByRole('link', { name: 'Tampa, FL', exact: true })
        .click();
      await expect(page.getByRole('searchbox', { name: 'Commute destination' })).toHaveValue(
        'Willis Tower, Chicago, Illinois'
      );
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await page.reload();
      await page.getByText('Check commute times', { exact: true }).click();
      await expect(page.getByRole('searchbox', { name: 'Commute destination' })).toHaveValue('');
    } else
      await expect(
        page.getByRole('region', { name: 'Nearby rent options', exact: true })
      ).toContainText('within 45 minutes');
  });
}
