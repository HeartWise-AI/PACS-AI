import arabicMembers from '@pacs-ai/extension-core/src/locales/ar/Members.json';
import germanMembers from '@pacs-ai/extension-core/src/locales/de/Members.json';
import englishMembers from '@pacs-ai/extension-core/src/locales/en-US/Members.json';
import spanishMembers from '@pacs-ai/extension-core/src/locales/es/Members.json';
import frenchMembers from '@pacs-ai/extension-core/src/locales/fr/Members.json';
import arabicOnboarding from '@pacs-ai/extension-core/src/locales/ar/Onboarding.json';
import germanOnboarding from '@pacs-ai/extension-core/src/locales/de/Onboarding.json';
import englishOnboarding from '@pacs-ai/extension-core/src/locales/en-US/Onboarding.json';
import spanishOnboarding from '@pacs-ai/extension-core/src/locales/es/Onboarding.json';
import frenchOnboarding from '@pacs-ai/extension-core/src/locales/fr/Onboarding.json';

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
const loginAccessKeys = [
  'Your account access has been suspended. Contact your workspace administrator.',
  'Your session expired. Please sign in again.',
  'Login is temporarily limited. Try again in {{duration}}.',
  'Too many login attempts. Please wait {{duration}} before trying again.',
  '{{seconds}} s',
  '{{minutes}} min',
  '{{minutes}} min {{seconds}} s',
  'Too many failed sign-in attempts.',
  'For your security, sign-in is paused. Try again in about {{minutes}} min.',
  'For your security, sign-in is paused. Try again in less than a minute.',
  'For your security, sign-in is paused for a few minutes after repeated failed attempts. Wait a few minutes, then try again.',
  'Forgot your password? Reset it instead of waiting.',
  'For security, the number of sign-in attempts is limited.',
  'Too many failed sign-in attempts. Please wait a few minutes before trying again.',
] as const;

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
  ])('defines each login-access explanation in every supported namespace', locale => {
    loginAccessKeys.forEach(key => {
      expect(locale[key]).toEqual(expect.any(String));
      expect(locale[key].trim()).not.toBe('');
    });
  });
});
