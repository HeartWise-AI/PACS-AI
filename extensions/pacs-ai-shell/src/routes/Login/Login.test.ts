import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import LoginPage from './Login';

const mockNavigate = jest.fn();
const mockShowAlert = jest.fn();
const mockLogin = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockGetPublicTenant = jest.fn();
const mockGetAPIInfo = jest.fn();
const mockNavigateAfterAuth = jest.fn();
const mockTurnstileProps = jest.fn();
const testCredential = ['entered', 'value'].join('-');
let mockLocationSearch = '?t=tenant-a&code=invite-code&email=invited%40example.org';
let mockTurnstileStatus: string | null = null;
const originalTurnstileSiteKey = process.env.APP_PUBLIC_TURNSTILE_SITE_KEY;
const restoreTurnstileSiteKey = () => {
  if (originalTurnstileSiteKey === undefined) {
    delete process.env.APP_PUBLIC_TURNSTILE_SITE_KEY;
  } else {
    process.env.APP_PUBLIC_TURNSTILE_SITE_KEY = originalTurnstileSiteKey;
  }
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values: Record<string, unknown> = {}) =>
      key.replace(/{{(\w+)}}/g, (_, name: string) => String(values[name] ?? '')),
  }),
}));

jest.mock('react-router', () => ({
  useLocation: () => ({ search: mockLocationSearch }),
  useNavigate: () => mockNavigate,
}));

jest.mock(
  '@pacs-ai/ui',
  () => {
    const React = require('react');
    return {
      Button: ({ children, ...props }) => React.createElement('button', props, children),
      Input: props => React.createElement('input', props),
      Logo: () => React.createElement('div', { 'data-testid': 'logo' }),
      Typography: ({ children, component = 'div', variant, ...props }) => {
        void variant;
        return React.createElement(component, props, children);
      },
    };
  },
  { virtual: true }
);

jest.mock('@pacs-ai/extension-core/src/frontendVersion', () => {
  const React = require('react');
  return { FrontendVersionContext: React.createContext('test-version') };
});

jest.mock('@pacs-ai/extension-core/src/providers/AlertProvider', () => {
  const React = require('react');
  return { AlertContext: React.createContext((...args) => mockShowAlert(...args)) };
});

jest.mock('@pacs-ai/extension-core/src/api/userRepository', () => ({
  __esModule: true,
  default: {
    ForgotPassword: jest.fn(),
    GetCurrentUser: (...args) => mockGetCurrentUser(...args),
    Login: (...args) => mockLogin(...args),
    VerifyEmail: jest.fn(),
  },
}));

jest.mock('@pacs-ai/extension-core/src/api/tenantRepository', () => ({
  __esModule: true,
  default: {
    GetPublicTenantByID: (...args) => mockGetPublicTenant(...args),
  },
}));

jest.mock('@pacs-ai/extension-core/src/api/repository', () => ({
  __esModule: true,
  default: {
    GetAPIInfo: (...args) => mockGetAPIInfo(...args),
  },
}));

jest.mock('@pacs-ai/extension-core/src/service/userService', () => ({
  logoutUser: jest.fn(),
  navigateAfterAuth: (...args) => mockNavigateAfterAuth(...args),
}));

jest.mock('@pacs-ai/extension-core/src/service/accountAccessSession', () => ({
  consumeAccountSuspendedRedirect: () => ({ suspended: false, nextSearch: '' }),
}));

jest.mock('../../components/auth/TurnstileWidget', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: function MockTurnstileWidget(props) {
      mockTurnstileProps(props);
      const { onStatusChange, resetKey } = props;
      React.useEffect(() => {
        if (mockTurnstileStatus) {
          onStatusChange?.(mockTurnstileStatus);
        }
      }, [onStatusChange, resetKey]);
      return React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'login-turnstile',
          onClick: () => props.onTokenChange('fresh-login-proof'),
        },
        `${props.action}:${props.resetKey}`
      );
    },
  };
});

