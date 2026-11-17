import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserAccessState, UserRole } from '../../api/userDTO';
import MemberAccessManagement from './MemberAccessManagement';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { member?: string; count?: number }) =>
      key
        .replace('{{member}}', values?.member ?? '')
        .replace('{{count}}', String(values?.count ?? '')),
  }),
}));

const actor = {
  id: 'admin',
  role: UserRole.ADMIN,
  accessState: UserAccessState.ACTIVE,
};
const target = {
  id: 'user',
  role: UserRole.USER,
  accessState: UserAccessState.ACTIVE,
  name: 'Sam User',
  email: 'sam@example.com',
};

const renderManagement = ({
  suspend = jest.fn(),
  reactivate = jest.fn(),
}: {
  suspend?: jest.Mock;
  reactivate?: jest.Mock;
} = {}) => {
  const refreshMembers = jest.fn().mockResolvedValue(undefined);
  const notify = jest.fn();
  const onUnauthorized = jest.fn();
  render(
    React.createElement(MemberAccessManagement, {
      actor,
      target,
      repository: {
        SuspendTenantUser: suspend,
        ReactivateTenantUser: reactivate,
      },
      refreshMembers,
      notify,
      onUnauthorized,
      onEdit: jest.fn(),
      onDelete: jest.fn(),
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Sam User' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Suspend access' }));
  return { refreshMembers, notify, onUnauthorized };
};

describe('member access management integration', () => {
  test('requires confirmation, submits the optional reason, refreshes, and reports success', async () => {
    const suspend = jest.fn().mockResolvedValue({
      success: true,
      message: 'Member suspended.',
      data: { userId: target.id, accessState: UserAccessState.SUSPENDED },
    });
    const { refreshMembers, notify } = renderManagement({ suspend });

    expect(suspend).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Administrative reason (optional)'), {
      target: { value: '  Abuse report  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suspend access' }));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Member suspended.', 'success'));
    expect(suspend).toHaveBeenCalledWith({ userId: target.id, reason: 'Abuse report' });
    expect(refreshMembers).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('shows an API failure and keeps the dialog available for retry', async () => {
    const suspend = jest.fn().mockRejectedValue({
      errorCode: 'DATABASE_ERROR',
      message: 'Unable to update account access.',
    });
    const { refreshMembers, notify } = renderManagement({ suspend });

    fireEvent.click(screen.getByRole('button', { name: 'Suspend access' }));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Unable to update account access.', 'error')
    );
    expect(refreshMembers).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  test('refreshes and closes after a conflict while preserving the backend message', async () => {
    const suspend = jest.fn().mockRejectedValue({
      errorCode: 'ACCOUNT_ACCESS_TRANSITION_IN_PROGRESS',
      message: 'Another account access change is already in progress.',
    });
    const { refreshMembers, notify } = renderManagement({ suspend });

    fireEvent.click(screen.getByRole('button', { name: 'Suspend access' }));

    await waitFor(() => expect(refreshMembers).toHaveBeenCalledTimes(1));
    expect(notify).toHaveBeenCalledWith(
      'Another account access change is already in progress.',
      'error'
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('delegates unauthorized responses to the session handler path', async () => {
    const suspend = jest.fn().mockRejectedValue({
      errorCode: 'UNAUTHORIZED_ACCESS',
      message: 'Authentication required.',
    });
    const { onUnauthorized } = renderManagement({ suspend });

    fireEvent.click(screen.getByRole('button', { name: 'Suspend access' }));

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });
});
