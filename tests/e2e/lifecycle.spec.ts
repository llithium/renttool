import { expect, test, type Page } from '@playwright/test';

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => document.querySelector('main')?.dataset.hydrated === 'true');
}

async function holdModule(page: Page, fragment: string) {
  let seen = false;
  const urls = new Set<string>();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes(fragment) && /\.(?:js|mjs)(?:\?|$)/.test(url)) {
      seen = true;
      urls.add(url);
      await held;
    }
    await route.continue();
  });

  return {
    waitUntilRequested: () => expect.poll(() => seen).toBe(true),
    release: () => release(),
    complete: () =>
      page.evaluate(
        async (moduleUrls) => {
          await Promise.all(moduleUrls.map((url) => import(/* @vite-ignore */ url)));
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        },
        [...urls]
      )
  };
}

test('landing animation does not initialize after navigation during GSAP import', async ({
  page
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  const gsap = await holdModule(page, 'gsap');

  await page.goto('/');
  await waitForHydration(page);
  await gsap.waitUntilRequested();

  const heroLine = page.locator('[data-hero-line]').first();
  await expect(heroLine).toBeVisible();
  const heroElement = await heroLine.elementHandle();
  await page.getByRole('link', { name: 'Compare' }).click();
  await expect(page).toHaveURL(/\/compare/);
  gsap.release();
  await gsap.complete();
  const heroState = await heroElement?.evaluate((element) => ({
    connected: element.isConnected,
    style: element.getAttribute('style') ?? ''
  }));
  expect(heroState?.connected).toBe(false);
  expect(heroState?.style).not.toMatch(/transform|opacity/);
  await heroElement?.dispose();
  expect(errors).toEqual([]);
});

test('map does not initialize after navigation during Leaflet import', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  const leaflet = await holdModule(page, 'leaflet');

  await page.goto('/?salary=80000&city=Tampa%2C%20FL');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: 'Affordability map' })).toBeVisible();
  await leaflet.waitUntilRequested();
  const mapElement = await page.locator('.leaflet-theme').elementHandle();

  await page.getByRole('link', { name: 'Compare' }).click();
  await expect(page).toHaveURL(/\/compare/);
  leaflet.release();
  await leaflet.complete();
  expect(
    await mapElement?.evaluate((element) => ({
      connected: element.isConnected,
      leafletId: (element as HTMLDivElement & { _leaflet_id?: number })._leaflet_id
    }))
  ).toEqual({ connected: false, leafletId: undefined });
  await mapElement?.dispose();
  expect(errors).toEqual([]);
});
