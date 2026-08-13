import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';

export const MEMBER_ACCESS_REASON_MAX_LENGTH = 500;

export type MemberAccessAction = 'suspend' | 'reactivate';

export interface MemberAccessDialogTarget {
  name: string;
  email: string;
}

export interface MemberAccessConfirmationDialogProps {
  action: MemberAccessAction;
  target: MemberAccessDialogTarget;
  reason: string;
  busy: boolean;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function MemberAccessConfirmationDialog({
  action,
  target,
  reason,
  busy,
  onReasonChange,
  onCancel,
  onConfirm,
}: MemberAccessConfirmationDialogProps) {
  const { t } = useTranslation('Members');
  const suspending = action === 'suspend';
  const targetLabel = target.name?.trim() || target.email;

  return (
    <Modal
      isOpen={true}
      size="w-full max-w-[520px]"
      isCloseable={!busy}
      onClose={onCancel}
    >
      <form
        onSubmit={event => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <h2
          id="modal-title"
          className="pr-8 text-xl font-light text-white"
        >
          {t(suspending ? 'Suspend access for {{member}}?' : 'Reactivate access for {{member}}?', {
            member: targetLabel,
          })}
        </h2>

        <p className="mt-2 text-sm text-white text-opacity-70">{target.email}</p>
        <p className="mt-4 text-sm leading-6 text-white text-opacity-70">
          {t(
            suspending
              ? 'Suspending access immediately blocks new sign-ins and revokes all active sessions.'
              : 'Reactivating access restores sign-in without changing the member profile or role.'
          )}
        </p>

        <label
          htmlFor="member-access-reason"
          className="mt-5 block text-sm font-medium text-white"
        >
          {t('Administrative reason (optional)')}
        </label>
        <textarea
          id="member-access-reason"
          value={reason}
          maxLength={MEMBER_ACCESS_REASON_MAX_LENGTH}
          disabled={busy}
          rows={4}
          className="focus:border-primary-main mt-2 w-full resize-y rounded-lg border border-white border-opacity-10 bg-white bg-opacity-10 p-3 text-white placeholder:text-white placeholder:text-opacity-40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={t('Add a reason for the audit trail')}
          onChange={event => onReasonChange(event.target.value)}
        />
        <div className="mt-1 text-right text-xs text-white text-opacity-50">
          {t('{{count}} / 500 characters', { count: reason.length })}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            className="h-[41px] min-w-[111px] rounded-lg bg-transparent px-4 text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onCancel}
          >
            {t('Cancel')}
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`h-[41px] min-w-[140px] rounded-lg px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
              suspending ? 'bg-[#FF6B6B] text-[#151815]' : 'bg-[#6ED47C] text-[#151815]'
            }`}
          >
            {busy ? '...' : t(suspending ? 'Suspend access' : 'Reactivate access')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
