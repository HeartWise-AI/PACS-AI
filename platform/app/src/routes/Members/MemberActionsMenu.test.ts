import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UserAccessState, UserRole } from '../../api/userDTO';
import MemberActionsMenu, { type MemberActionsTarget } from './MemberActionsMenu';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { member?: string }) =>
      key.replace('{{member}}', values?.member ?? ''),
  }),
}));

const member = (
  id: string,
  role: UserRole,
  accessState: UserAccessState = UserAccessState.ACTIVE
): MemberActionsTarget => ({
  id,
  role,
  accessState,
  name: `${role} ${id}`,
  email: `${id}@example.com`,
});

const renderMenu = (actor: MemberActionsTarget, target: MemberActionsTarget) => {
  const onAccessChange = jest.fn();
  render(
    React.createElement(MemberActionsMenu, {
      actor,
      target,
      onEdit: jest.fn(),
      onDelete: jest.fn(),
      onAccessChange,
    })
  );
  fireEvent.click(screen.getByRole('button', { name: `Actions for ${target.name}` }));
  return onAccessChange;
};

describe('member actions menu', () => {
  test('offers suspension only for an eligible active target', () => {
    const target = member('user', UserRole.USER);
    const onAccessChange = renderMenu(member('admin', UserRole.ADMIN), target);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Suspend access' }));
    expect(onAccessChange).toHaveBeenCalledWith('suspend');
  });

  test('offers reactivation only for an eligible suspended target', () => {
    const target = member('user', UserRole.USER, UserAccessState.SUSPENDED);
    const onAccessChange = renderMenu(member('admin', UserRole.ADMIN), target);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Reactivate access' }));
    expect(onAccessChange).toHaveBeenCalledWith('reactivate');
  });

  test.each([
    [member('same', UserRole.ADMIN), member('same', UserRole.USER)],
    [member('admin', UserRole.ADMIN), member('owner', UserRole.OWNER)],
    [member('admin-1', UserRole.ADMIN), member('admin-2', UserRole.ADMIN)],
  ])('hides access controls for restricted self, owner, and peer targets', (actor, target) => {
    renderMenu(actor, target);

    expect(screen.queryByRole('menuitem', { name: 'Suspend access' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Reactivate access' })).toBeNull();
  });

  test('closes on Escape and returns focus to the trigger', () => {
    const target = member('user', UserRole.USER);
    renderMenu(member('admin', UserRole.ADMIN), target);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: `Actions for ${target.name}` })
    );
  });

  test('supports keyboard navigation between menu items', () => {
    const target = member('user', UserRole.USER);
    renderMenu(member('admin', UserRole.ADMIN), target);
    const menu = screen.getByRole('menu');

    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Edit' }));
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Suspend access' }));
  });
});
