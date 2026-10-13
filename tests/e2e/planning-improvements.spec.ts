import { chooseSelect } from './select';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/api/nearby**', (route) => route.fulfill({ json: { nearby: [] } }));
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
  await expect(summary).toContainText('Local rent exceeds your ceiling');
  await expect(
    page.getByRole('button', { name: /^Chicago, IL, 1 bedroom .*over budget$/ })
  ).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: 'Search Zillow under $1,400 (opens in a new tab)', exact: true })
  ).toBeVisible();
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
  await page.getByLabel('Quoted monthly rent').fill('2500');
  await expect(apartment).toContainText('$-875');
  await expect(apartment).toContainText('Exceeds your rent ceiling or buffer');
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

test('keeps per-city expense overrides through reload and shows the decision before the cards', async ({
  page
}) => {
  await page.goto('/compare?salary=80000&compare=Chicago%2C+IL&compare=Tampa%2C+FL&expenses=1000');
  const chicago = page.getByTestId('scenario').filter({ hasText: 'Chicago, IL' });
  const brief = page.getByRole('region', { name: 'Decision brief' });
  await expect(brief).toBeVisible();
  expect((await brief.boundingBox())!.y).toBeLessThan((await chicago.boundingBox())!.y);
  await chicago.getByText('Expenses for this city', { exact: true }).click();
  await chicago.getByLabel('Monthly expenses in Chicago, IL').fill('0');
  await expect
    .poll(() => new URL(page.url()).searchParams.get('compare-expenses'))
    .toContain('"monthly":0');
  await page.reload();
  await chicago.getByText('Expenses for this city · customized', { exact: true }).click();
  await expect(chicago.getByLabel('Monthly expenses in Chicago, IL')).toHaveValue('0');
  await chicago.getByLabel('Annual salary in Chicago, IL').fill('90000');
  await chicago.getByLabel('Annual salary in Chicago, IL').press('Tab');
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
  await expect(summary.getByText('After rent', { exact: true })).toBeVisible();
  await expect(summary).not.toContainText('buffer target');
  await expect(
    page.getByRole('heading', { name: 'Fits your 30% gross-income target' })
  ).toBeVisible();
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
  await expect(summary.getByText('After rent', { exact: true })).toBeVisible();
  await page.getByLabel('Actual monthly take-home', { exact: true }).fill('0');
  await expect(summary.getByText('Personal rent ceiling', { exact: true })).toBeVisible();
  await expect(summary).not.toContainText('Buffer shortfall');
});
