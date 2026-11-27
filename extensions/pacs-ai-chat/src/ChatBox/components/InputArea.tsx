import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isolateChatKeyEvent } from '../utils/keyboardIsolation';

interface InputAreaProps {
  onSubmit: (message: string) => void;
  /** Sending is blocked (answer in flight, history loading, no thread yet). */
  disabled: boolean;
  placeholder?: string;
  isProcessing?: boolean;
  threadId: string | null;
  threadCreationPending?: boolean;
}

const MAX_INPUT_HEIGHT_PX = 120;

/**
 * The chat input. It stays enabled while an answer is in flight: a disabled
 * field loses keyboard focus, and the next keystrokes then went to the viewer's
 * hotkeys (tool switches, W/L presets, invert, cine). Only sending is blocked;
 * the user can already type the next question.
 *
 * Enter sends, Shift+Enter inserts a newline.
 */
export const InputArea: React.FC<InputAreaProps> = ({
  onSubmit,
  disabled,
  placeholder,
  isProcessing = false,
  threadId,
  threadCreationPending = false,
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the text, up to a few lines.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT_PX)}px`;
  }, [inputValue]);

  const canSend = inputValue.trim() !== '' && !disabled;

  const submit = () => {
    if (!canSend) {
      return;
    }
    onSubmit(inputValue.trim());
    setInputValue('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    isolateChatKeyEvent(e);
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const getPlaceholder = () => {
    if (isProcessing) {
      return t('Processing...');
    }
    if (!threadId) {
      return threadCreationPending
        ? t('Initializing chat...')
        : t('Error initializing chat. Please retry.');
    }
    return placeholder || t('Type your message...');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-b-lg border-t border-white border-opacity-10 p-3"
    >
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={isolateChatKeyEvent}
          onKeyPress={isolateChatKeyEvent}
          aria-disabled={disabled || undefined}
          aria-label={t('Type your message...')}
          data-cy="chat-input"
          placeholder={getPlaceholder()}
          className="block w-full resize-none overflow-y-auto rounded-2xl bg-[#333633] py-2 px-4 pr-10 text-sm leading-5 text-white focus:outline-none"
          style={{ maxHeight: MAX_INPUT_HEIGHT_PX }}
          autoFocus={threadId !== null}
        />
        <button
          type="submit"
          data-cy="chat-send"
          disabled={!canSend}
          // keep the keyboard focus in the text field when the button is clicked
          onMouseDown={e => e.preventDefault()}
          aria-label={t('Send')}
          className={`absolute right-2 top-1/2 -translate-y-1/2 transform rounded-full p-1 ${
            canSend ? 'opacity-100 hover:bg-[#444844]' : 'cursor-not-allowed opacity-50'
          }`}
        >
          <svg
            className="h-5 w-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </form>
  );
};
