const mockI18n = {
  language: 'en-US',
  changeLanguage: jest.fn((code: string) => {
    mockI18n.language = code;
  }),
};
jest.mock('i18next', () => ({
  __esModule: true,
  get default() {
    return mockI18n;
  },
}));
jest.mock('../api/orchestratorRepository', () => ({
  __esModule: true,
  default: { GetChatSettings: jest.fn() },
}));

import {
  CHOSEN_LANGUAGE_KEY,
  applySiteDefaultLanguage,
  chatResponseLanguage,
  chooseLanguage,
  resetAppLanguageForTests,
} from './appLanguage';

const settings = (language: string | null) => () =>
  Promise.resolve({ data: { chat_default_language: language } });

beforeEach(() => {
  window.localStorage.clear();
  resetAppLanguageForTests();
  mockI18n.language = 'en-US';
  mockI18n.changeLanguage.mockClear();
});

describe('app language', () => {
  it('starts on the site default (fr) when the user has chosen none, and sends it with chat', async () => {
    expect(chatResponseLanguage()).toBeUndefined();
    await expect(applySiteDefaultLanguage(settings('fr'))).resolves.toBe('fr');
    expect(mockI18n.changeLanguage).toHaveBeenCalledWith('fr');
    expect(chatResponseLanguage()).toBe('fr');
  });

  it('keeps the user choice over the site default and remembers it', async () => {
    chooseLanguage('en');
    expect(window.localStorage.getItem(CHOSEN_LANGUAGE_KEY)).toBe('en-US');
    mockI18n.changeLanguage.mockClear();
    await applySiteDefaultLanguage(settings('fr'));
    expect(mockI18n.changeLanguage).not.toHaveBeenCalled();
    expect(chatResponseLanguage()).toBe('en');
  });

  it('sends French only for French; other UI languages ask for English answers', () => {
    chooseLanguage('fr');
    expect(chatResponseLanguage()).toBe('fr');
    chooseLanguage('de');
    expect(chatResponseLanguage()).toBe('en');
  });

  it('sends no language when the site default is unknown', async () => {
    await expect(
      applySiteDefaultLanguage(() => Promise.reject(new Error('down')))
    ).resolves.toBeNull();
    await expect(applySiteDefaultLanguage(settings(null))).resolves.toBeNull();
    expect(chatResponseLanguage()).toBeUndefined();
    expect(mockI18n.changeLanguage).not.toHaveBeenCalled();
  });
});
