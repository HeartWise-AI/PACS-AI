import React, { useContext } from 'react';
import { fireEvent, render } from '@testing-library/react';
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

    const { container } = render(
      React.createElement(AlertProvider, null, React.createElement(Consumer))
    );
    const initialCallback = observedCallbacks.at(-1);

    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);

    expect(observedCallbacks.at(-1)).toBe(initialCallback);
  });
});
