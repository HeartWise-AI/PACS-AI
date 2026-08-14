import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Error } from '../../api/dto';
import MemberAccessConfirmationDialog, {
  type MemberAccessAction,
} from './MemberAccessConfirmationDialog';
import MemberActionsMenu, { type MemberActionsTarget } from './MemberActionsMenu';
import { getMemberAccessEligibility, type MemberAccessIdentity } from './memberAccessPolicy';
import {
  ACCOUNT_ACCESS_TRANSITION_IN_PROGRESS,
  executeMemberAccessTransition,
  type MemberAccessTransitionError,
  type MemberAccessTransitionRepository,
} from './memberAccessTransition';

export interface MemberAccessManagementProps {
  actor: MemberAccessIdentity | null;
  target: MemberActionsTarget;
  repository: MemberAccessTransitionRepository;
  refreshMembers: () => Promise<void>;
  notify: (message: string, type: 'success' | 'error') => void;
  onUnauthorized: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function MemberAccessManagement({
  actor,
  target,
  repository,
  refreshMembers,
  notify,
  onUnauthorized,
  onEdit,
  onDelete,
}: MemberAccessManagementProps) {
  const { t } = useTranslation('Members');
  const [action, setAction] = useState<MemberAccessAction | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const closeDialog = () => {
    if (!busy) {
      setAction(null);
      setReason('');
    }
  };

  const confirmAccessChange = async () => {
    if (!action) {
      return;
    }

    if (!getMemberAccessEligibility(actor, target).allowed) {
      setAction(null);
      setReason('');
      notify(t('Account access management is no longer available for this member.'), 'error');
      return;
    }

    setBusy(true);
    try {
      const response = await executeMemberAccessTransition({
        action,
        userId: target.id,
        reason,
        repository,
        refreshMembers,
      });
      notify(response.message, 'success');
      setAction(null);
      setReason('');
    } catch (error) {
      const accessError = error as MemberAccessTransitionError;
      if (accessError.errorCode === ACCOUNT_ACCESS_TRANSITION_IN_PROGRESS) {
        setAction(null);
        setReason('');
      }
      if (accessError.errorCode === Error.UNAUTHORIZED_ACCESS) {
        onUnauthorized();
      }
      notify(accessError.message || t('Unable to update account access.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <MemberActionsMenu
        actor={actor}
        target={target}
        onEdit={onEdit}
        onDelete={onDelete}
        onAccessChange={nextAction => {
          setReason('');
          setAction(nextAction);
        }}
      />
      {action && (
        <MemberAccessConfirmationDialog
          action={action}
          target={target}
          reason={reason}
          busy={busy}
          onReasonChange={setReason}
          onCancel={closeDialog}
          onConfirm={() => {
            void confirmAccessChange();
          }}
        />
      )}
    </>
  );
}
