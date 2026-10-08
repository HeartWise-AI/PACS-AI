import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import createRoutes from './index';

jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    Routes: ({ children }) => React.createElement('div', null, children),
    Route: ({ path, element }) =>
      React.createElement('div', { 'data-route-path': path || '(missing)' }, path ? element : null),
    Link: ({ children, ...props }) => React.createElement('a', props, children),
    useNavigate: () => jest.fn(),
  };
});

jest.mock('@ohif/ui-next', () => {
  const React = require('react');
  return {
    ErrorBoundary: ({ children, showNotification }) =>
      React.createElement(
        'div',
        { 'data-show-notification': String(showNotification) },
        children
      ),
  };
});

jest.mock('@state', () => ({ useAppConfig: () => [{ showErrorDetails: false }] }), {
  virtual: true,
});

jest.mock('./DataSourceWrapper', () => () => null);
jest.mock('./WorkList', () => () => null);
jest.mock('./Login', () => () => null);
jest.mock('./Register', () => () => null);
jest.mock('./PolicyAcceptance', () => () => null);
jest.mock('./User/Consent', () => () => null);
jest.mock('./ChangePassword', () => () => null);
jest.mock('./ResetPassword', () => () => null);
jest.mock('./Local', () => () => null);
jest.mock('./Debug', () => () => null);
jest.mock('./NotFound', () => () => null);
jest.mock('./Members', () => () => null);
jest.mock('./KibanaLogs', () => () => null);
jest.mock('./AIModels', () => () => null);
jest.mock('./Settings', () => () => null);
jest.mock('./TenantNotFound', () => () => null);
jest.mock('./WorkspaceSettings', () => () => null);
jest.mock('./buildModeRoutes', () => jest.fn(() => []));
jest.mock('./PrivateRoute', () => ({ children }) => children);
jest.mock('../utils/publicUrl', () => ({ routerBasename: '/' }));
jest.mock('../utils/history', () => ({ history: {} }));

describe('PACS-AI route registration contract', () => {
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

  it('registers the PACS account, administration, and model routes behind authentication', () => {
    const servicesManager = {
      services: {
        customizationService: { getCustomization: jest.fn(() => undefined) },
        userAuthenticationService: { handleUnauthenticated: jest.fn() },
      },
    };

    act(() => {
      root.render(
        createRoutes({
          modes: [],
          dataSources: [],
          extensionManager: {},
          servicesManager,
          commandsManager: {},
          hotkeysManager: {},
          showStudyList: true,
        })
      );
    });

    const registeredPaths = Array.from(container.querySelectorAll('[data-route-path]')).map(
      element => element.getAttribute('data-route-path')
    );
    expect(registeredPaths).toEqual(
      expect.arrayContaining([
        '/',
        '/login',
        '/register',
        '/policies/accept',
        '/user/consent',
        '/change-password',
        '/reset-password',
        '/ai-models',
        '/admin/members',
        '/admin/kibana-logs',
        '/admin/workspace-settings',
        '/settings',
      ])
    );
    expect(container.querySelectorAll('[data-show-notification="false"]').length).toBeGreaterThan(
      0
    );
  });
});
