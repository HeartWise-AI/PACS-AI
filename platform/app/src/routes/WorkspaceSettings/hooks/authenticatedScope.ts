import { useSyncExternalStore } from 'react';

type AuthenticatedScope = { key: string; tenantId: string; authenticated: boolean };
let previousToken: string | null = null;
let generation = 0;
let snapshot: AuthenticatedScope = { key: 'session-0', tenantId: '', authenticated: false };
let lastNotifiedKey = snapshot.key;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

// The credential is compared only in memory. It never becomes a scope key,
// persistent deployment key, URL, log field, or rendered value.
export function getAuthenticatedScope(): AuthenticatedScope {
  const tenantId = localStorage.getItem('tenantId') || '';
  const token = localStorage.getItem('sessionToken');
  if (tenantId !== snapshot.tenantId || token !== previousToken) {
    previousToken = token;
    snapshot = {
      key: `session-${++generation}`,
      tenantId,
      authenticated: Boolean(tenantId && token),
    };
  }
  return snapshot;
}

function checkScope() {
  const current = getAuthenticatedScope();
  if (current.key !== lastNotifiedKey) {
    lastNotifiedKey = current.key;
    listeners.forEach(listener => listener());
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('storage', checkScope);
    window.addEventListener('focus', checkScope);
    document.addEventListener('visibilitychange', checkScope);
    // Same-document storage writes do not dispatch a storage event. Every
    // async completion and action also checks the current snapshot directly.
    timer = setInterval(checkScope, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      window.removeEventListener('storage', checkScope);
      window.removeEventListener('focus', checkScope);
      document.removeEventListener('visibilitychange', checkScope);
    }
  };
}

export function useAuthenticatedScope(): AuthenticatedScope {
  return useSyncExternalStore(subscribe, getAuthenticatedScope);
}
