import { getConfiguredPublicPolicyLinks } from './publicPolicyLinks';

describe('getConfiguredPublicPolicyLinks', () => {
  it('accepts deployment-owned web and same-origin policy URLs', () => {
    expect(
      getConfiguredPublicPolicyLinks({
        APP_PUBLIC_TERMS_OF_USE_URL: ' https://policies.example.test/terms/current ',
        APP_PUBLIC_PRIVACY_POLICY_URL: '/policies/privacy',
      })
    ).toEqual({
      termsOfUseUrl: 'https://policies.example.test/terms/current',
      privacyPolicyUrl: '/policies/privacy',
    });
  });

  it('does not expose empty, malformed, or executable URLs', () => {
    expect(
      getConfiguredPublicPolicyLinks({
        APP_PUBLIC_TERMS_OF_USE_URL: 'data:text/html,unsafe',
        APP_PUBLIC_PRIVACY_POLICY_URL: '//untrusted.example.test/privacy',
      })
    ).toEqual({
      termsOfUseUrl: null,
      privacyPolicyUrl: null,
    });
  });
});
