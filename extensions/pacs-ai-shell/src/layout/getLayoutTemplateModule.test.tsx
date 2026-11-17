import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

jest.mock('@ohif/ui-next', () => {
  const ReactActual = jest.requireActual('react');
  class MockErrorBoundary extends ReactActual.Component<any, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    componentDidCatch() {}
    render() {
      const Fallback = this.props.fallbackComponent;
      return this.state.failed ? <Fallback /> : this.props.children;
    }
  }
  return { ErrorBoundary: MockErrorBoundary };
});
jest.mock('./PacsAiViewerLayout', () => () => {
  throw new Error('layout failed while rendering');
});

import getLayoutTemplateModule from './getLayoutTemplateModule';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('viewer layout template', () => {
  test("keeps an error in the layout's own render inside our (silent) error boundary", () => {
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

    expect(container.innerHTML).toBe('');
    act(() => root.unmount());
    error.mockRestore();
  });
});
