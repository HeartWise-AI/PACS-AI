import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const page = name => () => <div id="page">{name}</div>;
jest.mock('../worklist', () => page('worklist'));
jest.mock('./Login', () => page('login'));
jest.mock('./Register', () => page('register'));
jest.mock('./PolicyAcceptance', () => page('policy'));
jest.mock('./User/Consent', () => page('consent'));
jest.mock('./ChangePassword', () => page('change-password'));
jest.mock('./ResetPassword', () => page('reset-password'));
jest.mock('./AIModels', () => page('ai-models'));
jest.mock('./AiPredictions', () => page('ai-predictions'));
jest.mock('./Members', () => page('members'));
jest.mock('./KibanaLogs', () => page('kibana'));
jest.mock('./Settings', () => () => {
  throw new Error('settings failed');
});
jest.mock('./TenantNotFound', () => page('tenant-not-found'));
jest.mock('./WorkspaceSettings', () => page('workspace-settings'));

import { getPacsAiNotFoundRoute, getPacsAiRoutes } from './pacsAiRoutes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('PACS-AI custom routes', () => {
  test('cover the pages the fork added to OHIF routes, at the same paths', () => {
    const routes = getPacsAiRoutes();
    expect(routes.map(route => [route.path, route.private])).toEqual([
      ['/', true],
      ['/login', true],
      ['/register', true],
      ['/policies/accept', true],
      ['/user/consent', true],
      ['/change-password', true],
      ['/reset-password', true],
      ['/ai-models', true],
      ['/ai-predictions', true],
      ['/admin/members', true],
      ['/admin/workspace-settings', true],
      ['/admin/kibana-logs', true],
      ['/settings', true],
      ['/tenantnotfound', false],
      ['/notfoundstudy', false],
    ]);
  });

  describe('route elements', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    const renderRoute = (path: string) => {
      const route = getPacsAiRoutes().find(candidate => candidate.path === path);
      const Element = route.children;
      act(() => {
        root.render(
          <MemoryRouter initialEntries={[path]}>
            <Element />
          </MemoryRouter>
        );
      });
    };

    test('render their page', () => {
      renderRoute('/ai-predictions');
      expect(container.querySelector('#page').textContent).toBe('ai-predictions');
    });

    test('keep a failing page inside our own error boundary, with a visible message', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      renderRoute('/settings');
      expect(container.querySelector('[data-testid="pacs-ai-error-fallback"]')).not.toBeNull();
      expect(container.textContent).toContain('settings failed');
      error.mockRestore();
    });

    test('link the not-found page back to the work list', () => {
      const route = getPacsAiNotFoundRoute();
      expect(route.path).toBe('*');
      expect(route.private).toBe(false);
      const Element = route.children;
      act(() => {
        root.render(
          <MemoryRouter initialEntries={['/no-such-page']}>
            <Element />
          </MemoryRouter>
        );
      });
      expect(container.querySelector('a').getAttribute('href')).toBe('/');
      expect(container.textContent).toContain('Error (404)');
    });

    // The order OHIF 3.13's routes/index.tsx builds (mode routes, OHIF's study
    // list only when showStudyList is on, custom routes, built-in routes,
    // notFoundRoute last); React Router ranks by path, so `*` never wins over
    // a page and our `/` is served with showStudyList off.
    const renderApp = (path: string) => {
      const allRoutes = [
        { path: '/viewer', children: page('viewer') },
        ...getPacsAiRoutes(),
        { path: '/local', children: page('local') },
        getPacsAiNotFoundRoute(),
      ];
      act(() => {
        root.render(
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              {allRoutes.map(({ path: routePath, children: Element }, i) => (
                <Route
                  key={i}
                  path={routePath}
                  element={<Element />}
                />
              ))}
            </Routes>
          </MemoryRouter>
        );
      });
    };

    test.each([
      ['/', 'worklist'],
      ['/viewer', 'viewer'],
      ['/ai-predictions', 'ai-predictions'],
      ['/local', 'local'],
    ])('serve %s with its page, not the not-found route', (path, expected) => {
      renderApp(path);
      expect(container.querySelector('#page').textContent).toBe(expected);
    });

    test('serve unknown paths with the not-found page', () => {
      renderApp('/no-such-page');
      expect(container.querySelector('#page')).toBeNull();
      expect(container.textContent).toContain('Error (404)');
    });

    test('link the study-not-found page back to the work list', () => {
      renderRoute('/notfoundstudy');
      const link = container.querySelector('a');
      expect(link.getAttribute('href')).toBe('/');
      expect(container.textContent).toContain(
        'One or more of the requested studies are not available at this time.'
      );
    });
  });
});
