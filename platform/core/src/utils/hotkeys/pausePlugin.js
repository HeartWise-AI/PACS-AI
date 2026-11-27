/**
 * adds a pause and unpause method to Mousetrap
 * this allows you to enable or disable keyboard shortcuts
 * without having to reset Mousetrap and rebind everything
 *
 * https://github.com/ccampbell/mousetrap/blob/master/plugins/pause/mousetrap-pause.js
 */
// Text inputs (not sliders, checkboxes or buttons), textareas, selects and
// contentEditable regions take the keys typed in them: no viewer hotkey fires
// while the focus is there (the AI chat input, label editors, search fields).
// Mousetrap's own check misses contentEditable descendants in some engines and
// role="textbox" widgets; an element with the `mousetrap` class still opts in.
var NON_TEXT_INPUT_TYPES = [
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
];

export function isTextEntryElement(element) {
  if (!element || typeof element.tagName !== 'string') {
    return false;
  }
  if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
    return false;
  }
  var tag = element.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (tag === 'INPUT') {
    return NON_TEXT_INPUT_TYPES.indexOf(String(element.type || 'text').toLowerCase()) === -1;
  }
  if (element.isContentEditable) {
    return true;
  }
  if (element.getAttribute && element.getAttribute('role') === 'textbox') {
    return true;
  }
  return !!(
    element.closest && element.closest('[contenteditable]:not([contenteditable="false"])')
  );
}

export default function pausePlugin(Mousetrap) {
  var _originalStopCallback = Mousetrap.prototype.stopCallback;

  Mousetrap.prototype.stopCallback = function (e, element, combo) {
    var self = this;

    if (self.paused) {
      return true;
    }

    var target = (e && typeof e.composedPath === 'function' && e.composedPath()[0]) || element;
    if (isTextEntryElement(target)) {
      return true;
    }

    return _originalStopCallback.call(self, e, element, combo);
  };

  Mousetrap.prototype.pause = function () {
    var self = this;
    self.paused = true;
  };

  Mousetrap.prototype.unpause = function () {
    var self = this;
    self.paused = false;
  };

  Mousetrap.init();
}
