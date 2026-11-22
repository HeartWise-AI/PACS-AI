import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import RegistrationPolicyLinks from './RegistrationPolicyLinks';
import type { RegistrationPolicyPair } from './registrationPolicies';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const policies: RegistrationPolicyPair = {
  terms: {
    policyKey: 'TERMS_OF_SERVICE',
    version: 'v1',
    title: 'Terms of Service',
    url: 'https://policies.example.test/terms',
    effectiveAt: '2026-08-15',
    acceptanceAction: 'AGREE',
    required: true,
  },
  privacy: {
    policyKey: 'PRIVACY_POLICY',
    version: 'v1',
    title: 'Privacy Policy',
    url: 'https://policies.example.test/privacy',
    effectiveAt: '2026-08-15',
    acceptanceAction: 'ACKNOWLEDGE',
    required: true,
  },
  acceptances: [
    { policyKey: 'TERMS_OF_SERVICE', version: 'v1' },
    { policyKey: 'PRIVACY_POLICY', version: 'v1' },
  ],
};

describe('RegistrationPolicyLinks', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders one unchecked accessible control and two safe policy links', () => {
    act(() => {
      root.render(
        React.createElement(RegistrationPolicyLinks, {
          policies,
          status: 'ready',
          accepted: false,
          onAcceptedChange: jest.fn(),
          onRetry: jest.fn(),
        })
      );
    });

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const links = Array.from(container.querySelectorAll('a'));
    expect(checkbox.checked).toBe(false);
    expect(checkbox.getAttribute('aria-label')).toBe(
      'I agree to the Terms of Service and acknowledge the Privacy Policy.'
    );
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('https://policies.example.test/terms');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[0].getAttribute('aria-label')).toBe('Terms of Service (opens in a new tab)');
    expect(links[1].getAttribute('aria-label')).toBe('Privacy Policy (opens in a new tab)');
  });

  it('reports checkbox changes through the controlled callback', () => {
    const onAcceptedChange = jest.fn();
    act(() => {
      root.render(
        React.createElement(RegistrationPolicyLinks, {
          policies,
          status: 'ready',
          accepted: false,
          onAcceptedChange,
          onRetry: jest.fn(),
        })
      );
    });
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

    act(() => {
      checkbox.click();
    });

    expect(onAcceptedChange).toHaveBeenCalledWith(true);
  });

  it('fails closed with an actionable retry when policies cannot load', () => {
    const onRetry = jest.fn();
    act(() => {
      root.render(
        React.createElement(RegistrationPolicyLinks, {
          policies: null,
          status: 'error',
          accepted: false,
          onAcceptedChange: jest.fn(),
          onRetry,
        })
      );
    });

    expect(container.querySelector('input')).toBeNull();
    const retry = container.querySelector('button') as HTMLButtonElement;
    act(() => retry.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
