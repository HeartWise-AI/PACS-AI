import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { InputArea } from './InputArea';
import { isEditableTarget, isolateChatKeyEvent } from '../utils/keyboardIsolation';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

// Stand-ins for the viewer's key handlers: OHIF hotkeys and our viewer
// handlers listen on document / window and would switch tools, presets, cine...
function listenLikeTheViewer() {
  const documentKeys: string[] = [];
  const windowKeys: string[] = [];
  const onDocument = (e: KeyboardEvent) => documentKeys.push(`${e.type}:${e.key}`);
  const onWindow = (e: KeyboardEvent) => windowKeys.push(`${e.type}:${e.key}`);
  for (const type of ['keydown', 'keyup', 'keypress']) {
    document.addEventListener(type, onDocument as EventListener);
    window.addEventListener(type, onWindow as EventListener);
  }
  return {
    documentKeys,
    windowKeys,
    remove: () => {
      for (const type of ['keydown', 'keyup', 'keypress']) {
        document.removeEventListener(type, onDocument as EventListener);
        window.removeEventListener(type, onWindow as EventListener);
      }
    },
  };
}

function renderInput(props: Partial<React.ComponentProps<typeof InputArea>> = {}) {
  const onSubmit = jest.fn();
  render(
    <InputArea
      onSubmit={onSubmit}
      disabled={false}
      threadId="thread-1"
      {...props}
    />
  );
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  return { onSubmit, input };
}

function press(el: Element, key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(el, { key, ...init });
  // Browsers fire keypress for printable keys and Enter only.
  if (key.length === 1) {
    fireEvent.keyPress(el, { key, charCode: key.charCodeAt(0), ...init });
  }
  fireEvent.keyUp(el, { key, ...init });
}

describe('chat InputArea keyboard handling', () => {
  let viewer: ReturnType<typeof listenLikeTheViewer>;
  beforeEach(() => {
    viewer = listenLikeTheViewer();
  });
  afterEach(() => viewer.remove());

  it('does not let keys typed in the chat input reach the viewer hotkeys', () => {
    const { input } = renderInput();
    input.focus();
    for (const key of ['z', 'p', 'i', 'r', 'w', '1', '2', ' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'Escape']) {
      press(input, key);
    }
    expect(viewer.documentKeys).toEqual([]);
    expect(viewer.windowKeys).toEqual([]);
    expect(document.activeElement).toBe(input);
  });

  it('keeps the input enabled and focused while an answer is in flight', () => {
    const { input, onSubmit } = renderInput({ disabled: true, isProcessing: true });
    input.focus();
    expect(input.disabled).toBe(false);
    fireEvent.change(input, { target: { value: 'next question zoom 1 2 3' } });
    press(input, 'z');
    press(input, 'Enter');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.value).toBe('next question zoom 1 2 3');
    expect(document.activeElement).toBe(input);
    expect(viewer.documentKeys).toEqual([]);
  });

  it('sends on Enter and inserts a newline on Shift+Enter', () => {
    const { input, onSubmit } = renderInput();
    input.focus();
    fireEvent.change(input, { target: { value: 'first line' } });
    const shiftEnter = fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(shiftEnter).toBe(true); // not prevented: the browser inserts the newline
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'first line\nsecond line zoom' } });
    const enter = fireEvent.keyDown(input, { key: 'Enter' });
    expect(enter).toBe(false); // prevented: no newline, the message is sent
    expect(onSubmit).toHaveBeenCalledWith('first line\nsecond line zoom');
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('lets the chat toggle shortcut (Ctrl+/) through', () => {
    const { input } = renderInput();
    input.focus();
    fireEvent.keyDown(input, { key: '/', ctrlKey: true });
    expect(viewer.documentKeys).toEqual(['keydown:/']);
  });

  it('keeps the focus in the input when the send button is clicked', () => {
    const { input } = renderInput();
    input.focus();
    fireEvent.change(input, { target: { value: 'hello' } });
    const button = screen.getByRole('button', { name: 'Send' });
    const mouseDown = fireEvent.mouseDown(button);
    expect(mouseDown).toBe(false); // default (focus move) prevented
  });
});

describe('keyboard isolation helpers', () => {
  it('treats text fields as editable, not buttons or sliders', () => {
    const make = (html: string) => {
      const host = document.createElement('div');
      host.innerHTML = html;
      return host.firstElementChild as HTMLElement;
    };
    expect(isEditableTarget(make('<textarea></textarea>'))).toBe(true);
    expect(isEditableTarget(make('<input type="text" />'))).toBe(true);
    expect(isEditableTarget(make('<input type="search" />'))).toBe(true);
    expect(isEditableTarget(make('<select></select>'))).toBe(true);
    expect(isEditableTarget(make('<div contenteditable="true"></div>'))).toBe(true);
    expect(isEditableTarget(make('<input type="range" />'))).toBe(false);
    expect(isEditableTarget(make('<button>ok</button>'))).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it('stops only events from editable targets', () => {
    const textarea = document.createElement('textarea');
    const button = document.createElement('button');
    document.body.append(textarea, button);
    const onDocument = jest.fn();
    document.addEventListener('keydown', onDocument);
    const stopper = (e: Event) => isolateChatKeyEvent(e as KeyboardEvent);
    textarea.addEventListener('keydown', stopper);
    button.addEventListener('keydown', stopper);

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    expect(onDocument).not.toHaveBeenCalled();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    expect(onDocument).toHaveBeenCalledTimes(1);

    document.removeEventListener('keydown', onDocument);
    textarea.remove();
    button.remove();
  });
});
