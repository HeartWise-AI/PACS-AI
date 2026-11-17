import { useLayoutEffect, useSyncExternalStore } from 'react';
import { useLocation, type NavigateFunction } from 'react-router-dom';

/**
 * The router location for components that live outside OHIF's BrowserRouter
 * (our app-wide providers, e.g. the tutorial overlay). Our route pages and
 * the viewer layout render <RouterLocationBridge />, which publishes the
 * current location here; before any of them has rendered, the location comes
 * from window.location.
 */
type ShellLocation = { pathname: string; search: string; hash: string };

function windowLocation(): ShellLocation {
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

let current: ShellLocation = windowLocation();
const listeners = new Set<() => void>();

export function publishRouterLocation(location: ShellLocation): void {
  if (
    location.pathname === current.pathname &&
    location.search === current.search &&
    location.hash === current.hash
  ) {
    return;
  }
  current = { pathname: location.pathname, search: location.search, hash: location.hash };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ShellLocation {
  return current;
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

export function RouterLocationBridge(): null {
  const location = useLocation();
  useLayoutEffect(() => {
    publishRouterLocation(location);
  }, [location]);
  return null;
}
