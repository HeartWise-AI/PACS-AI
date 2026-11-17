import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';

import { useShellLocation, useShellNavigate } from './routerLocation';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function ShowLocation() {
  const location = useShellLocation();
  return <span id="where">{`${location.pathname}${location.search}`}</span>;
}

let goTo: (path: string) => void;
function Navigator() {
  const navigate = useNavigate();
  goTo = path => navigate(path);
  return null;
}

describe('router location outside the router', () => {
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

  test('follows router navigation and the back button without any bridge in the routes', () => {
    window.history.replaceState(null, '', '/settings?tab=1');
    act(() => {
      root.render(
        <>
          <ShowLocation />
          <BrowserRouter>
            <Navigator />
          </BrowserRouter>
        </>
      );
    });
    expect(container.querySelector('#where').textContent).toBe('/settings?tab=1');

    act(() => goTo('/viewer?StudyInstanceUIDs=1'));
    expect(container.querySelector('#where').textContent).toBe('/viewer?StudyInstanceUIDs=1');

    act(() => {
      window.history.pushState(null, '', '/local');
    });
    expect(container.querySelector('#where').textContent).toBe('/local');

    act(() => {
      window.history.replaceState(null, '', '/ai-predictions');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(container.querySelector('#where').textContent).toBe('/ai-predictions');
  });

  test('navigates outside the router with a page load', () => {
    const navigate = useShellNavigate();
    const assign = jest.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } });

    navigate('/login?t=1');

    expect(assign).toHaveBeenCalledWith('/login?t=1');
    expect(useShellNavigate()).toBe(navigate);
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});
