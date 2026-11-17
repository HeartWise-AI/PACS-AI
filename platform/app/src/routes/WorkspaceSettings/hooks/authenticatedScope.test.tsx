import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { getAuthenticatedScope, useAuthenticatedScope } from './authenticatedScope';
let value: ReturnType<typeof useAuthenticatedScope>;
function Consumer() {
  value = useAuthenticatedScope();
  return <span>{value.key}</span>;
}
test('direct scope checks cannot consume a session-change notification', () => {
  jest.useFakeTimers();
  localStorage.setItem('tenantId', 'tenant-a');
  localStorage.setItem('sessionToken', 'secret-a');
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Consumer />);
  });
  const oldScope = value.key;
  localStorage.setItem('sessionToken', 'secret-b');
  const direct = getAuthenticatedScope();
  expect(direct.key).not.toBe(oldScope);
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'sessionToken' }));
  });
  expect(value.key).toBe(direct.key);
  localStorage.setItem('tenantId', 'tenant-b');
  localStorage.setItem('sessionToken', 'secret-c');
  const next = getAuthenticatedScope();
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(value).toEqual(next);
  expect(value.tenantId).toBe('tenant-b');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('secret');
  act(() => renderer.unmount());
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
