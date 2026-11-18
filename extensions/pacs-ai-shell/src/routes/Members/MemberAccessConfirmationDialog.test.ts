import React from 'react';
import { fireEvent, render } from '@testing-library/react';
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

function single<T extends Element>(nodes: NodeListOf<T>): T {
  expect(nodes).toHaveLength(1);
  return nodes[0];
}

describe('member access confirmation dialog', () => {
  test.each([
    ['suspend', 'Suspend access for Alex Admin?', 'revokes all active sessions', 'Suspend access'],
    ['reactivate', 'Reactivate access for Alex Admin?', 'restores sign-in', 'Reactivate access'],
  ] as const)('renders the %s effect and target identity', (action, title, effect, submitLabel) => {
    const { container } = render(
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

    expect(single(container.querySelectorAll('[id="modal-title"]')).textContent).toContain(title);
    expect(
      Array.from(container.querySelectorAll('p')).some(node =>
        (node.textContent ?? '').includes(effect)
      )
    ).toBe(true);
    expect(single(container.querySelectorAll('[type="submit"]')).textContent).toBe(submitLabel);
  });

  test('limits the optional reason and forwards reason, cancel, and confirm events', () => {
    const onReasonChange = jest.fn();
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const { container } = render(
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
    const textarea = single(container.querySelectorAll('textarea'));

    expect(textarea.maxLength).toBe(MEMBER_ACCESS_REASON_MAX_LENGTH);
    fireEvent.change(textarea, { target: { value: 'Updated reason' } });
    fireEvent.click(single(container.querySelectorAll('[type="button"]')));
    fireEvent.submit(single(container.querySelectorAll('form')));

    expect(onReasonChange).toHaveBeenCalledWith('Updated reason');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
