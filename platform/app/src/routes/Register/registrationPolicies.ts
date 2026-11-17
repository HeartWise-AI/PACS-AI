import type { PolicyAcceptanceInput, PolicyDefinition } from '../../api/userDTO';

export interface RegistrationPolicyPair {
  terms: PolicyDefinition;
  privacy: PolicyDefinition;
  acceptances: PolicyAcceptanceInput[];
}

const isSafePolicyURL = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export const resolveRegistrationPolicyPair = (
  policies: PolicyDefinition[]
): RegistrationPolicyPair => {
  const requiredPolicies = policies.filter(policy => policy.required);
  const terms = requiredPolicies.find(policy => policy.policyKey === 'TERMS_OF_SERVICE');
  const privacy = requiredPolicies.find(policy => policy.policyKey === 'PRIVACY_POLICY');

  if (
    requiredPolicies.length !== 2 ||
    !terms ||
    !privacy ||
    terms.acceptanceAction !== 'AGREE' ||
    privacy.acceptanceAction !== 'ACKNOWLEDGE' ||
    !terms.version ||
    !privacy.version ||
    !isSafePolicyURL(terms.url) ||
    !isSafePolicyURL(privacy.url)
  ) {
    throw new Error('Registration policy configuration is unavailable.');
  }

  return {
    terms,
    privacy,
    acceptances: requiredPolicies.map(({ policyKey, version }) => ({ policyKey, version })),
  };
};
