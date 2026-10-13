import type { Locator } from '@playwright/test';

export async function chooseSelect(control: Locator, value: string) {
  await control.click();
  const page = control.page();
  await page
    .getByRole('listbox')
    .getByRole('option')
    .and(page.locator(`[data-value=${JSON.stringify(value)}]`))
    .click();
}
