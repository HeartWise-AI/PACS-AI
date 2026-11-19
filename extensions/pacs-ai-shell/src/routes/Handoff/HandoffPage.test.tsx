import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { HandoffPage, LINK_CODE_STORAGE_KEY, readFragmentCode } from './HandoffPage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@pacs-ai/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Typography: ({
    children,
    variant,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { variant?: string }) => <p {...props}>{children}</p>,
}));

const mockExchange = jest.fn();
const mockLink = jest.fn();
jest.mock('@pacs-ai/extension-core/src/api/handoffRepository', () => ({
  __esModule: true,
  default: {
    Exchange: (...args: unknown[]) => mockExchange(...args),
    Link: (...args: unknown[]) => mockLink(...args),
  },
}));

const mockGetCurrentUser = jest.fn();
jest.mock('@pacs-ai/extension-core/src/api/userRepository', () => ({
  __esModule: true,
  default: { GetCurrentUser: () => mockGetCurrentUser() },
}));

const mockNavigateAfterAuth = jest.fn();
jest.mock('@pacs-ai/extension-core/src/service/userService', () => ({
  navigateAfterAuth: (...args: unknown[]) => mockNavigateAfterAuth(...args),
}));

const CODE = 'A'.repeat(43);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(mode: 'handoff' | 'link', hash = `#code=${CODE}`) {
  window.history.replaceState(null, '', `/auth/${mode}${hash}`);
  return render(
    <MemoryRouter initialEntries={[`/auth/${mode}`]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <HandoffPage mode={mode} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

test('reads only a well-formed code from the fragment', () => {
  expect(readFragmentCode(`#code=${CODE}`)).toBe(CODE);
  expect(readFragmentCode('#code=short')).toBeNull();
  expect(readFragmentCode('')).toBeNull();
});

test('handoff exchanges the code, stores the session and continues like a login', async () => {
  mockExchange.mockResolvedValue({
    sessionToken: 's-1',
    tenantId: 't1',
    returnPath: '/viewer?StudyInstanceUIDs=1.2',
  });
  mockGetCurrentUser.mockResolvedValue({ success: true, data: { email: 'doc@example.org' } });

  renderPage('handoff');

  await waitFor(() => expect(mockNavigateAfterAuth).toHaveBeenCalled());
  expect(mockExchange).toHaveBeenCalledWith(CODE);
  expect(window.location.hash).toBe('');
  expect(localStorage.getItem('sessionToken')).toBe('s-1');
  expect(localStorage.getItem('tenantId')).toBe('t1');
  expect(mockNavigateAfterAuth.mock.calls[0][2]).toBe('/viewer?StudyInstanceUIDs=1.2');
});

test('handoff refuses an unsafe return path', async () => {
  mockExchange.mockResolvedValue({
    sessionToken: 's-1',
    tenantId: 't1',
    returnPath: '//evil.example',
  });
  mockGetCurrentUser.mockResolvedValue({ success: true, data: {} });

  renderPage('handoff');

  await waitFor(() => expect(mockNavigateAfterAuth).toHaveBeenCalled());
  expect(mockNavigateAfterAuth.mock.calls[0][2]).toBe('/');
});

test('an expired handoff code shows an error and keeps no session', async () => {
  mockExchange.mockRejectedValue({ response: { status: 401 } });

  renderPage('handoff');

  expect((await screen.findByRole('alert')).textContent).toContain('expired');
  expect(localStorage.getItem('sessionToken')).toBeNull();
});

test('a handoff without a code never calls the API', async () => {
  renderPage('handoff', '');

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(mockExchange).not.toHaveBeenCalled();
});

test('link sends a signed-out user to sign in and keeps the code', async () => {
  localStorage.setItem('tenantId', 't1');

  renderPage('link');

  await waitFor(() =>
    expect(screen.getByTestId('location').textContent).toContain(
      '/login?t=t1&returnTo=%2Fauth%2Flink'
    )
  );
  expect(sessionStorage.getItem(LINK_CODE_STORAGE_KEY)).toBe(CODE);
  expect(window.location.hash).toBe('');
});

test('link asks a signed-in user to confirm, then links and continues', async () => {
  localStorage.setItem('sessionToken', 'existing');
  mockGetCurrentUser.mockResolvedValue({ success: true, data: { email: 'doc@example.org' } });
  mockLink.mockResolvedValue({ returnPath: '/viewer?StudyInstanceUIDs=1.2' });

  renderPage('link');

  expect((await screen.findByTestId('handoff-link-account')).textContent).toContain(
    'doc@example.org'
  );
  expect(mockLink).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('handoff-link-confirm'));

  await waitFor(() =>
    expect(screen.getByTestId('location').textContent).toContain('/viewer?StudyInstanceUIDs=1.2')
  );
  expect(mockLink).toHaveBeenCalledWith(CODE);
  expect(sessionStorage.getItem(LINK_CODE_STORAGE_KEY)).toBeNull();
});

test('link explains a different email', async () => {
  localStorage.setItem('sessionToken', 'existing');
  mockGetCurrentUser.mockResolvedValue({ success: true, data: { email: 'doc@example.org' } });
  mockLink.mockRejectedValue({ response: { status: 403 } });

  renderPage('link');
  fireEvent.click(await screen.findByTestId('handoff-link-confirm'));

  expect((await screen.findByRole('alert')).textContent).toContain('different email');
});

test('cancelling a link forgets the code', async () => {
  localStorage.setItem('sessionToken', 'existing');
  mockGetCurrentUser.mockResolvedValue({ success: true, data: { email: 'doc@example.org' } });

  renderPage('link');
  fireEvent.click(await screen.findByTestId('handoff-link-cancel'));

  expect(sessionStorage.getItem(LINK_CODE_STORAGE_KEY)).toBeNull();
  expect(mockLink).not.toHaveBeenCalled();
});
