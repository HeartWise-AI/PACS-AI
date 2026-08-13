import React from 'react';
import TestRenderer from 'react-test-renderer';
import { UserAccessState } from '../../api/userDTO';
import MemberAccessStatusBadge from './MemberAccessStatusBadge';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('member access status badge', () => {
  test.each([
    [UserAccessState.ACTIVE, 'Active'],
    [UserAccessState.SUSPENDED, 'Suspended'],
    [undefined, 'Unknown'],
  ])('renders %s with visible and accessible status text', (accessState, label) => {
    const renderer = TestRenderer.create(
      React.createElement(MemberAccessStatusBadge, { accessState })
    );
    const badge = renderer.root.findByType('span');

    expect(badge.children.join('')).toBe(label);
    expect(badge.props['aria-label']).toBe(`Access Status: ${label}`);
  });
});
