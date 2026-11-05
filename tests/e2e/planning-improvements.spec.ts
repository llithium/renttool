import { openPlanEditor } from './plan';
import { chooseSelect } from './select';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/api/nearby**', (route) => route.fulfill({ json: { nearby: [] } }));
});

test('changes the comparison criterion and reveals other cities on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/compare?salary=80000&compare=Tampa%2C+FL&compare=New+York%2C+NY');
  const brief = page.getByRole('region', { name: 'Decision brief', exact: true });
  const criterion = brief.getByLabel('Decision criterion', { exact: true });
  await chooseSelect(criterion, 'rent');
  await expect(brief.getByRole('link', { name: 'Tampa, FL', exact: true })).toBeVisible();
  await page.getByLabel('Annual salary in New York, NY').fill('150000');
  await page.getByLabel('Annual salary in New York, NY').press('Tab');
  await chooseSelect(criterion, 'takeHome');
  await expect(brief.getByRole('link', { name: 'New York, NY', exact: true })).toBeVisible();
  const table = page.getByRole('region', {
    name: 'Full city comparison; scroll horizontally for more',
    exact: true
  });
  await page.getByText('Full breakdown', { exact: true }).click();
  await page.getByRole('button', { name: 'Next cities', exact: true }).click();
  await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Previous cities', exact: true }).click();
  await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBe(0);
  await page.setViewportSize({ width: 320, height: 740 });
  const firstCity = table.locator('thead th').nth(1);
  const tableBounds = (await table.boundingBox())!;
  expect(
    (await firstCity.boundingBox())!.x + (await firstCity.boundingBox())!.width
  ).toBeLessThanOrEqual(tableBounds.x + tableBounds.width);
  const searchWidth = await page
    .getByRole('combobox', { name: 'City', exact: true })
    .evaluate((input) => {
      const style = getComputedStyle(input);
      return input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    });
  expect(searchWidth).toBeGreaterThanOrEqual(120);
});

test('opens personal expenses from the result and keeps long salaries readable at 320px', async ({
  page
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/?salary=80000&city=Tampa%2C+FL');
  await openPlanEditor(page);
  const salary = page.getByLabel('Annual salary', { exact: true });
  await page.evaluate(() => document.fonts.ready);
  for (const value of ['100000', '10000000']) {
    await salary.fill(value);
    await salary.press('Tab');
    await expect(salary).toHaveValue(Number(value).toLocaleString('en-US'));
    const widths = await salary.evaluate((input: HTMLInputElement) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      const style = getComputedStyle(input);
      context.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
      return { text: context.measureText(input.value).width, field: input.clientWidth };
    });
    expect(widths.text).toBeLessThanOrEqual(widths.field);
  }
  await page.getByRole('button', { name: 'Add your expenses', exact: true }).click();
  await expect(page.getByLabel('Recurring monthly expenses')).toBeFocused();
  await page.getByLabel('Recurring monthly expenses').fill('1000');
  await expect(page.getByTestId('plan-summary')).toContainText('After rent & expenses');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('uses a personal ceiling in the summary, map, listing search, and apartment check', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    '/?salary=80000&city=Chicago%2C+IL&take-home=3500&expenses=1200&savings=500&buffer=400'
  );
  const summary = page.getByTestId('plan-summary');
  await expect(summary).toContainText('$1,400/mo');
  await expect(summary).toBeInViewport();
  await expect(
    page.getByRole('heading', { name: 'Above your personal rent ceiling' })
  ).toBeVisible();
  await expect(page.getByText('Map & nearby rents', { exact: true }).locator('..')).toHaveAttribute(
    'open',
    ''
  );
  await expect(
    page.getByRole('button', { name: /^Chicago, IL, 1 bedroom .*over budget$/ })
  ).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: 'Search Zillow under $1,400 (opens in a new tab)', exact: true })
  ).toBeVisible();
  const apartmentShortcut = page.getByRole('link', { name: 'Check an apartment', exact: true });
  await apartmentShortcut.focus();
  await apartmentShortcut.press('Enter');
  await expect(page.locator('#apartment-check details')).toHaveAttribute('open', '');
  await page.getByLabel('Quoted monthly rent').fill('1200');
  await page.getByLabel('Monthly utilities').fill('100');
  await page.getByLabel('Monthly parking').fill('50');
  await page.getByLabel('Other monthly fees').fill('25');
  await page.getByLabel('Security deposit').fill('1200');
  await page.getByLabel('Moving & other upfront costs').fill('700');
  const apartment = page.getByTestId('apartment-result');
  await expect(apartment).toContainText('Fits your rent ceiling and buffer');
  await expect(apartment).toContainText('$1,375');
  await expect(apartment).toContainText('$425');
  await expect(apartment).toContainText('$3,275');
  const apartmentAccessibility = await new AxeBuilder({ page })
    .include('#apartment-check')
    .analyze();
  expect(apartmentAccessibility.violations).toEqual([]);
  await page.getByLabel('Quoted monthly rent').fill('2500');
  await expect(apartment).toContainText('-$875');
  await expect(apartment).toContainText('Exceeds your rent ceiling or buffer');
  await openPlanEditor(page);
  await page.getByText('Personal expenses & savings (optional)', { exact: true }).click();
  await chooseSelect(page.getByLabel('Rent ceiling', { exact: true }), 'gross');
  await expect(summary).toContainText('$2,000/mo');
  await expect(
    page.getByRole('link', { name: 'Search Zillow under $2,000 (opens in a new tab)', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Chicago, IL, 1 bedroom .*fits budget$/ })
  ).toHaveCount(1);
  await chooseSelect(page.getByLabel('Rent ceiling', { exact: true }), 'personal');
  await page.getByLabel('Actual monthly take-home', { exact: true }).fill('0');
  await expect(
    page.getByRole('heading', { name: 'No room for rent within this plan' })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /^Search Zillow/ })).toHaveCount(0);
});