const flushPromises = async () => {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const submit = (form: HTMLFormElement) => {
  act(() => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};

describe('LoginPage adaptive challenge', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetAPIInfo.mockReset();
    mockGetCurrentUser.mockReset();
    mockGetPublicTenant.mockReset();
    mockLogin.mockReset();
    mockNavigateAfterAuth.mockReset();
    mockLocationSearch = '?t=tenant-a&code=invite-code&email=invited%40example.org';
    mockTurnstileStatus = null;
    process.env.APP_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key';
    localStorage.clear();
    mockGetPublicTenant.mockResolvedValue({
      data: { id: 'tenant-a', name: 'Tenant A', onboardingEnableRegistration: true },
    });
    mockGetAPIInfo.mockResolvedValue({ data: { version: 'test-api' } });
    mockGetCurrentUser.mockResolvedValue({ success: false });
    mockNavigateAfterAuth.mockResolvedValue(undefined);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(LoginPage));
    });
    await flushPromises();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    jest.useRealTimers();
    restoreTurnstileSiteKey();
  });

  const fillCredentials = () => {
    setInputValue(container.querySelector('#email') as HTMLInputElement, 'Visitor@Example.ORG');
    setInputValue(container.querySelector('#password') as HTMLInputElement, testCredential);
  };

  it('uses the ordinary backend path once and preserves tenant navigation', async () => {
    const form = container.querySelector('form') as HTMLFormElement;
    fillCredentials();
    expect(container.querySelector('[data-testid="login-turnstile"]')).toBeNull();
    expect(mockGetPublicTenant).toHaveBeenCalledWith({ tenantId: 'tenant-a' });

    const createAccount = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Create an account'
    ) as HTMLButtonElement;
    act(() => createAccount.click());
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/register',
      search: '?t=tenant-a&code=invite-code&email=invited%40example.org',
    });
    mockNavigate.mockClear();

    let resolveLogin: (value: {
      success: boolean;
      message: string;
      data: { sessionToken: string };
    }) => void = () => undefined;
    mockLogin.mockReturnValue(
      new Promise(resolve => {
        resolveLogin = resolve;
      })
    );
    mockGetCurrentUser.mockResolvedValueOnce({
      success: true,
      data: { id: 'user-a', tenantId: 'tenant-a' },
    });

    submit(form);
    submit(form);
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      email: 'visitor@example.org',
      password: testCredential,
    });

    await act(async () => {
      resolveLogin({
        success: true,
        message: 'Signed in.',
        data: { sessionToken: 'pacs-session-token' },
      });
      await Promise.resolve();
    });
    await flushPromises();

    expect(localStorage.getItem('sessionToken')).toBe('pacs-session-token');
    expect(localStorage.getItem('tenantId')).toBe('tenant-a');
    expect(mockNavigateAfterAuth).toHaveBeenCalledWith(
      mockNavigate,
      expect.objectContaining({ id: 'user-a', tenantId: 'tenant-a' }),
      '/'
    );
    expect((container.querySelector('#password') as HTMLInputElement).value).toBe('');
  });

  it('keeps the login page available when public metadata responses omit data', async () => {
    act(() => root.unmount());
    mockGetPublicTenant.mockResolvedValueOnce({ data: undefined });
    mockGetAPIInfo.mockResolvedValueOnce({ data: undefined });
    root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(LoginPage));
    });
    await flushPromises();

    expect(container.querySelector('[data-testid="logo"]')).not.toBeNull();
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.textContent).toContain('Welcome to PACS AI');
  });

  it('escalates from a generic 401 and resets every challenged failure', async () => {
    const form = container.querySelector('form') as HTMLFormElement;
    fillCredentials();
    mockLogin
      .mockRejectedValueOnce({
        success: false,
        status: 401,
        errorCode: 'UNAUTHORIZED_ACCESS',
        challengeRequired: true,
      })
      .mockRejectedValueOnce({
        success: false,
        status: 403,
        errorCode: 'TURNSTILE_INVALID',
        challengeRequired: true,
      })
      .mockRejectedValueOnce({
        success: false,
        message: 'Login request failed.',
        challengeRequired: false,
      });

    submit(form);
    await flushPromises();
    const challenge = container.querySelector(
      '[data-testid="login-turnstile"]'
    ) as HTMLButtonElement;
    expect(challenge).not.toBeNull();
    expect(container.querySelector('[data-testid="login-cooldown-notice"]')).toBeNull();
    expect(mockTurnstileProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'login', siteKey: 'test-site-key', resetKey: 0 })
    );
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(
      true
    );

    act(() => challenge.click());
    submit(form);
    await flushPromises();
    expect(mockLogin).toHaveBeenLastCalledWith(
      expect.objectContaining({ turnstileToken: 'fresh-login-proof' })
    );
    expect(mockTurnstileProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'login', resetKey: 1 })
    );
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(
      true
    );

    const freshChallenge = container.querySelector(
      '[data-testid="login-turnstile"]'
    ) as HTMLButtonElement;
    act(() => freshChallenge.click());
    submit(form);
    await flushPromises();
    expect(mockTurnstileProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'login', resetKey: 2 })
    );
    expect(container.querySelector('[data-testid="login-turnstile"]')).not.toBeNull();
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('enforces Retry-After before permitting a fresh challenged submission', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-14T12:00:00Z'));
    const form = container.querySelector('form') as HTMLFormElement;
    fillCredentials();
    mockLogin.mockRejectedValueOnce({
      success: false,
      status: 429,
      errorCode: 'LOGIN_RATE_LIMITED',
      challengeRequired: true,
      retryAfterSeconds: 2,
    });

    submit(form);
    await flushPromises();
    const challenge = container.querySelector(
      '[data-testid="login-turnstile"]'
    ) as HTMLButtonElement;
    act(() => challenge.click());
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(container.textContent).toContain('Try again in 2 s.');
    expect(container.querySelector('[data-testid="login-cooldown-notice"]')).toBeNull();

    submit(form);
    expect(mockLogin).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(2100);
    });
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('drops a stored session if post-login user loading fails', async () => {
    const form = container.querySelector('form') as HTMLFormElement;
    fillCredentials();
    mockLogin.mockResolvedValue({
      success: true,
      message: 'Signed in.',
      data: { sessionToken: 'orphan-session-token' },
    });
    mockGetCurrentUser.mockRejectedValueOnce(new Error('request failed'));

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(resolve => window.setTimeout(resolve, 0));
    });

    expect(localStorage.getItem('sessionToken')).toBeNull();
    expect(mockNavigateAfterAuth).not.toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledWith(
      'Login is temporarily unavailable. Please try again later.',
      'error'
    );
  });

  it('drops a stored session if post-login user loading is unsuccessful', async () => {
    const form = container.querySelector('form') as HTMLFormElement;
    fillCredentials();
    mockLogin.mockResolvedValue({
      success: true,
      message: 'Signed in.',
      data: { sessionToken: 'temporary-session-token' },
    });
    mockGetCurrentUser.mockResolvedValueOnce({ success: false });

    submit(form);
    await flushPromises();

    expect(localStorage.getItem('sessionToken')).toBeNull();
    expect(mockNavigateAfterAuth).not.toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledWith(
      'Login is temporarily unavailable. Please try again later.',
      'error'
    );
  });

  it('explains an expired session and returns to the previous safe route after login', async () => {
    act(() => root.unmount());
    mockLocationSearch =
      '?t=tenant-a&reason=session_expired&returnTo=%2Fviewer%3FStudyInstanceUIDs%3D1.2.3';
    root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(LoginPage));
    });
    await flushPromises();

    expect(mockShowAlert).toHaveBeenCalledWith(
      'Your session expired. Please sign in again.',
      'error'
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      {
        pathname: '/login',
        search: '?t=tenant-a&returnTo=%2Fviewer%3FStudyInstanceUIDs%3D1.2.3',
      },
      { replace: true }
    );

    fillCredentials();
    mockLogin.mockResolvedValueOnce({
      success: true,
      message: 'Signed in.',
      data: { sessionToken: 'renewed-session-token' },
    });
    mockGetCurrentUser.mockResolvedValueOnce({
      success: true,
      data: { id: 'user-a', tenantId: 'tenant-a' },
    });

    submit(container.querySelector('form') as HTMLFormElement);
    await flushPromises();

    expect(mockNavigateAfterAuth).toHaveBeenCalledWith(
      mockNavigate,
      expect.objectContaining({ id: 'user-a', tenantId: 'tenant-a' }),
      '/viewer?StudyInstanceUIDs=1.2.3'
    );
  });
});

