import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openPlanEditor } from './plan';
import { chooseSelect } from './select';

test.beforeEach(async ({ page }) => {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/api/nearby**', (route) => route.fulfill({ json: { nearby: [] } }));
});

for (const width of [320, 390, 1280]) {
  test(`updates a saved comparison only on request at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const search = new URLSearchParams({ salary: '70000', city: 'Chicago, IL' });
    search.append('compare', 'Chicago, IL');
    search.append('compare', 'Houston, TX');
    search.append('compare-take-home', JSON.stringify({ name: 'Chicago, IL', monthly: 4500 }));
    search.append('compare-expenses', JSON.stringify({ name: 'Chicago, IL', monthly: 0 }));
    await page.goto(`/?${search}`);
    await openPlanEditor(page);
    const salary = page.getByRole('textbox', { name: 'Annual salary', exact: true });
    await salary.fill('65000');
    await salary.press('Tab');
    const saved = page.getByTestId('saved-comparison');
    await expect(saved).toContainText('Saved in Compare at $70,000/yr.');
    await expect(saved).toContainText('clears this comparison’s entered take-home pay');
    if (width < 1024) {
      const feedback = page.getByTestId('editor-budget');
      await expect(feedback).toContainText('Rent ceiling $1,625/mo');
      await expect(feedback).toContainText('Local rent is $120/mo above your ceiling.');
      await expect(feedback).toBeInViewport();
      await feedback.getByRole('link', { name: 'View updated budget' }).click();
      await expect(page.getByTestId('plan-summary')).toBeFocused();
    }
    const comparedSalaries = () =>
      new URL(page.url()).searchParams
        .getAll('compare-salary')
        .map((value) => JSON.parse(value) as { name: string; salary: number });
    expect(comparedSalaries()).toContainEqual({ name: 'Chicago, IL', salary: 70000 });
    await saved.getByRole('button', { name: 'Use $65,000 in Compare', exact: true }).click();
    await expect(saved).toContainText('Saved in Compare at $65,000/yr.');
    await expect(page.getByRole('button', { name: 'In compare', exact: true })).toBeFocused();
    await expect(saved.getByRole('button')).toHaveCount(0);
    await expect.poll(comparedSalaries).toContainEqual({ name: 'Chicago, IL', salary: 65000 });
    expect(comparedSalaries()).toContainEqual({ name: 'Houston, TX', salary: 70000 });
    expect(new URL(page.url()).searchParams.get('compare-take-home')).toBeNull();
    expect(new URL(page.url()).searchParams.get('compare-expenses')).toContain('"monthly":0');
    await page.reload();
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Compare 2' })
      .click();
    await expect(page.getByRole('textbox', { name: 'Annual salary in Chicago, IL' })).toHaveValue(
      '65,000'
    );
    await expect(page.getByRole('textbox', { name: 'Annual salary in Houston, TX' })).toHaveValue(
      '70,000'
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test('uses neutral styling for rent near the ceiling and updates the mobile feedback for housing', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?salary=70000&city=Chicago%2C+IL');
  await expect(
    page.getByRole('heading', { name: 'Near your rent ceiling', exact: true })
  ).toBeVisible();
  await expect(page.locator('#rent-decision')).toHaveAttribute('data-rent-fit', 'near');
  await openPlanEditor(page);
  const salary = page.getByRole('textbox', { name: 'Annual salary', exact: true });
  await salary.fill('69800');
  await expect(page.getByTestId('editor-budget')).toContainText('Local rent is at your ceiling.');
  await expect(page.getByRole('region', { name: 'Near your rent ceiling' })).toContainText(
    'at your ceiling.'
  );
  await salary.fill('100000');
  await expect(page.locator('#rent-decision')).toHaveAttribute('data-rent-fit', 'within');
  await salary.fill('65000');
  await expect(page.locator('#rent-decision')).toHaveAttribute('data-rent-fit', 'above');
  await expect(page.getByTestId('editor-budget')).toContainText('$120/mo above');
  await chooseSelect(page.getByRole('combobox', { name: 'Housing setup', exact: true }), '2br');
  await expect(page.getByTestId('editor-budget')).toContainText('$275/mo above');
  await chooseSelect(
    page.getByRole('combobox', { name: 'Housing setup', exact: true }),
    'shared-2br'
  );
  await expect(page.getByTestId('editor-budget')).toContainText('$675/mo below');
  await salary.fill('');
  await expect(page.getByTestId('editor-budget')).toHaveCount(0);
});

test('names each discovery comparison control, including selected and full states', async ({
  page
}) => {
  await page.goto('/?salary=70000');
  const gallery = page.getByRole('region', { name: 'Cities within your rent target', exact: true });
  const add = gallery.getByRole('button', { name: 'Add Houston, TX to comparison', exact: true });
  await add.focus();
  await add.press('Enter');
  const remove = gallery.getByRole('button', {
    name: 'Remove Houston, TX from comparison',
    exact: true
  });
  await expect(remove).toHaveAttribute('aria-pressed', 'true');
  await remove.press('Enter');
  await expect(add).toHaveAttribute('aria-pressed', 'false');
  const accessibility = await new AxeBuilder({ page }).include('.discovery').analyze();
  expect(accessibility.violations).toEqual([]);
  for (let index = 0; index < 5; index++) {
    await gallery
      .getByRole('button', { name: /^Add .+ to comparison$/ })
      .first()
      .click();
  }
  const full = gallery.getByRole('button', { name: /^Comparison full; cannot add .+/ });
  await expect(full).toHaveCount(1);
  await expect(full).toBeDisabled();
});

test('identifies apartment ceiling and buffer shortfalls and omits a zero buffer total', async ({
  page
}) => {
  await page.goto('/?salary=70000&city=Chicago%2C+IL&expenses=1200&savings=500');
  await page.getByRole('link', { name: 'Check an apartment', exact: true }).click();
  await page.getByLabel('Quoted monthly rent').fill('1700');
  await page.getByLabel('Monthly utilities').fill('150');
  const result = page.getByTestId('apartment-result');
  await expect(result).toContainText('$100/mo above your $1,750 rent ceiling');
  await expect(result).not.toContainText('after your');
  await page.goto(
    '/?salary=70000&city=Chicago%2C+IL&take-home=2000&expenses=1000&buffer=500&budget-mode=gross'
  );
  await page.getByRole('link', { name: 'Check an apartment', exact: true }).click();
  await page.getByLabel('Quoted monthly rent').fill('1200');
  await expect(result).toContainText('$700/mo short of your monthly buffer');
  await expect(result).not.toContainText('above your');
  await page.getByLabel('Quoted monthly rent').fill('1800');
  await expect(result).toContainText('$50/mo above your $1,750 rent ceiling');
  await expect(result).toContainText('Also $1,300/mo short of your monthly buffer.');
});
