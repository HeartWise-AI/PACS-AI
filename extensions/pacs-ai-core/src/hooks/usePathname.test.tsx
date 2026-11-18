import { act, renderHook } from '@testing-library/react';
import usePathname from './usePathname';

describe('usePathname', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  test('follows pushState, replaceState and back/forward navigation', () => {
    const { result } = renderHook(() => usePathname());
    expect(result.current).toBe('/');

    act(() => window.history.pushState(null, '', '/viewer'));
    expect(result.current).toBe('/viewer');

    act(() => window.history.replaceState(null, '', '/settings'));
    expect(result.current).toBe('/settings');

    act(() => {
      window.history.replaceState(null, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current).toBe('/login');
  });
});
