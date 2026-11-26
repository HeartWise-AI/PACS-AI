import React from 'react';
import { render } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../types';
import { setTestLocale } from '../testUtils/chatBoxTranslation';

jest.mock('react-i18next', () => ({
  useTranslation: () => require('../testUtils/chatBoxTranslation').useTranslationMock(),
}));

const base: Message = {
  id: 'assistant-language',
  sender: 'assistant',
  text: 'Réponse',
  timestamp: new Date('2026-11-26T12:00:00Z'),
};

afterEach(() => setTestLocale('en-US'));

describe('MessageBubble answer language', () => {
  it('shows the language the backend answered in, with the reason as its title', () => {
    const { getByTestId } = render(
      <MessageBubble
        message={{ ...base, responseLanguage: 'fr', responseLanguageSource: 'default' }}
      />
    );
    const badge = getByTestId('answer-language');
    expect(badge.textContent).toBe('fr');
    expect(badge.getAttribute('title')).toBe('Answer language: French (default of this site)');
  });

  it('explains a language the user asked for, in the viewer language', () => {
    setTestLocale('fr');
    const { getByTestId } = render(
      <MessageBubble
        message={{ ...base, responseLanguage: 'en', responseLanguageSource: 'message_request' }}
      />
    );
    expect(getByTestId('answer-language').getAttribute('title')).toBe(
      'Langue de la réponse : anglais (demandée)'
    );
  });

  it('never shows a reason code it does not know', () => {
    const { getAllByTestId } = render(
      <>
        <MessageBubble
          message={{ ...base, responseLanguage: 'fr', responseLanguageSource: 'some_new_reason' }}
        />
        <MessageBubble message={{ ...base, id: 'no-source', responseLanguage: 'en' }} />
      </>
    );
    const [unknown, missing] = getAllByTestId('answer-language');
    expect(unknown.getAttribute('title')).toBe('Answer language: French');
    expect(missing.getAttribute('title')).toBe('Answer language: English');
  });

  it('shows nothing for an older backend or a user message', () => {
    expect(render(<MessageBubble message={base} />).queryByTestId('answer-language')).toBeNull();
    expect(
      render(
        <MessageBubble message={{ ...base, sender: 'user', responseLanguage: 'en' }} />
      ).queryByTestId('answer-language')
    ).toBeNull();
  });
});
