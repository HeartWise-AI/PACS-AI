import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { env, ensureDir } from './env';

/** Login form of routes/Login. Never logs what it types. */
export async function fillAndSubmitLogin(page: Page, email: string, password: string): Promise<void> {
  const emailInput = page.locator('input[type=email]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
  await emailInput.fill(email);
  await page.locator('input[type=password]').first().fill(password);
  await page.getByRole('button', { name: /^(Login|Connexion|Se connecter)$/ }).first().click();
}

export const loginURL = (tenant = env.tenant) => `/login?t=${encodeURIComponent(tenant)}`;

/**
 * Failed sign-in attempts are rate limited per account (3) and per source IP
 * (the 4th failure within 10 minutes risks an IP lockout of the runner).
 * Every spec that deliberately fails a login records it here and asks for
 * budget first, so the whole suite never exceeds three failures per window,
 * across runs from the same checkout.
 */
const LEDGER_WINDOW_MS = 11 * 60_000;
export const IP_FAILED_LOGIN_BUDGET = 3;

/** Made-up account used by every deliberate failure; it does not exist. */
export const FAKE_LOGIN_EMAIL = 'pacs-ai-e2e.nobody@example.invalid';

const ledgerPath = () => path.join(env.stateDir, 'failed-logins.json');

interface LedgerEntry {
  at: number;
  account: string;
}

function readLedger(): LedgerEntry[] {
  try {
    const entries = JSON.parse(fs.readFileSync(ledgerPath(), 'utf8')) as LedgerEntry[];
    return entries.filter(e => Date.now() - e.at < LEDGER_WINDOW_MS);
  } catch {
    return [];
  }
}

export function failedLoginsInWindow(account?: string): number {
  return readLedger().filter(e => !account || e.account === account).length;
}

export function recordFailedLogin(account: string): void {
  ensureDir(env.stateDir);
  const entries = readLedger();
  entries.push({ at: Date.now(), account: account === FAKE_LOGIN_EMAIL ? 'fake' : 'other' });
  fs.writeFileSync(ledgerPath(), JSON.stringify(entries), { mode: 0o600 });
}

export function remainingFailedLoginBudget(): number {
  return IP_FAILED_LOGIN_BUDGET - failedLoginsInWindow();
}

/** Milliseconds until the oldest recorded failure leaves the window. */
export function msUntilLedgerFrees(): number {
  const entries = readLedger();
  if (!entries.length) return 0;
  return Math.max(0, LEDGER_WINDOW_MS - (Date.now() - Math.min(...entries.map(e => e.at))));
}
