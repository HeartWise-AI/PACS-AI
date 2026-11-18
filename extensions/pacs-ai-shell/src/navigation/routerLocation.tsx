import { useSyncExternalStore } from 'react';
import { type NavigateFunction } from 'react-router-dom';
import { installLocationChangeEvents } from '@pacs-ai/extension-core/src/hooks/usePathname';

/**
 * The router location for components that live outside OHIF's BrowserRouter
 * (our app-wide providers, e.g. the tutorial overlay). React Router changes
 * the URL with history.pushState/replaceState; core's
 * installLocationChangeEvents makes those fire an event (as core's
 * usePathname does), so this follows every navigation on every page,
 * including OHIF's own routes. The path is relative to the router basename,
 * like useLocation's.
 */
type ShellLocation = { pathname: string; search: string; hash: string };

const LOCATION_CHANGE_EVENT = 'pacs-ai:locationchange';

function readLocation(): ShellLocation {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '', hash: '' };
  }
  const basename = ((window as any).config?.routerBasename || '').replace(/\/$/, '');
  let { pathname } = window.location;
  if (basename && pathname.startsWith(basename)) {
    pathname = pathname.slice(basename.length) || '/';
  }
  return { pathname, search: window.location.search, hash: window.location.hash };
}

let current: ShellLocation = readLocation();

function getSnapshot(): ShellLocation {
  const next = readLocation();
  if (
    next.pathname !== current.pathname ||
    next.search !== current.search ||
    next.hash !== current.hash
  ) {
    current = next;
  }
  return current;
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

/** Same shape as react-router's useLocation(), usable outside the router. */
export function useShellLocation(): ShellLocation {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Navigate from outside the router. Our app-wide UI only navigates to sign
 * out (userService.logoutUser), which reloads the page anyway, so a full page
 * load is used.
 */
const shellNavigate = ((to: string) => {
  window.location.assign(to);
}) as NavigateFunction;

export function useShellNavigate(): NavigateFunction {
  return shellNavigate;
}