test('keeps per-city expense overrides through reload and compares cities next to the decision', async ({
  page
}) => {
  await page.goto('/compare?salary=80000&compare=Chicago%2C+IL&compare=Tampa%2C+FL&expenses=1000');
  const chicago = page.getByTestId('scenario').filter({ hasText: 'Chicago, IL' });
  const brief = page.getByRole('region', { name: 'Decision brief' });
  await expect(brief).toBeVisible();
  await expect(brief.getByLabel('Decision criterion')).toContainText('Most available each month');
  const summary = page.getByRole('region', { name: 'City comparison at a glance' });
  await expect(summary.getByRole('row', { name: /Chicago, IL/ })).toBeVisible();
  expect((await summary.boundingBox())!.y - (await brief.boundingBox())!.y).toBeLessThan(300);
  await page.getByRole('button', { name: 'Edit details for Chicago, IL', exact: true }).click();
  await chicago.getByText('Expenses for this city', { exact: true }).click();
  await chicago.getByLabel('Monthly expenses in Chicago, IL').fill('0');
  await expect
    .poll(() => new URL(page.url()).searchParams.get('compare-expenses'))
    .toContain('"monthly":0');
  await page.reload();
  await page.getByRole('button', { name: 'Edit details for Chicago, IL', exact: true }).click();
  await chicago.getByText('Expenses for this city · customized', { exact: true }).click();
  await expect(chicago.getByLabel('Monthly expenses in Chicago, IL')).toHaveValue('0');
  await page.getByLabel('Annual salary in Chicago, IL').fill('90000');
  await page.getByLabel('Annual salary in Chicago, IL').press('Tab');
  await expect(chicago.getByLabel('Monthly expenses in Chicago, IL')).toHaveValue('0');
  await chicago.getByLabel('Monthly expenses in Chicago, IL').fill('');
  await expect.poll(() => new URL(page.url()).searchParams.get('compare-expenses')).toBeNull();
});

test('copies cities without financial details unless full sharing is chosen', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(
    '/?salary=80000&city=Chicago%2C+IL&expenses=1000&savings=500&buffer=300&take-home=4000&compare=Tampa%2C+FL'
  );
  await page.getByText('Share plan', { exact: true }).click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Copied cities link');
  const cities = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect([...cities.searchParams.keys()]).toEqual(['city', 'compare']);
  await chooseSelect(page.getByLabel('Include in link'), 'full');
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Copied full plan');
  const full = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect(full.searchParams.get('salary')).toBe('80000');
  expect(full.searchParams.get('take-home')).toBe('4000');
  expect(full.searchParams.get('buffer')).toBe('300');
});

