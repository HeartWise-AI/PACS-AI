export interface PublicPolicyLinks {
  termsOfUseUrl: string | null;
  privacyPolicyUrl: string | null;
}

export interface PublicPolicyLinkEnvironment {
  APP_PUBLIC_TERMS_OF_USE_URL?: string;
  APP_PUBLIC_PRIVACY_POLICY_URL?: string;
}

const normalizePublicPolicyUrl = (value?: string): string | null => {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }

  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:' ? candidate : null;
  } catch {
    return null;
  }
};

export const getConfiguredPublicPolicyLinks = (
  environment: PublicPolicyLinkEnvironment
): PublicPolicyLinks => ({
  termsOfUseUrl: normalizePublicPolicyUrl(environment.APP_PUBLIC_TERMS_OF_USE_URL),
  privacyPolicyUrl: normalizePublicPolicyUrl(environment.APP_PUBLIC_PRIVACY_POLICY_URL),
});
