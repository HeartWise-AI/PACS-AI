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
let pending: Promise<UserAccess | null> | null = null;
let generation = 0;
const listeners = new Set<Listener>();

function publish(access: UserAccess | null): void {
  current = access;
  listeners.forEach(listener => listener(access));
}

async function fetchAccess(): Promise<UserAccess | null> {
  try {
    const response = await userRepository.GetMyAccess();
    if (!response?.data) {
      throw new Error('empty access response');
    }
    return normalizeUserAccess(response.data);
  } catch (accessError) {
    void accessError;
    try {
      const me = await userRepository.GetCurrentUser();
      return accessForRole(me?.data?.role);
    } catch (userError) {
      void userError;
      return null;
    }
  }
}

export function getCachedUserAccess(): UserAccess | null {
  return current;
}

/** Returns cached access, loading it the first time (or after `refresh`). */
export function loadUserAccess(options?: { refresh?: boolean }): Promise<UserAccess | null> {
  if (!options?.refresh) {
    if (current) {
      return Promise.resolve(current);
    }
    if (pending) {
      return pending;
    }
  }
  const requestGeneration = ++generation;
  const request = fetchAccess().then(access => {
    if (requestGeneration === generation) {
      pending = null;
      publish(access);
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
