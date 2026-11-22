import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface InputAreaProps {
  onSubmit: (message: string) => void;
  disabled: boolean;
  placeholder?: string;
  isProcessing?: boolean;
  threadId: string | null;
  threadCreationPending?: boolean;
}

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() === '' || disabled) return;

    onSubmit(inputValue.trim());
    setInputValue('');
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
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder={getPlaceholder()}
          className="w-full rounded-full bg-[#333633] py-2 px-4 pr-10 text-sm text-white focus:outline-none"
          autoFocus={threadId !== null}
        />
        <button
          type="submit"
          disabled={inputValue.trim() === '' || disabled}
          className={`absolute right-2 top-1/2 -translate-y-1/2 transform rounded-full p-1 ${
            inputValue.trim() === '' || disabled
              ? 'cursor-not-allowed opacity-50'
              : 'opacity-100 hover:bg-[#444844]'
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
