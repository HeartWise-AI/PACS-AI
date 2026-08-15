import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { UserRole } from '../../api/userDTO';
import TopNavigation from './TopNavigation';

const mockGetCurrentUser = jest.fn();
const mockGetTenantInfo = jest.fn();
const mockGetAPIInfo = jest.fn();
const mockLogoutUser = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../App', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  return { FrontendVersionContext: React.createContext('frontend-test') };
});

jest.mock('../../api/userRepository', () => ({
  __esModule: true,
  default: { GetCurrentUser: (...args) => mockGetCurrentUser(...args) },
}));

jest.mock('../../api/tenantRepository', () => ({
  __esModule: true,
  default: { GetTenantInfo: (...args) => mockGetTenantInfo(...args) },
}));

jest.mock('../../api/repository', () => ({
  __esModule: true,
  default: { GetAPIInfo: (...args) => mockGetAPIInfo(...args) },
}));

jest.mock('../../service/userService', () => ({
  logoutUser: (...args) => mockLogoutUser(...args),
}));

jest.mock('../inference/InferenceNotificationsBell', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('button', { 'aria-label': 'Notifications' }),
  };
});

const user = (role: UserRole = UserRole.USER, isConsentSigned = true) => ({
  id: 'user-1',
  tenantId: 'tenant-1',
  role,
  name: 'Ada Clinician',
  isConsentSigned,
});

const LocationProbe = () => {
  const location = useLocation();
  return React.createElement(
    'output',
    { 'data-testid': 'location' },
    `${location.pathname}${location.search}`
  );
};

const renderNavigation = (initialEntry = '/', title = 'Studies') =>
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      React.createElement(TopNavigation, { title }),
      React.createElement(LocationProbe)
    )
  );

describe('TopNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('tenantId', 'tenant-1');
    mockGetCurrentUser.mockResolvedValue({ data: user() });
    mockGetTenantInfo.mockResolvedValue({
      data: {
        id: 'tenant-1',
        name: 'Cardiology North',
        onboardingEnableConsent: true,
      },
    });
    mockGetAPIInfo.mockResolvedValue({ data: { version: 'backend-test' } });
  });

  afterEach(() => localStorage.clear());

  test('shows stable clinical destinations and identifies the active route', async () => {
    renderNavigation('/viewer?StudyInstanceUIDs=1.2.3&PatientName=Smith', 'Viewer');
    await screen.findByText('Ada Clinician');

    const desktopNavigation = screen.getByTestId('desktop-navigation');
    const studies = within(desktopNavigation).getByRole('link', { name: 'Studies' });
    expect(studies.getAttribute('aria-current')).toBe('page');
    expect(studies.getAttribute('href')).toBe('/?PatientName=Smith');
    expect(
      within(desktopNavigation).getByText('AI Predictions').getAttribute('aria-disabled')
    ).toBe('true');
    expect(within(desktopNavigation).queryByText('Admin Console')).toBeNull();
  });

  test('preserves the role-gated admin console and its new-tab behavior', async () => {
    mockGetCurrentUser.mockResolvedValue({ data: user(UserRole.ADMIN) });
    renderNavigation('/');

    const adminConsole = await screen.findByRole('link', {
      name: 'Admin Console (Opens in new tab)',
    });
    expect(adminConsole.getAttribute('href')).toBe('/admin/members');
    expect(adminConsole.getAttribute('target')).toBe('_blank');
  });

  test('shows the existing admin destinations on admin pages', async () => {
    renderNavigation('/admin/workspace-settings', 'Workspace Settings');
    await screen.findByText('Ada Clinician');

    const desktopNavigation = screen.getByTestId('desktop-navigation');
    expect(within(desktopNavigation).getByRole('link', { name: 'Members' })).not.toBeNull();
    expect(within(desktopNavigation).getByRole('link', { name: 'Kibana Logs' })).not.toBeNull();
    expect(
      within(desktopNavigation)
        .getByRole('link', { name: 'Workspace Settings' })
        .getAttribute('aria-current')
    ).toBe('page');
    expect(within(desktopNavigation).queryByText('Launch PACS AI')).toBeNull();
  });

  test('supports keyboard navigation and predictable Escape focus in the small-screen menu', async () => {
    renderNavigation('/');
    await screen.findByText('Ada Clinician');

    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(screen.getByTestId('desktop-navigation').className).toContain('lg:flex');
    expect(trigger.parentElement?.className).toContain('lg:hidden');
    fireEvent.click(trigger);
    const menu = screen.getByTestId('mobile-navigation-menu');
    const studies = within(menu).getByRole('menuitem', { name: 'Studies' });
    const aiModels = within(menu).getByRole('menuitem', { name: 'AI Models' });
    const settings = within(menu).getByRole('menuitem', { name: 'Settings' });

    await waitFor(() => expect(document.activeElement).toBe(studies));
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(aiModels);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Logout' }));
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(studies);
    expect(settings).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('mobile-navigation-menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  test('keeps account settings, tenant context, versions, and logout together', async () => {
    renderNavigation('/');
    await screen.findByText('Ada Clinician');

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const menu = screen.getByTestId('account-menu');
    expect(within(menu).getByText('Cardiology North')).not.toBeNull();
    expect(within(menu).getByText(/Backend: backend-test/)).not.toBeNull();
    expect(within(menu).getByText(/Frontend: frontend-test/)).not.toBeNull();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Logout' }));
    expect(mockLogoutUser).toHaveBeenCalledWith(expect.any(Function), 'tenant-1', false);
  });

  test('closes an open account menu when focus moves to page content', async () => {
    renderNavigation('/');
    await screen.findByText('Ada Clinician');

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByTestId('account-menu')).not.toBeNull();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('account-menu')).toBeNull();
  });

  test('preserves consent enforcement on authenticated pages', async () => {
    mockGetCurrentUser.mockResolvedValue({ data: user(UserRole.USER, false) });
    renderNavigation('/');

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toContain('/user/consent')
    );
  });
});
