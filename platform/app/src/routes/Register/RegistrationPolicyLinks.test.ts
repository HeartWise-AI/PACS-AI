import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import RegistrationPolicyLinks from './RegistrationPolicyLinks';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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

  it('renders configured policy documents as safe, accessible links', () => {
    act(() => {
      root.render(
        React.createElement(RegistrationPolicyLinks, {
          termsOfUseUrl: 'https://policies.example.test/terms',
          privacyPolicyUrl: 'https://policies.example.test/privacy',
        })
      );
    });

    const links = Array.from(container.querySelectorAll('a'));
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('https://policies.example.test/terms');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[0].getAttribute('aria-label')).toBe('Terms of Use (opens in a new tab)');
    expect(links[1].getAttribute('aria-label')).toBe('Privacy Policy (opens in a new tab)');
  });

  it('renders nothing until a policy document URL is configured', () => {
    act(() => {
      root.render(
        React.createElement(RegistrationPolicyLinks, {
          termsOfUseUrl: null,
          privacyPolicyUrl: null,
        })
      );
    });

    expect(container.children).toHaveLength(0);
  });
});
