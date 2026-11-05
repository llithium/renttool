import type { Locator } from '@playwright/test';
import { openPlanEditor } from './plan';

export async function chooseSelect(control: Locator, value: string) {
  if (!(await control.isVisible())) await openPlanEditor(control.page());
  await control.click();
  const page = control.page();
  await page
    .getByRole('listbox')
    .getByRole('option')
    .and(page.locator(`[data-value=${JSON.stringify(value)}]`))
    .click();
}
