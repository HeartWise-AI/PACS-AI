import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import HotkeysManager from '@ohif/core/src/classes/HotkeysManager';
import { InputArea } from './InputArea';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

// The viewer's real hotkeys (OHIF HotkeysManager on Mousetrap, bound on
// document): no command runs for keys typed in the chat input, and the same
// keys still run their command when pressed on the viewport.
describe('viewer hotkeys and the chat input', () => {
  let hotkeysManager: any;
  let commandsManager: { runCommand: jest.Mock };
  let viewport: HTMLDivElement;

  const press = (target: Element, key: string) => {
    const code = key.toUpperCase().charCodeAt(0);
    fireEvent.keyDown(target, { key, keyCode: code, which: code });
    fireEvent.keyPress(target, { key, keyCode: key.charCodeAt(0), which: key.charCodeAt(0), charCode: key.charCodeAt(0) });
    fireEvent.keyUp(target, { key, keyCode: code, which: code });
  };

  beforeEach(() => {
    localStorage.clear();
    commandsManager = { runCommand: jest.fn() };
    hotkeysManager = new HotkeysManager(commandsManager as any, {} as any);
    hotkeysManager.setDefaultHotKeys([
      { commandName: 'setToolActive', commandOptions: { toolName: 'Zoom' }, keys: ['z'] },
      { commandName: 'invertViewport', keys: ['i'] },
    ]);
    viewport = document.createElement('div');
    viewport.tabIndex = 0;
    document.body.appendChild(viewport);
  });

  afterEach(() => {
    hotkeysManager.destroy();
    viewport.remove();
  });

  it('runs no hotkey command for keys typed in the chat input', () => {
    render(<InputArea onSubmit={jest.fn()} disabled={false} threadId="thread-1" />);
    const input = screen.getByRole('textbox');
    input.focus();
    for (const key of ['z', 'i', 'z', 'i']) {
      press(input, key);
    }
    expect(commandsManager.runCommand).not.toHaveBeenCalled();
  });

  it('still runs the hotkey command when the key is pressed on the viewport', () => {
    press(viewport, 'z');
    expect(commandsManager.runCommand).toHaveBeenCalledWith(
      'setToolActive',
      expect.objectContaining({ toolName: 'Zoom' }),
      undefined
    );
  });
});
