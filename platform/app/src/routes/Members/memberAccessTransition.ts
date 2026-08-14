import type { APIResponse } from '../../api/dto';
import type {
  ChangeTenantUserAccessRequest,
  ChangeTenantUserAccessResponse,
} from '../../api/userDTO';
import type { MemberAccessAction } from './MemberAccessConfirmationDialog';

export const ACCOUNT_ACCESS_TRANSITION_IN_PROGRESS = 'ACCOUNT_ACCESS_TRANSITION_IN_PROGRESS';

export interface MemberAccessTransitionError {
  errorCode?: string;
  message?: string;
}

export interface MemberAccessTransitionRepository {
  SuspendTenantUser(
    request: ChangeTenantUserAccessRequest
  ): Promise<APIResponse<ChangeTenantUserAccessResponse>>;
  ReactivateTenantUser(
    request: ChangeTenantUserAccessRequest
  ): Promise<APIResponse<ChangeTenantUserAccessResponse>>;
}

export interface ExecuteMemberAccessTransitionOptions {
  action: MemberAccessAction;
  userId: string;
  reason?: string;
  repository: MemberAccessTransitionRepository;
  refreshMembers: () => Promise<void>;
}

export const executeMemberAccessTransition = async ({
  action,
  userId,
  reason,
  repository,
  refreshMembers,
}: ExecuteMemberAccessTransitionOptions): Promise<APIResponse<ChangeTenantUserAccessResponse>> => {
  const request = { userId, reason: reason?.trim() || undefined };

  try {
    const response =
      action === 'suspend'
        ? await repository.SuspendTenantUser(request)
        : await repository.ReactivateTenantUser(request);
    await refreshMembers();
    return response;
  } catch (error) {
    if (
      (error as MemberAccessTransitionError)?.errorCode === ACCOUNT_ACCESS_TRANSITION_IN_PROGRESS
    ) {
      await refreshMembers();
    }
    throw error;
  }
};
