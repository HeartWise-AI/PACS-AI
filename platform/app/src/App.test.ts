import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from './App';
import appInit from './appInit.js';

function mockPassthrough({ children }) {
  return React.createElement(React.Fragment, null, children);
}

function mockMarker(name) {
  return ({ children }) => React.createElement('div', { [`data-${name}`]: 'true' }, children);
}

jest.mock('./appInit.js', () => jest.fn());
jest.mock('./routes', () => {
  const React = require('react');
  return jest.fn(() => React.createElement('div', { 'data-app-routes': 'true' }));
});
jest.mock(
  './routes/Mode/Compose',
  () =>
    ({ children }) =>
      children
);
jest.mock('./utils/OpenIdConnectRoutes', () => mockPassthrough);
jest.mock('@ohif/i18n', () => ({}), { virtual: true });
jest.mock('react-i18next', () => ({ I18nextProvider: mockPassthrough }));
jest.mock(
  'react-query',
  () => ({
    QueryClient: jest.fn(),
    QueryClientProvider: mockMarker('query-client-provider'),
  }),
  { virtual: true }
);
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children, basename, future }) => {
    const React = require('react');
    return React.createElement(
      'div',
      {
        'data-browser-router': 'true',
        'data-basename': basename,
        'data-start-transition': String(future?.v7_startTransition),
        'data-relative-splat-path': String(future?.v7_relativeSplatPath),
      },
      children
    );
  },
}));
jest.mock(
  '@ohif/core',
  () => ({
    SystemContextProvider: mockPassthrough,
    ViewportRefsProvider: mockPassthrough,
  }),
  { virtual: true }
);
jest.mock(
  '@ohif/ui-next',
  () => ({
    ThemeWrapper: mockPassthrough,
    NotificationProvider: mockPassthrough,
    ViewportGridProvider: mockPassthrough,
    DialogProvider: mockPassthrough,
    CineProvider: mockPassthrough,
    TooltipProvider: mockPassthrough,
    Modal: mockPassthrough,
    ManagedDialog: mockPassthrough,
    ModalProvider: mockPassthrough,
    ViewportDialogProvider: mockPassthrough,
    UserAuthenticationProvider: mockPassthrough,
  }),
  { virtual: true }
);
jest.mock('@state', () => ({ AppConfigProvider: mockPassthrough }), { virtual: true });
jest.mock('react-shepherd', () => ({ ShepherdJourneyProvider: mockPassthrough }), {
  virtual: true,
});
jest.mock('./AlertProvider', () => ({ AlertProvider: mockMarker('alert-provider') }));
jest.mock('./GlobalStateProvider', () => ({
  GlobalStateProvider: mockMarker('global-state-provider'),
}));
jest.mock('./components/TutorialProgressOverlay', () => mockMarker('tutorial-overlay'));
jest.mock('./components/inference/InferenceProcessingProvider', () =>
  mockMarker('inference-processing-provider')
);
jest.mock('./components/inference/studyProcessing/StudyProcessingProvider', () => ({
  __esModule: true,
  default: mockMarker('study-processing-provider'),
}));

describe('App integration contract', () => {
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
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    (appInit as jest.Mock).mockResolvedValue({
      appConfig: {
        routerBasename: '/pacs',
        modes: [],
        dataSources: [],
        oidc: null,
        showStudyList: true,
      },
      commandsManager: {},
      extensionManager: {},
      hotkeysManager: {},
      serviceProvidersManager: { providers: {} },
      servicesManager: {
        services: {
          uiDialogService: {},
          uiModalService: {},
          uiViewportDialogService: {},
          viewportGridService: {},
          cineService: {},
          userAuthenticationService: {},
          uiNotificationService: {},
          customizationService: { init: jest.fn() },
        },
      },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('keeps PACS providers around the router with the OHIF 3.12 future flags', async () => {
    await act(async () => {
      root.render(
        React.createElement(App, {
          config: { routerBasename: '/pacs', oidc: [], extensions: [] },
        })
      );
      await Promise.resolve();
    });

    const router = container.querySelector('[data-browser-router="true"]');
    expect(router).not.toBeNull();
    expect(router?.getAttribute('data-basename')).toBe('/pacs');
    expect(router?.getAttribute('data-start-transition')).toBe('true');
    expect(router?.getAttribute('data-relative-splat-path')).toBe('true');
    expect(container.querySelector('[data-alert-provider="true"]')).not.toBeNull();
    expect(container.querySelector('[data-global-state-provider="true"]')).not.toBeNull();
    expect(container.querySelector('[data-study-processing-provider="true"]')).not.toBeNull();
    expect(container.querySelector('[data-inference-processing-provider="true"]')).not.toBeNull();
    expect(container.querySelector('[data-tutorial-overlay="true"]')).not.toBeNull();
  });
});
