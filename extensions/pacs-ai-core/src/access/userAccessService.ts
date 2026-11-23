import userRepository from '../api/userRepository';
import { onAuthenticatedSessionCleared } from '../utils/authenticatedSession';
import { accessForRole, normalizeUserAccess, type UserAccess } from './permissions';

/**
 * Loads the signed-in user's effective permissions once per session and
 * shares them with every component. The gateway enforces every permission;
 * the viewer only uses this to hide what the user cannot open.
 *
 * If `/v1/user/me/access` is unavailable (older gateway), access falls back to
 * the base role from `/v1/user/me`, which matches the pre-custom-role rules.
 */
type Listener = (access: UserAccess | null) => void;

let current: UserAccess | null = null;
/** Set when `current` came from the role-only fallback; such access is retried. */
let currentIsFallback = false;
/** How long a role-only fallback is served before the access endpoint is retried. */
export const FALLBACK_RETRY_MS = 30_000;
let fallbackLoadedAt = 0;
let pending: Promise<UserAccess | null> | null = null;
let generation = 0;
const listeners = new Set<Listener>();

function publish(access: UserAccess | null, fallback = false): void {
  current = access;
  currentIsFallback = Boolean(access) && fallback;
  fallbackLoadedAt = currentIsFallback ? Date.now() : 0;
  listeners.forEach(listener => listener(access));
}

type FetchedAccess = { access: UserAccess | null; fallback: boolean };

async function fetchAccess(): Promise<FetchedAccess> {
  try {
    const response = await userRepository.GetMyAccess();
    if (!response?.data) {
      throw new Error('empty access response');
    }
    return { access: normalizeUserAccess(response.data), fallback: false };
  } catch (accessError) {
    void accessError;
    // Role-only access keeps the page usable (older gateway, or a transient
    // failure), but it is retried so a custom role is not lost for the session.
    try {
      const me = await userRepository.GetCurrentUser();
      return { access: accessForRole(me?.data?.role), fallback: true };
    } catch (userError) {
      void userError;
      return { access: null, fallback: false };
    }
  }
}

function fallbackExpired(): boolean {
  return currentIsFallback && Date.now() - fallbackLoadedAt >= FALLBACK_RETRY_MS;
}

export function getCachedUserAccess(): UserAccess | null {
  return current;
}

/** Returns cached access, loading it the first time (or after `refresh`). */
export function loadUserAccess(options?: { refresh?: boolean }): Promise<UserAccess | null> {
  if (!options?.refresh) {
    if (current && !fallbackExpired()) {
      return Promise.resolve(current);
    }
    if (pending) {
      return pending;
    }
  }
  const requestGeneration = ++generation;
  const request = fetchAccess().then(({ access, fallback }) => {
    if (requestGeneration === generation) {
      pending = null;
      publish(access, fallback);
    }
    return access;
  });
  pending = request;
  return request;
}

export function subscribeUserAccess(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearUserAccess(): void {
  generation += 1;
  pending = null;
  publish(null);
}

onAuthenticatedSessionCleared(clearUserAccess);

/**
 * Loads access for a user whose base role the caller already knows, reloading
 * when the cached access belongs to a different role (role changed, or a
 * different account signed in on this tab).
 */
export async function loadUserAccessForRole(role?: string | null): Promise<UserAccess | null> {
  const access = await loadUserAccess();
  if (access && role && access.role !== role) {
    return loadUserAccess({ refresh: true });
  }
  return access;
}
