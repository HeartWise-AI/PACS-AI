import arabicMembers from '../../../../i18n/src/locales/ar/Members.json';
import germanMembers from '../../../../i18n/src/locales/de/Members.json';
import englishMembers from '../../../../i18n/src/locales/en-US/Members.json';
import spanishMembers from '../../../../i18n/src/locales/es/Members.json';
import frenchMembers from '../../../../i18n/src/locales/fr/Members.json';
import arabicOnboarding from '../../../../i18n/src/locales/ar/Onboarding.json';
import germanOnboarding from '../../../../i18n/src/locales/de/Onboarding.json';
import englishOnboarding from '../../../../i18n/src/locales/en-US/Onboarding.json';
import spanishOnboarding from '../../../../i18n/src/locales/es/Onboarding.json';
import frenchOnboarding from '../../../../i18n/src/locales/fr/Onboarding.json';

const membersLocales = [
  englishMembers,
  frenchMembers,
  germanMembers,
  spanishMembers,
  arabicMembers,
];
const accessKeys = [
  'Access Status',
  'Active',
  'Suspended',
  'Unknown',
  'Actions for {{member}}',
  'Suspend access',
  'Reactivate access',
  'Suspend access for {{member}}?',
  'Reactivate access for {{member}}?',
  'Administrative reason (optional)',
  'Add a reason for the audit trail',
  '{{count}} / 500 characters',
  'Account access management is no longer available for this member.',
  'Unable to update account access.',
] as const;
const suspendedLoginKey =
  'Your account access has been suspended. Contact your workspace administrator.';

describe('member access translations', () => {
  test.each(membersLocales)(
    'defines every member-access key in each supported namespace',
    locale => {
      accessKeys.forEach(key => {
        expect(locale[key]).toEqual(expect.any(String));
        expect(locale[key].trim()).not.toBe('');
      });
    }
  );

  test.each([
    englishOnboarding,
    frenchOnboarding,
    germanOnboarding,
    spanishOnboarding,
    arabicOnboarding,
  ])('defines the suspended-login explanation in each supported namespace', locale => {
    expect(locale[suspendedLoginKey]).toEqual(expect.any(String));
    expect(locale[suspendedLoginKey].trim()).not.toBe('');
  });
});
