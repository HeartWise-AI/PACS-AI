import type { BrowserContext } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { env, xaStudies } from './support/env';
import { ensureStudyLocal } from './support/studies';
import { PREVIOUS_RESULT, openAiMenu, openViewer } from './support/viewer';

/**
 * F13 — translations. The language is switched the way the app stores it
 * (i18next cookie and localStorage, platform/i18n/src/config.js) in this
 * test's own browser context only; PACS-AI namespaces must render French.
 */

async function useFrench(context: BrowserContext): Promise<void> {
  await context.addCookies([{ name: 'i18next', value: 'fr', url: env.baseURL }]);
  await context.addInitScript(() => localStorage.setItem('i18nextLng', 'fr'));
}

test.beforeEach(async ({ context }) => {
  await useFrench(context);
});

test('TopNavigation and work list render in French', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav).toBeVisible({ timeout: 60_000 });
  await expect(nav.getByRole('link', { name: 'Études' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Prédictions IA' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu du compte' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recherche', exact: true })).toBeVisible();
});

test('Settings renders in French', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByTestId('show-viewer-tour-again')).toHaveText('Revoir la visite guidée', { timeout: 60_000 });
  await expect(page.getByText("M'avertir des analyses automatiques")).toBeVisible();
});

test('AI Predictions renders in French', async ({ page }) => {
  await page.goto('/ai-predictions');
  await expect(page.getByRole('button', { name: 'Mes exécutions' })).toBeVisible({ timeout: 60_000 });
});

test('viewer AI menu renders in French', async ({ page }) => {
  const study = xaStudies()[0];
  test.skip(!study, 'no XA reference study configured');
  const local = await ensureStudyLocal(page, study);
  test.skip(!local.ok, `reference study ${study.tag} is not available locally: ${local.reason}`);
  await openViewer(page, study.uid);
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  await openAiMenu(page);
  // The translated actions sit on the rows of models with a stored result.
  test.skip(!(await page.locator(PREVIOUS_RESULT).count()), 'no stored AI result on the study to show its actions');
  await expect(page.getByRole('button', { name: /^Voir le résultat · / }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Relancer' }).first()).toBeVisible();
});

test('login page renders in French', async ({ browser }) => {
  // Logged out on purpose: the config's stored session would make /login
  // restore it and go straight to the work list.
  const context = await browser.newContext({
    baseURL: env.baseURL,
    ignoreHTTPSErrors: true,
    storageState: { cookies: [], origins: [] },
  });
  await useFrench(context);
  const page = await context.newPage();
  await page.goto(`/login?t=${encodeURIComponent(env.tenant)}`);
  await expect(page.getByText('Bienvenue dans PACS AI')).toBeVisible({ timeout: 60_000 });
  await context.close();
});
