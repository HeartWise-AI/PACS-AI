import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import MemberAccessConfirmationDialog, {
  MEMBER_ACCESS_REASON_MAX_LENGTH,
} from './MemberAccessConfirmationDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { member?: string; count?: number }) =>
      key
        .replace('{{member}}', values?.member ?? '')
        .replace('{{count}}', String(values?.count ?? '')),
  }),
}));

describe('member access confirmation dialog', () => {
  test.each([
    ['suspend', 'Suspend access for Alex Admin?', 'revokes all active sessions', 'Suspend access'],
    ['reactivate', 'Reactivate access for Alex Admin?', 'restores sign-in', 'Reactivate access'],
  ] as const)('renders the %s effect and target identity', (action, title, effect, submitLabel) => {
    const renderer = TestRenderer.create(
      React.createElement(MemberAccessConfirmationDialog, {
        action,
        target: { name: 'Alex Admin', email: 'alex@example.com' },
        reason: '',
        busy: false,
        onReasonChange: jest.fn(),
        onCancel: jest.fn(),
        onConfirm: jest.fn(),
      })
    );

    expect(renderer.root.findByProps({ id: 'modal-title' }).children.join('')).toContain(title);
    expect(
      renderer.root.findAllByType('p').some(node => node.children.join('').includes(effect))
    ).toBe(true);
    expect(renderer.root.findByProps({ type: 'submit' }).children.join('')).toBe(submitLabel);
  });

  test('limits the optional reason and forwards reason, cancel, and confirm events', () => {
    const onReasonChange = jest.fn();
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const renderer = TestRenderer.create(
      React.createElement(MemberAccessConfirmationDialog, {
        action: 'suspend',
        target: { name: '', email: 'target@example.com' },
        reason: 'Audit reason',
        busy: false,
        onReasonChange,
        onCancel,
        onConfirm,
      })
    );
    const textarea = renderer.root.findByType('textarea');

    expect(textarea.props.maxLength).toBe(MEMBER_ACCESS_REASON_MAX_LENGTH);
    act(() => textarea.props.onChange({ target: { value: 'Updated reason' } }));
    act(() => renderer.root.findByProps({ type: 'button' }).props.onClick());
    act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault: jest.fn() }));

    expect(onReasonChange).toHaveBeenCalledWith('Updated reason');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
