import { useCallback, useEffect, useState } from 'react';
import {
  can as canWith,
  canUseModel as canUseModelWith,
  type UserAccess,
} from '../access/permissions';
import {
  getCachedUserAccess,
  loadUserAccess,
  loadUserAccessForRole,
  subscribeUserAccess,
} from '../access/userAccessService';

export interface UseUserAccessResult {
  /** null while loading or when the user is signed out. */
  access: UserAccess | null;
  loading: boolean;
  can: (permission: string) => boolean;
  canUseModel: (modelId?: string | null) => boolean;
  refresh: () => Promise<UserAccess | null>;
}

/**
 * @param roleHint base role of the signed-in user when the caller already has
 *   it; cached access for a different role is reloaded.
 */
export function useUserAccess(roleHint?: string | null): UseUserAccessResult {
  const [access, setAccess] = useState<UserAccess | null>(() => getCachedUserAccess());
  const [loading, setLoading] = useState(() => getCachedUserAccess() === null);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeUserAccess(next => {
      if (mounted) {
        setAccess(next);
        setLoading(false);
      }
    });
    if (!roleHint && !localStorage.getItem('sessionToken')) {
      setLoading(false);
      return () => {
        mounted = false;
        unsubscribe();
      };
    }
    const load = roleHint ? loadUserAccessForRole(roleHint) : loadUserAccess();
    void load.then(next => {
      if (mounted) {
        setAccess(next);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [roleHint]);

  const can = useCallback((permission: string) => canWith(access, permission), [access]);
  const canUseModel = useCallback(
    (modelId?: string | null) => canUseModelWith(access, modelId),
    [access]
  );
  const refresh = useCallback(() => loadUserAccess({ refresh: true }), []);

  return { access, loading, can, canUseModel, refresh };
}

export default useUserAccess;
