import tenantRepository from '../api/tenantRepository';
import type { UserResponse } from '../api/userDTO';
import { clearAuthenticatedSession } from '../utils/authenticatedSession';
import { getPendingAccountSuspendedLoginURL } from './accountAccessSession';

/**
 * Resolve where a freshly-authenticated user should land based on their onboarding
 * state, and navigate there.
 *
 * This keeps the onboarding gate in the auth flow rather than relying on a
 * component side-effect (HeaderPanel) to redirect after the worklist has already
 * mounted. New users who still need onboarding go straight to the right page
 * instead of flashing through `/` first.
 */
export const navigateAfterAuth = async (navigate, user: UserResponse) => {
  // Admin-created users who have not verified their email must set a password first.
  if (!user.isEmailVerified && user.isAdminCreated) {
    navigate('/change-password', { replace: true });
    return;
  }

  // Users who have not signed consent must complete it before reaching the worklist,
  // unless the tenant has disabled consent onboarding.
  if (!user.isConsentSigned) {
    let consentRequired = true;
    try {
      const tenantResponse = await tenantRepository.GetTenantInfo();
      if (tenantResponse.data.onboardingEnableConsent === false) {
        consentRequired = false;
      }
    } catch (error) {
      void error;
      // if tenant settings cannot be loaded, keep default (redirect) for safety
    }
    if (consentRequired) {
      navigate('/user/consent', { replace: true });
      return;
    }
  }

  navigate('/', { replace: true });
};

export const logoutUser = (navigate, tenantId, forcedLogout = true) => {
  clearAuthenticatedSession();

  const suspendedLoginURL = getPendingAccountSuspendedLoginURL();
  if (suspendedLoginURL) {
    // The API interceptor already initiated this redirect. Replacing with the same URL
    // prevents generic request handlers from overwriting the suspension reason.
    window.location.replace(suspendedLoginURL);
    return;
  }

  if (forcedLogout) {
    // if unauthorized user error, redirect to login page using window.location.href to clear the cache and state, and avoid re-rendering
    window.location.href = `/login?t=${tenantId}`;
  } else {
    // redirect to login page
    navigate(`/login?t=${tenantId}`);
  }
};
