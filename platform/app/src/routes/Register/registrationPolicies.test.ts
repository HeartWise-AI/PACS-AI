import type { PolicyDefinition } from '../../api/userDTO';
import { resolveRegistrationPolicyPair } from './registrationPolicies';

const currentPolicies = (): PolicyDefinition[] => [
  {
    policyKey: 'TERMS_OF_SERVICE',
    version: 'terms-v1',
    title: 'Terms of Service',
    url: 'https://pacsai.co/terms-of-service',
    effectiveAt: '2026-08-15',
    acceptanceAction: 'AGREE',
    required: true,
  },
  {
    policyKey: 'PRIVACY_POLICY',
    version: 'privacy-v1',
    title: 'Privacy Policy',
    url: 'https://pacsai.co/privacy-policy',
    effectiveAt: '2026-08-15',
    acceptanceAction: 'ACKNOWLEDGE',
    required: true,
  },
];

describe('resolveRegistrationPolicyPair', () => {
  it('maps the two current backend versions to one registration action', () => {
    expect(resolveRegistrationPolicyPair(currentPolicies()).acceptances).toEqual([
      { policyKey: 'TERMS_OF_SERVICE', version: 'terms-v1' },
      { policyKey: 'PRIVACY_POLICY', version: 'privacy-v1' },
    ]);
  });

  it('fails closed for missing, additional, or unsafe required policies', () => {
    expect(() => resolveRegistrationPolicyPair(currentPolicies().slice(0, 1))).toThrow();
    expect(() =>
      resolveRegistrationPolicyPair([
        ...currentPolicies(),
        { ...currentPolicies()[0], policyKey: 'UNKNOWN_POLICY' as never },
      ])
    ).toThrow();
    expect(() =>
      resolveRegistrationPolicyPair([
        { ...currentPolicies()[0], url: 'javascript:alert(1)' },
        currentPolicies()[1],
      ])
    ).toThrow();
  });
});