describe('LoginPage when the login challenge cannot be used', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  const renderLogin = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(LoginPage));
    });
    await flushPromises();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAPIInfo.mockReset();
    mockGetCurrentUser.mockReset();
    mockGetPublicTenant.mockReset();
    mockLogin.mockReset();
    mockLocationSearch = '?t=tenant-a';
    mockTurnstileStatus = null;
    delete process.env.APP_PUBLIC_TURNSTILE_SITE_KEY;
    localStorage.clear();
    mockGetPublicTenant.mockResolvedValue({ data: { id: 'tenant-a', name: 'Tenant A' } });
    mockGetAPIInfo.mockResolvedValue({ data: { version: 'test-api' } });
    mockGetCurrentUser.mockResolvedValue({ success: false });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    jest.useRealTimers();
    restoreTurnstileSiteKey();
  });

  const fillCredentials = () => {
    setInputValue(container.querySelector('#email') as HTMLInputElement, 'visitor@example.org');
    setInputValue(container.querySelector('#password') as HTMLInputElement, testCredential);
  };
  const submitButton = () => container.querySelector('button[type="submit"]') as HTMLButtonElement;
  const notice = () => container.querySelector('[data-testid="login-cooldown-notice"]');

  it('hints that attempts are limited after the first rejected password', async () => {
    await renderLogin();
    fillCredentials();
    expect(container.querySelector('[data-testid="login-attempt-limit-hint"]')).toBeNull();
    mockLogin.mockRejectedValueOnce({
      success: false,
      status: 401,
      errorCode: 'UNAUTHORIZED_ACCESS',
      challengeRequired: false,
    });

    submit(container.querySelector('form') as HTMLFormElement);
    await flushPromises();

    expect(mockShowAlert).toHaveBeenLastCalledWith('Invalid email or password', 'error');
    expect(container.querySelector('[data-testid="login-attempt-limit-hint"]')?.textContent).toBe(
      'For security, the number of sign-in attempts is limited.'
    );
    expect(container.textContent).not.toMatch(/\d+ (attempts?|tentatives?) remaining/);
    expect(submitButton().disabled).toBe(false);
  });

  it('explains the pause instead of a dead verification widget when no site key is built in', async () => {
    await renderLogin();
    fillCredentials();
    mockLogin.mockRejectedValue({
      success: false,
      status: 403,
      errorCode: 'LOGIN_CHALLENGE_REQUIRED',
      challengeRequired: true,
    });

    submit(container.querySelector('form') as HTMLFormElement);
    await flushPromises();

    expect(container.querySelector('[data-testid="login-turnstile"]')).toBeNull();
    expect(container.textContent).not.toContain('Login verification is unavailable');
    expect(notice()?.textContent).toContain('Too many failed sign-in attempts.');
    expect(notice()?.textContent).toContain('Wait a few minutes, then try again.');
    expect(mockShowAlert).toHaveBeenLastCalledWith(
      'Too many failed sign-in attempts. Please wait a few minutes before trying again.',
      'error'
    );
    expect(submitButton().disabled).toBe(false);

    // A later attempt is sent (without a token) so the server decides when the window ended.
    submit(container.querySelector('form') as HTMLFormElement);
    await flushPromises();
    expect(mockLogin).toHaveBeenCalledTimes(2);
    expect(mockLogin).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ turnstileToken: expect.anything() })
    );

    const forgot = Array.from(notice()?.querySelectorAll('button') || []).find(button =>
      button.textContent?.includes('Forgot your password?')
    ) as HTMLButtonElement;
    act(() => forgot.click());
    expect(container.textContent).toContain('To reset your password');
  });

  it('counts a 429 Retry-After down in minutes and re-enables sign-in afterwards', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-16T09:00:00Z'));
    await renderLogin();
    fillCredentials();
    mockLogin.mockRejectedValueOnce({
      success: false,
      status: 429,
      errorCode: 'LOGIN_RATE_LIMITED',
      challengeRequired: true,
      retryAfterSeconds: 580,
    });

    submit(container.querySelector('form') as HTMLFormElement);
    await flushPromises();

    expect(notice()?.textContent).toContain('Try again in about 10 min.');
    expect(container.textContent).toContain(
      'Login is temporarily limited. Try again in 9 min 40 s.'
    );
    expect(mockShowAlert).toHaveBeenLastCalledWith(
      'Too many login attempts. Please wait 9 min 40 s before trying again.',
      'error'
    );
    expect(submitButton().disabled).toBe(true);
    submit(container.querySelector('form') as HTMLFormElement);
    expect(mockLogin).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(530_000);
    });
    expect(container.textContent).toContain('Try again in 50 s.');
    expect(notice()?.textContent).toContain('Try again in less than a minute.');

    await act(async () => {
      jest.advanceTimersByTime(51_000);
    });
    expect(notice()).toBeNull();
    expect(container.querySelector('[data-testid="login-turnstile"]')).toBeNull();
    expect(submitButton().disabled).toBe(false);
  });

  it('falls back when the configured widget cannot load', async () => {
    process.env.APP_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key';
    mockTurnstileStatus = 'unavailable';
    await renderLogin();
    fillCredentials();
    mockLogin.mockRejectedValueOnce({
      success: false,
      status: 401,
      errorCode: 'UNAUTHORIZED_ACCESS',
      challengeRequired: true,
    });

    submit(container.querySelector('form') as HTMLFormElement);
    await flushPromises();

    expect(notice()?.textContent).toContain('Too many failed sign-in attempts.');
    expect(submitButton().disabled).toBe(false);
    const widgetGroup = container.querySelector('[role="group"]') as HTMLElement;
    expect(widgetGroup.hidden).toBe(true);
  });
});

