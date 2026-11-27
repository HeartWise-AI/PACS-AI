import React from 'react';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react';
import WebappOutputModeModal from './WebappOutputModeModal';
import { HTML_REPORT_IFRAME_SANDBOX, WEBAPP_IFRAME_SANDBOX } from './htmlReport';

jest.mock('./AddModelFeedback', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./assets/icons/close-inactive.png', () => 'close.png');

function sandboxTokens(value: string | null): string[] {
  return (value ?? '').split(/\s+/).filter(Boolean);
}

describe('WebappOutputModeModal', () => {
  let rendered: RenderResult | null = null;

  afterEach(() => {
    rendered?.unmount();
    rendered = null;
  });

  test('frames the model web app in an opaque-origin sandbox', async () => {
    await act(async () => {
      rendered = render(
        <WebappOutputModeModal
          isOpen
          onClose={() => {}}
          data={{ webappPath: '/app/viewer/', webappDataBase64: 'placeholder-output' }}
          loading={false}
          title="Example model"
          containerName="example-model"
        />
      );
    });

    const iframe = document.body.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('src')).toContain(
      '/proxy/docker-inference/example-model/app/viewer/'
    );
    const tokens = sandboxTokens(iframe.getAttribute('sandbox'));
    expect(iframe.getAttribute('sandbox')).toBe(WEBAPP_IFRAME_SANDBOX);
    expect(tokens).toEqual(expect.arrayContaining(sandboxTokens(HTML_REPORT_IFRAME_SANDBOX)));
    for (const unsafe of [
      'allow-same-origin',
      'allow-top-navigation',
      'allow-top-navigation-by-user-activation',
      'allow-popups-to-escape-sandbox',
    ]) {
      expect(tokens).not.toContain(unsafe);
    }
  });

  test('posts the model output to the frame that loaded', async () => {
    await act(async () => {
      rendered = render(
        <WebappOutputModeModal
          isOpen
          onClose={() => {}}
          data={{ webappPath: '/app/viewer/', webappDataBase64: 'placeholder-output' }}
          loading={false}
          title="Example model"
          containerName="example-model"
        />
      );
    });

    const iframe = document.body.querySelector('iframe') as HTMLIFrameElement;
    const postMessage = jest.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage }, configurable: true });
    fireEvent.load(iframe);

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: 'data', text: 'placeholder-output' }, '*');
  });
});