test('retains discovery filters after exploring a city and on reload', async ({ page }) => {
  await page.goto('/?salary=80000');
  await chooseSelect(page.getByLabel('State', { exact: true }), 'IL');
  await chooseSelect(page.getByLabel('Population', { exact: true }), '500k+');
  await chooseSelect(page.getByLabel('Reference city', { exact: true }), 'Chicago, IL');
  await chooseSelect(page.getByLabel('Sort by', { exact: true }), 'distance');
  await page.getByRole('link', { name: 'Explore Chicago, IL', exact: true }).click();
  await page.getByRole('button', { name: 'Explore other cities', exact: true }).click();
  await expect(page.getByLabel('State', { exact: true })).toHaveAttribute('data-value', 'IL');
  await expect(page.getByLabel('Sort by', { exact: true })).toHaveAttribute(
    'data-value',
    'distance'
  );
  await expect(page.getByLabel('Reference city', { exact: true })).toHaveAttribute(
    'data-value',
    'Chicago, IL'
  );
  await page.reload();
  await expect(page.getByLabel('Population', { exact: true })).toHaveAttribute(
    'data-value',
    '500k+'
  );
  await expect(page.getByLabel('Sort by', { exact: true })).toHaveAttribute(
    'data-value',
    'distance'
  );
});

test('names the rule that actually sets the ceiling and omits empty personal costs', async ({
  page
}) => {
  await page.goto('/?salary=80000&city=San+Diego%2C+CA');
  const summary = page.getByTestId('plan-summary');
  await expect(summary.getByText('30% of gross income', { exact: true })).toBeVisible();
  await expect(summary.getByText('After rent, before expenses', { exact: true })).toBeVisible();
  await expect(summary).not.toContainText('buffer target');
  await expect(
    page.getByRole('heading', { name: 'Fits your 30% gross-income target' })
  ).toBeVisible();
  await openPlanEditor(page);
  await page.getByText('Personal expenses & savings (optional)', { exact: true }).click();
  await expect(
    page.getByText('Currently using 30% of gross income. Personal amounts can lower this ceiling.')
  ).toBeVisible();
  const expenses = page.getByLabel('Recurring monthly expenses');
  await expenses.fill('100');
  await expect(summary.getByText('30% of gross income', { exact: true })).toBeVisible();
  await expect(summary.getByText('After rent & expenses', { exact: true })).toBeVisible();
  await expenses.fill('4000');
  await expect(summary.getByText('Personal rent ceiling', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Above your personal rent ceiling' })
  ).toBeVisible();
  await expenses.fill('');
  await expect(summary.getByText('30% of gross income', { exact: true })).toBeVisible();
  await expect(summary.getByText('After rent, before expenses', { exact: true })).toBeVisible();
  await page.getByLabel('Actual monthly take-home', { exact: true }).fill('0');
  await expect(summary.getByText('Personal rent ceiling', { exact: true })).toBeVisible();
  await expect(summary).not.toContainText('Buffer shortfall');
});

test('keeps a saved mobile plan compact and opens its assumptions and editor with the keyboard', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?salary=80000&city=Chicago%2C+IL&expenses=1000&savings=500&buffer=300');
  await expect(page.locator('main')).toHaveAttribute('data-hydrated', 'true');
  const editor = page.locator('[data-plan-editor]');
  await expect(editor).not.toHaveAttribute('open', '');
  const assumptions = page.getByRole('button', {
    name: 'Edit monthly plan assumptions',
    exact: true
  });
  await expect(assumptions).toContainText('Expenses $1,000');
  await expect(assumptions).toContainText('Savings $500');
  await expect(assumptions).toContainText('Buffer $300');
  const shortcut = page.getByRole('link', { name: 'Check an apartment', exact: true });
  await expect(shortcut).toBeInViewport();
  const figures = page.getByTestId('plan-summary').locator('[data-supporting-metrics] dd');
  expect((await figures.nth(0).boundingBox())!.y).toBeCloseTo(
    (await figures.nth(1).boundingBox())!.y,
    0
  );
  await assumptions.focus();
  await assumptions.press('Enter');
  await expect(editor).toHaveAttribute('open', '');
  await expect(page.getByLabel('Recurring monthly expenses')).toBeFocused();
  await page.getByLabel('Recurring monthly expenses').fill('1200');
  await expect(assumptions).toContainText('Expenses $1,200');
  await shortcut.focus();
  await shortcut.press('Enter');
  await expect(page.locator('#apartment-check details')).toHaveAttribute('open', '');
  await expect(page.locator('#apartment-check')).toBeFocused();
  await expect(page.getByLabel('Annual salary', { exact: true })).toHaveValue('80,000');
});
