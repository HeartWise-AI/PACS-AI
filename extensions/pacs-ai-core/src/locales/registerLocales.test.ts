import i18n from '@ohif/i18n';
import registerLocales from './registerLocales';
import locales from './index';

jest.mock('@ohif/i18n', () => ({ __esModule: true, default: { addLocales: jest.fn() } }), {
  virtual: true,
});

describe('registerLocales', () => {
  test('adds every PACS-AI locale bundle through i18n.addLocales', () => {
    registerLocales();
    expect(i18n.addLocales).toHaveBeenCalledWith(locales);
  });

  test('ships our namespaces and the OHIF-namespace overrides for each language', () => {
    expect(Object.keys(locales).sort()).toEqual(['ar', 'de', 'en-US', 'es', 'fr', 'test-LNG', 'zh']);
    expect(locales['en-US'].TopNavigation).toBeDefined();
    expect(locales.fr.StudyList).toBeDefined();
    // OHIF-namespace files hold only our keys, not a copy of OHIF's.
    expect(locales['en-US'].Common).not.toHaveProperty(['Back to']);
  });
});
