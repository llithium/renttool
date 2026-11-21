import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/api/nearby**', (route) => route.fulfill({ json: { nearby: [] } }));
});

test('matches city/state variants and explains housing estimates', async ({ page }) => {
  await page.route('**/api/city-suggest**', (route) =>
    route.fulfill({ json: { suggestions: [] } })
  );
  await page.goto('/?salary=80000&housing=shared-2br');
  await expect(page.locator('main')).toHaveAttribute('data-hydrated', 'true');
  const input = page.getByRole('combobox', { name: 'City', exact: true });
  await input.fill('Saint Louis, Missouri');
  const suggestion = page.getByRole('option', { name: 'St Louis, MO', exact: true });
  await expect(suggestion).toBeVisible();
  await expect(suggestion).toContainText('Missouri');
  await expect(suggestion).toContainText('Half a 2-bed');
  await expect(suggestion).toContainText('$');
  await expect(page.getByText(/^Rents: Apartment List, /)).toBeVisible();
  await input.fill('NYC');
  await expect(page.getByRole('option', { name: 'New York, NY', exact: true })).toBeVisible();
});

test('merges delayed results without duplicate cities or changing the keyboard choice', async ({
  page
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/city-suggest**', async (route) => {
    await held;
    await route.fulfill({
      json: {
        suggestions: [
          { label: 'San Diego, CA', city: 'San Diego', state: 'CA', lat: 32.72, lng: -117.16 },
          { label: 'San, CA', city: 'San', state: 'CA', lat: 32, lng: -117 }
        ]
      }
    });
  });
  await page.goto('/?salary=80000');
  await expect(page.locator('main')).toHaveAttribute('data-hydrated', 'true');
  const input = page.getByRole('combobox', { name: 'City', exact: true });
  await input.fill('San');
  const list = page.getByRole('listbox', { name: 'City suggestions' });
  await expect(list.getByRole('option', { name: 'San Diego, CA', exact: true })).toBeVisible();
  await input.press('ArrowDown');
  const chosen = await list.locator('[aria-selected="true"]').getAttribute('aria-label');
  release();
  await expect(page.getByRole('option', { name: 'San, CA', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'San Diego, CA', exact: true })).toHaveCount(1);
  await expect(list.locator('[aria-selected="true"]')).toHaveAttribute('aria-label', chosen!);
  await input.press('Enter');
  await expect(
    page.getByRole('heading', { level: 1, name: chosen!.split(',')[0], exact: true })
  ).toBeVisible();
  await expect(list).toHaveCount(0);
});

test('keeps keyboard choices visible in a mobile menu and meets accessibility checks', async ({
  page
}) => {
  await page.route('**/api/city-suggest**', (route) =>
    route.fulfill({ json: { suggestions: [] } })
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/city?salary=80000&city=San+Diego%2C+CA');
  await expect(page.locator('main')).toHaveAttribute('data-hydrated', 'true');
  const input = page.getByRole('combobox', { name: 'City', exact: true });
  await input.fill('San');
  const list = page.getByRole('listbox', { name: 'City suggestions' });
  await input.press('ArrowUp');
  const selected = list.locator('[aria-selected="true"]');
  await expect
    .poll(async () => {
      const row = (await selected.boundingBox())!;
      const menu = (await list.boundingBox())!;
      return row.y >= menu.y - 1 && row.y + row.height <= menu.y + menu.height + 1;
    })
    .toBe(true);
  const popup = (await list.locator('..').boundingBox())!;
  expect(popup.x).toBeGreaterThanOrEqual(0);
  expect(popup.x + popup.width).toBeLessThanOrEqual(390);
  expect(popup.y).toBeGreaterThanOrEqual(0);
  expect(popup.y + popup.height).toBeLessThanOrEqual(844);
  const violations = (
    await new AxeBuilder({ page }).exclude('.leaflet-container').analyze()
  ).violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
  expect(violations).toEqual([]);
});
