import React from 'react';
import { render } from '@testing-library/react';
import { UserAccessState } from '@pacs-ai/extension-core/src/api/userDTO';
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
    const { container } = render(React.createElement(MemberAccessStatusBadge, { accessState }));
    const spans = container.querySelectorAll('span');
    expect(spans).toHaveLength(1);
    const badge = spans[0];

    expect(badge.textContent).toBe(label);
    expect(badge.getAttribute('aria-label')).toBe(`Access Status: ${label}`);
  });
});
