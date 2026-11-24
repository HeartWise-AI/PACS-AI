import { useCallback, useEffect, useRef, useState } from 'react';
import userRepository from '@pacs-ai/extension-core/src/api/userRepository';
import type {
  CustomRoleResponse,
  UpsertCustomRoleRequest,
} from '@pacs-ai/extension-core/src/api/userDTO';
import { sortRoles } from './rolesModel';

export type CustomRolesRepository = Pick<
  typeof userRepository,
  'GetCustomRoles' | 'CreateCustomRole' | 'UpdateCustomRole' | 'DeleteCustomRole'
>;

export interface ApiErrorLike {
  errorCode?: string;
  message?: string;
}

/** Loads the tenant's custom roles and wraps create, update and delete. */
export function useCustomRoles({
  enabled,
  repository = userRepository,
}: {
  enabled: boolean;
  repository?: CustomRolesRepository;
}) {
  const [roles, setRoles] = useState<CustomRoleResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<ApiErrorLike | null>(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const response = await repository.GetCustomRoles();
      if (request === requestRef.current) {
        setRoles(sortRoles(response.data?.roles ?? []));
        setLoadError(null);
      }
    } catch (error) {
      if (request === requestRef.current) {
        setLoadError((error as ApiErrorLike) ?? {});
      }
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
      }
    }
  }, [repository]);

  useEffect(() => {
    if (enabled) {
      void refresh();
    }
  }, [enabled, refresh]);

  const save = useCallback(
    async (id: string | null, request: UpsertCustomRoleRequest) => {
      const response = id
        ? await repository.UpdateCustomRole(id, request)
        : await repository.CreateCustomRole(request);
      await refresh();
      return response;
    },
    [refresh, repository]
  );

  const remove = useCallback(
    async (id: string) => {
      const response = await repository.DeleteCustomRole(id);
      await refresh();
      return response;
    },
    [refresh, repository]
  );

  return { roles, loading, loadError, refresh, save, remove };
}

export type UseCustomRolesResult = ReturnType<typeof useCustomRoles>;
