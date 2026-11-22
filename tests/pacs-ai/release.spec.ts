import { test, expect } from './support/fixtures';

/** F14 — build version and release plumbing. */

test('version.json is served with no-store and names the build', async ({ page, request }) => {
  const res = await request.get('/version.json', { headers: { 'Cache-Control': 'no-cache' } });
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control'] ?? '', 'Cache-Control of version.json').toMatch(/no-store/);
  const body = await res.json();
  expect(typeof body, 'version.json is a JSON object').toBe('object');
  expect(JSON.stringify(body)).toMatch(/version|build|commit/i);
});

test('env-config.js is present and defines the API base', async ({ page, request }) => {
  const res = await request.get('/env-config.js');
  expect(res.status()).toBe(200);
  expect(await res.text()).toMatch(/window\._env_\s*=/);
  await page.goto('/settings');
  const apiBase = await page.evaluate(() => (window as any)._env_?.APP_PUBLIC_API_URL ?? null);
  expect(apiBase, 'window._env_.APP_PUBLIC_API_URL').toBeTruthy();
});

test('no service worker is registered (service-worker kill switch)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const registrations = await page.evaluate(async () =>
    'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0
  );
  expect(registrations).toBe(0);
});

test('index.html is not cached', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control'] ?? '', 'Cache-Control of index.html').toMatch(/no-store|no-cache/);
});
