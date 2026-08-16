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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values: Record<string, unknown> = {}) =>
      key.replace('{{seconds}}', String(values.seconds ?? '')),
  }),
}));

jest.mock('react-router', () => ({
  useLocation: () => ({ search: '?t=tenant-a&code=invite-code&email=invited%40example.org' }),
  useNavigate: () => mockNavigate,
}));

jest.mock(
  '@ohif/ui',
  () => {
    const React = require('react');
    return {
      Button: ({ children, ...props }) => React.createElement('button', props, children),
      Logo: () => React.createElement('div', { 'data-testid': 'logo' }),
      Typography: ({ children, component = 'div', variant, ...props }) => {
        void variant;
        return React.createElement(component, props, children);
      },
    };
  },
  { virtual: true }
);

jest.mock(
  '@ohif/ui-next',
  () => {
    const React = require('react');
    return {
      Input: props => React.createElement('input', props),
    };
  },
  { virtual: true }
);

jest.mock('../../App', () => {
  const React = require('react');
  return { FrontendVersionContext: React.createContext('test-version') };
});

jest.mock('../../AlertProvider', () => {
  const React = require('react');
  return { AlertContext: React.createContext((...args) => mockShowAlert(...args)) };
});

jest.mock('../../api/userRepository', () => ({
  __esModule: true,
  default: {
    ForgotPassword: jest.fn(),
    GetCurrentUser: (...args) => mockGetCurrentUser(...args),
    Login: (...args) => mockLogin(...args),
    VerifyEmail: jest.fn(),
  },
}));

jest.mock('../../api/tenantRepository', () => ({
  __esModule: true,
  default: {
    GetPublicTenantByID: (...args) => mockGetPublicTenant(...args),
  },
}));

jest.mock('../../api/repository', () => ({
  __esModule: true,
  default: {
    GetAPIInfo: (...args) => mockGetAPIInfo(...args),
  },
}));

jest.mock('../../service/userService', () => ({
  logoutUser: jest.fn(),
  navigateAfterAuth: (...args) => mockNavigateAfterAuth(...args),
}));

jest.mock('../../service/accountAccessSession', () => ({
  consumeAccountSuspendedRedirect: () => ({ suspended: false, nextSearch: '' }),
}));

jest.mock('../../components/auth/TurnstileWidget', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: props => {
      mockTurnstileProps(props);
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
      expect.objectContaining({ id: 'user-a', tenantId: 'tenant-a' })
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
    expect(mockTurnstileProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'login', resetKey: 0 })
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
    expect(container.textContent).toContain('Try again in 2 seconds.');

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
});
