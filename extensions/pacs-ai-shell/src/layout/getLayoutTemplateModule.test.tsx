import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

jest.mock('./PacsAiViewerLayout', () => () => {
  throw new Error('layout failed while rendering');
});

import getLayoutTemplateModule from './getLayoutTemplateModule';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('viewer layout template', () => {
  test("keeps an error in the layout's own render inside our error boundary, with a visible message", () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const [{ component: Layout }] = getLayoutTemplateModule({
      servicesManager: {},
      extensionManager: {},
      commandsManager: {},
      hotkeysManager: {},
    });
    const container = document.createElement('div');
    const root: Root = createRoot(container);

    expect(() =>
      act(() => {
        root.render(<Layout viewports={[]} />);
      })
    ).not.toThrow();

    // Not a blank page: the message, the error and the way out are shown.
    expect(container.querySelector('[data-testid="pacs-ai-error-fallback"]')).not.toBeNull();
    expect(container.textContent).toContain('layout failed while rendering');
    expect(container.querySelector('[data-testid="pacs-ai-error-fallback-studies"]')).not.toBeNull();
    act(() => root.unmount());
    error.mockRestore();
  });
});
