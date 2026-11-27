import { useSyncExternalStore } from 'react';

export const LOCATION_CHANGE_EVENT = 'pacs-ai:locationchange';
let historyPatched = false;

/**
 * React Router navigates with history.pushState/replaceState, which fire no
 * event. Wrap both (once) so that code rendered outside the router can follow
 * navigation; the wrapped methods behave exactly like the originals.
 */
export function installLocationChangeEvents(): void {
  if (historyPatched || typeof window === 'undefined') {
    return;
  }
  historyPatched = true;
  (['pushState', 'replaceState'] as const).forEach(method => {
    const original = window.history[method];
    window.history[method] = function (...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
      return result;
    };
  });
}

function subscribe(onChange: () => void): () => void {
  installLocationChangeEvents();
  window.addEventListener('popstate', onChange);
  window.addEventListener(LOCATION_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(LOCATION_CHANGE_EVENT, onChange);
  };
}

const getPathname = () => window.location.pathname;

/**
 * The browser path, for providers that OHIF mounts outside its BrowserRouter
 * (serviceProvidersManager providers wrap the router, so useLocation is not
 * available there). Unlike useLocation it includes the router basename.
 */
export default function usePathname(): string {
  return useSyncExternalStore(subscribe, getPathname, getPathname);
}
