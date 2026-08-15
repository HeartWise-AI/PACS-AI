import arabic from '../../../../i18n/src/locales/ar/TopNavigation.json';
import german from '../../../../i18n/src/locales/de/TopNavigation.json';
import english from '../../../../i18n/src/locales/en-US/TopNavigation.json';
import spanish from '../../../../i18n/src/locales/es/TopNavigation.json';
import french from '../../../../i18n/src/locales/fr/TopNavigation.json';

describe('top navigation translations', () => {
  test.each([
    ['Arabic', arabic],
    ['German', german],
    ['Spanish', spanish],
    ['French', french],
  ])('%s includes every English navigation key', (_language, translation) => {
    expect(Object.keys(translation).sort()).toEqual(Object.keys(english).sort());
    expect(Object.values(translation).every(Boolean)).toBe(true);
  });
});
