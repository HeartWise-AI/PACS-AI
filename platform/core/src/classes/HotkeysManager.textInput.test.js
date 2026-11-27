import HotkeysManager from './HotkeysManager';
import hotkeys from './../utils/hotkeys';

// Real Mousetrap (not mocked): the viewer's hotkeys must not fire while the
// keyboard focus is in a text field such as the AI chat input (PACS-AI chat
// focus bug), and must keep working when the focus is on the viewport.
describe('HotkeysManager with text fields', () => {
  let hotkeysManager;
  let commandsManager;
  let viewport;
  let chatInput;
  let chatField;
  let editable;

  const press = (target, key) => {
    const code = key.toUpperCase().charCodeAt(0);
    for (const type of ['keydown', 'keypress', 'keyup']) {
      const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'keyCode', { value: code });
      Object.defineProperty(event, 'which', { value: code });
      if (type === 'keypress') {
        Object.defineProperty(event, 'charCode', { value: key.charCodeAt(0) });
      }
      target.dispatchEvent(event);
    }
  };

  beforeEach(() => {
    localStorage.clear();
    commandsManager = { runCommand: jest.fn() };
    hotkeysManager = new HotkeysManager(commandsManager, {});
    hotkeysManager.setDefaultHotKeys([
      { commandName: 'setToolActive', commandOptions: { toolName: 'Zoom' }, keys: ['z'] },
      { commandName: 'invertViewport', keys: ['i'] },
    ]);
    viewport = document.createElement('div');
    viewport.tabIndex = 0;
    chatInput = document.createElement('textarea');
    chatField = document.createElement('input');
    chatField.type = 'text';
    editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.append(viewport, chatInput, chatField, editable);
  });

  afterEach(() => {
    hotkeysManager.destroy();
    hotkeys.reset();
    document.body.innerHTML = '';
  });

  it('does not run a hotkey command when the key is typed in the chat textarea', () => {
    press(chatInput, 'z');
    press(chatInput, 'i');
    expect(commandsManager.runCommand).not.toHaveBeenCalled();
  });

  it('does not run a hotkey command from a text input or a contentEditable', () => {
    press(chatField, 'z');
    press(editable, 'i');
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
