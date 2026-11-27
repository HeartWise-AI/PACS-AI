/**
 * Keyboard isolation for the chat box.
 *
 * The viewer's hotkeys (OHIF HotkeysManager / Mousetrap on `document`, and
 * other `document`/`window` key listeners) must never react to keys typed in a
 * chat field. Mousetrap already ignores inputs and textareas, but other
 * listeners do not, so key events whose target is an editable field inside the
 * chat box are stopped before they leave it. Keys on the chat's buttons, and
 * the chat toggle shortcut (Ctrl+/), still propagate.
 */

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof (target as Element).tagName !== 'string') {
    return false;
  }
  const el = target as HTMLElement;
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (tag === 'INPUT') {
    return !NON_TEXT_INPUT_TYPES.has(((el as HTMLInputElement).type || 'text').toLowerCase());
  }
  if (el.isContentEditable) {
    return true;
  }
  const editable = el.getAttribute?.('contenteditable');
  return editable === '' || editable === 'true' || el.getAttribute?.('role') === 'textbox';
}

/** Ctrl+/ (or Cmd+/) toggles the chat from anywhere, the chat input included. */
export function isChatToggleShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>) {
  return (event.ctrlKey || event.metaKey) && event.key === '/';
}

type AnyKeyboardEvent =
  | KeyboardEvent
  | { nativeEvent: KeyboardEvent; stopPropagation: () => void; target: EventTarget | null };

/**
 * Stops a key event typed in an editable chat field from reaching the viewer's
 * document/window listeners. Returns true when the event was stopped.
 */
export function isolateChatKeyEvent(event: AnyKeyboardEvent): boolean {
  const native: KeyboardEvent = 'nativeEvent' in event ? event.nativeEvent : event;
  const target = (native.composedPath?.()[0] as EventTarget) || native.target || event.target;
  if (!isEditableTarget(target) || isChatToggleShortcut(native)) {
    return false;
  }
  event.stopPropagation();
  if (native !== event) {
    native.stopPropagation();
  }
  return true;
}
