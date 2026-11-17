import React, { useContext } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AlertContext, AlertProvider } from './AlertProvider';

describe('AlertProvider', () => {
  test('keeps the alert callback stable when alert state changes', () => {
    const observedCallbacks: unknown[] = [];

    function Consumer() {
      const showAlert = useContext(AlertContext);
      observedCallbacks.push(showAlert);
      return React.createElement('button', {
        onClick: () => showAlert('Member updated.', 'success'),
      });
    }

    const renderer = TestRenderer.create(
      React.createElement(AlertProvider, null, React.createElement(Consumer))
    );
    const initialCallback = observedCallbacks.at(-1);

    act(() => renderer.root.findByType('button').props.onClick());

    expect(observedCallbacks.at(-1)).toBe(initialCallback);
  });
});
