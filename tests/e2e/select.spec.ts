import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { chooseSelect } from './select';

test.beforeEach(async ({ page }) => {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
});

test('supports keyboard selection, cancellation, type-ahead, and tab dismissal', async ({
  page
}) => {
  await page.goto('/?salary=80000');
  const housing = page.getByRole('combobox', { name: 'Housing setup', exact: true });
  await housing.focus();
  await housing.press('ArrowDown');
  await expect(housing).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Escape');
  await expect(housing).toHaveAttribute('data-value', '1br');
  await expect(housing).toBeFocused();
  await housing.press('ArrowDown');
  await housing.press('ArrowDown');
  await housing.press('Enter');
  await expect(housing).toHaveAttribute('data-value', '2br');
  await expect(housing).toBeFocused();
  const state = page.getByRole('combobox', { name: 'State', exact: true });
  await state.focus();
  await state.pressSequentially('New York');
  await state.press('Enter');
  await expect(state).toHaveAttribute('data-value', 'NY');
  await state.click();
  await state.press('Tab');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Population', exact: true })).toBeFocused();
});

for (const dark of [false, true]) {
  test(`keeps the menu accessible and within a mobile viewport in ${dark ? 'dark' : 'light'} mode`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?salary=80000');
    await expect(page.locator('main')).toHaveAttribute('data-hydrated', 'true');
    if (dark) await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    const housing = page.getByRole('combobox', { name: 'Housing setup', exact: true });
    if (dark) await expect(housing).toHaveCSS('color', 'rgb(237, 244, 252)');
    await housing.click();
    const menu = page.getByRole('listbox', { name: 'Housing setup', exact: true });
    const bounds = (await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    expect(bounds.height).toBeLessThan(200);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    );
    expect(violations).toEqual([]);
    await page.getByRole('heading', { name: 'Find your next place.' }).click();
    await expect(menu).toHaveCount(0);
    await chooseSelect(housing, 'shared-2br');
    await expect(housing).toHaveAttribute('data-value', 'shared-2br');
  });
}

test('opens above a low field without moving the page and skips disabled choices', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?salary=80000&city=Chicago%2C+IL');
  const housing = page.getByRole('combobox', { name: 'Housing setup', exact: true });
  await expect(housing).toBeVisible();
  const before = (await housing.boundingBox())!;
  await housing.click();
  await expect(housing).toHaveAttribute('aria-expanded', 'true');
  const menu = (await page
    .getByRole('listbox', { name: 'Housing setup', exact: true })
    .boundingBox())!;
  const after = (await housing.boundingBox())!;
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(menu.y + menu.height).toBeLessThanOrEqual(after.y);
  await housing.press('Escape');
  await page.getByRole('button', { name: 'Explore other cities', exact: true }).click();
  await page.getByLabel('Annual salary', { exact: true }).fill('');
  const sort = page.getByRole('combobox', { name: 'Sort by', exact: true });
  await sort.click();
  await expect(
    page.getByRole('option', { name: 'Most spending room', exact: true })
  ).toBeDisabled();
  await sort.press('End');
  await sort.press('Enter');
  await expect(sort).toHaveAttribute('data-value', 'rent');
});
