import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

const listeners: Array<(language: string) => void> = [];
const mockI18n = {
  language: 'fr',
  on: jest.fn((_event: string, listener: (language: string) => void) => listeners.push(listener)),
  off: jest.fn(),
};
jest.mock('i18next', () => ({
  __esModule: true,
  get default() {
    return mockI18n;
  },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const mockChoose = jest.fn();
const mockApplyDefault = jest.fn(() => Promise.resolve('fr'));
jest.mock('@pacs-ai/extension-core/src/service/appLanguage', () => ({
  chooseLanguage: (language: string) => mockChoose(language),
  applySiteDefaultLanguage: () => mockApplyDefault(),
}));

import { AppLanguageSelect } from './AppLanguageSelect';

describe('AppLanguageSelect', () => {
  it('shows the current language, asks for the site default and saves a choice', () => {
    render(<AppLanguageSelect />);
    const select = screen.getByTestId('app-language') as HTMLSelectElement;
    expect(select.value).toBe('FR');
    expect(mockApplyDefault).toHaveBeenCalledTimes(1);

    fireEvent.change(select, { target: { value: 'EN' } });
    expect(mockChoose).toHaveBeenCalledWith('en');

    act(() => listeners.forEach(listener => listener('en-US')));
    expect(select.value).toBe('EN');
  });
});
