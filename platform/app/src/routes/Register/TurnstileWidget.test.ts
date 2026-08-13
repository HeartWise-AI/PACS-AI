import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import TurnstileWidget from './TurnstileWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('TurnstileWidget', () => {
  let container: HTMLDivElement;
  let root: Root;
  let renderOptions: Record<string, unknown>;
  const remove = jest.fn();

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
    renderOptions = {};
    window.turnstile = {
      render: jest.fn((_element, options) => {
        renderOptions = options as unknown as Record<string, unknown>;
        return 'widget-id';
      }),
      remove,
    };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete window.turnstile;
    remove.mockReset();
  });

  it('renders with the public site key and returns the generated proof', async () => {
    const onTokenChange = jest.fn();

    await act(async () => {
      root.render(
        React.createElement(TurnstileWidget, {
          siteKey: 'public-site-key',
          resetKey: 0,
          onTokenChange,
        })
      );
    });

    expect(window.turnstile?.render).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({
        sitekey: 'public-site-key',
        action: 'register',
      })
    );

    act(() => {
      (renderOptions.callback as (token: string) => void)('turnstile-proof');
    });

    expect(onTokenChange).toHaveBeenLastCalledWith('turnstile-proof');
  });

  it('clears the proof and announces challenge failures', async () => {
    const onTokenChange = jest.fn();

    await act(async () => {
      root.render(
        React.createElement(TurnstileWidget, {
          siteKey: 'public-site-key',
          resetKey: 0,
          onTokenChange,
        })
      );
    });

    act(() => {
      (renderOptions['error-callback'] as () => boolean)();
    });

    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Registration verification failed. Please try again.'
    );
  });

  it('does not render when the public site key is missing', async () => {
    const onTokenChange = jest.fn();

    await act(async () => {
      root.render(
        React.createElement(TurnstileWidget, {
          siteKey: '',
          resetKey: 0,
          onTokenChange,
        })
      );
    });

    expect(window.turnstile?.render).not.toHaveBeenCalled();
    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Registration verification is unavailable. Please try again later.'
    );
  });
});