describe('LoginPage tenant lookup failures', () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalDefaultTenant = process.env.APP_PUBLIC_DEFAULT_TENANT;
  const originalLocation = window.location;
  const mockReload = jest.fn();

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: mockReload },
    });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAPIInfo.mockReset();
    mockGetCurrentUser.mockReset();
    mockGetPublicTenant.mockReset();
    mockGetAPIInfo.mockResolvedValue({ data: { version: 'test-api' } });
    mockGetCurrentUser.mockResolvedValue({ success: false });
    process.env.APP_PUBLIC_DEFAULT_TENANT = 'default-tenant';
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    jest.restoreAllMocks();
    if (originalDefaultTenant === undefined) {
      delete process.env.APP_PUBLIC_DEFAULT_TENANT;
    } else {
      process.env.APP_PUBLIC_DEFAULT_TENANT = originalDefaultTenant;
    }
  });

  const renderLogin = async () => {
    await act(async () => {
      root.render(React.createElement(LoginPage));
    });
    await flushPromises();
  };

  const findButton = (label: string) =>
    Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === label
    ) as HTMLButtonElement | undefined;

  it('shows an inline error without reloading when the API is unreachable, and retries on demand', async () => {
    mockLocationSearch = '?t=tenant-a';
    mockGetPublicTenant.mockRejectedValueOnce({
      success: false,
      message: 'Workspace lookup failed.',
      status: 502,
    });

    await renderLogin();

    expect(mockGetPublicTenant).toHaveBeenCalledTimes(1);
    expect(mockReload).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Can't reach the PACS-AI server right now."
    );
    expect(container.querySelector('form')).not.toBeNull();

    mockGetPublicTenant.mockResolvedValueOnce({
      data: { id: 'tenant-a', name: 'Tenant A', onboardingEnableRegistration: false },
    });
    const retry = findButton('Try again');
    expect(retry).toBeDefined();
    await act(async () => {
      retry?.click();
    });
    await flushPromises();

    expect(mockGetPublicTenant).toHaveBeenCalledTimes(2);
    expect(mockGetPublicTenant).toHaveBeenLastCalledWith({ tenantId: 'tenant-a' });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain('Tenant A (tenant-a)');
    expect(mockReload).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('treats network failures without a status as unreachable', async () => {
    mockLocationSearch = '?t=tenant-a';
    mockGetPublicTenant.mockRejectedValueOnce({
      success: false,
      message: 'Workspace lookup failed.',
    });

    await renderLogin();

    expect(mockReload).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Can't reach the PACS-AI server right now.");
  });

  it('redirects once to a different default tenant when the tenant does not exist', async () => {
    mockLocationSearch = '?t=unknown-tenant';
    mockGetPublicTenant.mockRejectedValue({
      success: false,
      message: 'No records found.',
      errorCode: 'MISSING_RECORD',
      status: 404,
    });

    await renderLogin();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/login', search: '?t=default-tenant' },
      { replace: true }
    );
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('shows an error instead of navigating when the default tenant itself does not exist', async () => {
    mockLocationSearch = '?t=default-tenant';
    mockGetPublicTenant.mockRejectedValue({
      success: false,
      message: 'No records found.',
      errorCode: 'MISSING_RECORD',
      status: 404,
    });

    await renderLogin();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'This workspace could not be found.'
    );
  });

  it('redirects a login link without a tenant to the default tenant without a lookup', async () => {
    mockLocationSearch = '';

    await renderLogin();

    expect(mockGetPublicTenant).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/login', search: '?t=default-tenant' },
      { replace: true }
    );
    expect(mockReload).not.toHaveBeenCalled();
  });
});
