import { expect, type Page } from '@playwright/test';

/** Open the responsive plan editor before exercising its fields. */
export async function openPlanEditor(page: Page) {
  await expect(page.locator('main')).toHaveAttribute('data-hydrated', 'true');
  const editor = page.locator('[data-plan-editor]');
  if ((await editor.count()) && (await editor.getAttribute('open')) == null) {
    await editor.locator('summary').first().click();
  }
}
