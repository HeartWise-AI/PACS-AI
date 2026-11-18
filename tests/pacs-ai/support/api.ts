import type { Page } from '@playwright/test';

export interface ApiResult<T = unknown> {
  status: number;
  headers: Record<string, string>;
  json: T | null;
  text: string;
}

/**
 * Calls the PACS-AI API from inside the page, exactly as the app does: base
 * URL from window._env_.APP_PUBLIC_API_URL (env-config.js), bearer session
 * token from localStorage. The page must already be on the app's origin.
 */
export async function apiCall<T = unknown>(
  page: Page,
  method: 'GET' | 'POST',
  apiPath: string,
  body?: unknown
): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ method, apiPath, body }) => {
      const base = ((window as any)._env_?.APP_PUBLIC_API_URL as string | undefined) ?? '/api';
      const token = localStorage.getItem('sessionToken');
      const response = await fetch(base + apiPath, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          Accept: 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => (headers[key] = value));
      return { status: response.status, headers, json, text };
    },
    { method, apiPath, body }
  ) as Promise<ApiResult<T>>;
}

/** Makes sure the page is on the app origin so apiCall can use its token. */
export async function onAppOrigin(page: Page): Promise<void> {
  if (!page.url().startsWith('http')) {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
  }
}
