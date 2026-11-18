import { createContext, useContext } from 'react';

/**
 * Build ID set at build time (APP_BUILD_ID, or the build time; pacs-ai/build).
 * Shown on the login, settings and navigation surfaces. The context default
 * is the build ID, so no provider is needed; tests may provide another value.
 */
export const frontendVersion: string = process.env.APP_BUILD_ID || '';

export const FrontendVersionContext = createContext<string>(frontendVersion);

export function useFrontendVersion(): string {
  return useContext(FrontendVersionContext);
}
