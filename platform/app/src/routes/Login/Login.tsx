import React, { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Button, Logo, Typography } from '@ohif/ui';
import { Input } from '@ohif/ui-next';
import userRepository from '../../api/userRepository';
import tenantRepository from '../../api/tenantRepository';
import repository from '../../api/repository';
import { GetAPIInfoResponse } from '../../api/dto';
import { GetPublicTenantByIDResponse } from '../../api/tenantDTO';
import { FrontendVersionContext } from '../../App';
import { AlertContext } from '../../AlertProvider';
import loginBG from './../../assets/pacs/bg/login-bg.png';
import chevronLeft from './../../assets/pacs/icons/chevron-left-gradient.png';
import { Error } from '../../api/dto';
import { logoutUser, navigateAfterAuth } from '../../service/userService';
import { consumeAccountSuspendedRedirect } from '../../service/accountAccessSession';
import TurnstileWidget from '../../components/auth/TurnstileWidget';
import type { LoginAPIError } from '../../api/loginAPIError';
import { getLoginErrorMessage, requiresLoginChallenge } from './loginError';
import { createLoginRequest } from './loginRequest';

const turnstileSiteKey = process.env.APP_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';

const LoginPage = () => {
  const { t } = useTranslation('Onboarding');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const showAlert = useContext(AlertContext) as (
    message: string,
    type: 'success' | 'error'
  ) => void;
  const [showLoginForm, setShowLoginForm] = useState(true);
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetPublicTenantByIDResponse>>({});
  const [apiInfo, setAPIInfo] = useState<Partial<GetAPIInfoResponse>>({});
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationCooldown, setVerificationCooldown] = useState(0);
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [loginCooldown, setLoginCooldown] = useState(0);
  const isLoggingInRef = useRef(false);
  const loginCooldownUntilRef = useRef(0);
  const challengePromptRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const tenantId = new URLSearchParams(location.search).get('t');
  const frontendVersion = useContext(FrontendVersionContext);
  const defaultTenant = process.env.APP_PUBLIC_DEFAULT_TENANT;

  // Set page title
  useEffect(() => {
    document.title = 'Login - PACS AI';
  }, []);

  useEffect(() => {
    const suspendedRedirect = consumeAccountSuspendedRedirect(location.search);
    if (!suspendedRedirect.suspended) {
      return;
    }

    showAlert(
      t('Your account access has been suspended. Contact your workspace administrator.'),
      'error'
    );
    navigate({ pathname: '/login', search: suspendedRedirect.nextSearch }, { replace: true });
  }, [location.search, navigate, showAlert, t]);

  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const response = await tenantRepository.GetPublicTenantByID({
          tenantId,
        });
        setTenantInfo(response.data || {});
      } catch (error) {
        navigate(`/login?t=${defaultTenant}`, { replace: true });
        window.location.reload();
      }
    };
    const fetchAPIInfo = async () => {
      try {
        const response = await repository.GetAPIInfo();
        setAPIInfo(response.data || {});
      } catch (error) {
        console.error(error);
      }
    };
    const getCurrentUser = async () => {
      try {
        const response = await userRepository.GetCurrentUser();
        if (response.success) {
          await navigateAfterAuth(navigate, response.data);
        } else {
          localStorage.removeItem('sessionToken');
        }
      } catch (error) {
        console.warn('GetCurrentUser failed on login page', error);
      }
    };

    void fetchTenantInfo();
    void getCurrentUser();
    void fetchAPIInfo();
  }, [defaultTenant, navigate, tenantId]);

  useEffect(() => {
    if (verificationCooldown <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setVerificationCooldown(seconds => Math.max(seconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [verificationCooldown]);

  useEffect(() => {
    if (loginCooldown <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      const remainingSeconds = Math.max(
        Math.ceil((loginCooldownUntilRef.current - Date.now()) / 1000),
        0
      );
      setLoginCooldown(remainingSeconds);
      if (remainingSeconds === 0) {
        loginCooldownUntilRef.current = 0;
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loginCooldown]);

  useEffect(() => {
    if (challengeRequired) {
      challengePromptRef.current?.focus();
    }
  }, [challengeRequired]);

  const handleForgotPasswordClick = () => {
    setShowLoginForm(false);
    setShowForgotPasswordForm(true);
  };

  const handleBackToLoginClick = () => {
    setShowLoginForm(true);
    setShowForgotPasswordForm(false);
  };

  const handleCreateAccountClick = () => {
    navigate({ pathname: '/register', search: location.search });
  };

  const resendVerificationEmail = () => {
    const targetEmail = (verificationEmail || email).trim().toLowerCase();
    if (!targetEmail || !tenantId || verificationCooldown > 0) {
      return;
    }

    setIsSendingVerification(true);
    userRepository
      .VerifyEmail({ tenantId, email: targetEmail })
      .then(response => {
        setVerificationEmail(targetEmail);
        setVerificationCooldown(60);
        showAlert(response.message, 'success');
      })
      .catch(error => {
        showAlert(error?.message || 'Unable to send verification email', 'error');
      })
      .finally(() => {
        setIsSendingVerification(false);
      });
  };

  // User login
  const onLogin = async e => {
    e.preventDefault();
    if (
      isLoggingInRef.current ||
      (loginCooldownUntilRef.current > 0 && Date.now() < loginCooldownUntilRef.current)
    ) {
      return;
    }
    if (!tenantId) {
      showAlert(t('Unable to determine the workspace. Reload the page and try again.'), 'error');
      return;
    }
    if (challengeRequired && !turnstileToken) {
      showAlert(t('Complete the login verification to continue.'), 'error');
      challengePromptRef.current?.focus();
      return;
    }

    const submittedTurnstileToken = challengeRequired ? turnstileToken || undefined : undefined;
    isLoggingInRef.current = true;
    setIsLoggingIn(true);

    try {
      // Keep the public tenant context available to suspension redirects and later navigation.
      localStorage.setItem('tenantId', tenantId);
      const response = await userRepository.Login(
        createLoginRequest({
          tenantId,
          email,
          password,
          turnstileToken: submittedTurnstileToken,
        })
      );
      const sessionToken = response.data.sessionToken;
      if (!sessionToken) {
        showAlert(t('Login is temporarily unavailable. Please try again later.'), 'error');
        return;
      }

      localStorage.setItem('sessionToken', sessionToken);
      const currentUserResponse = await userRepository.GetCurrentUser().catch(() => null);
      if (!currentUserResponse) {
        localStorage.removeItem('sessionToken');
        showAlert(t('Login is temporarily unavailable. Please try again later.'), 'error');
        return;
      }
      if (!currentUserResponse.success || !currentUserResponse.data) {
        localStorage.removeItem('sessionToken');
        showAlert(t('Login is temporarily unavailable. Please try again later.'), 'error');
        return;
      }
      setPassword('');
      setChallengeRequired(false);
      await navigateAfterAuth(navigate, currentUserResponse.data);
      showAlert(response.message, 'success');
    } catch (failure) {
      const error = (failure || {}) as Partial<LoginAPIError>;
      if (requiresLoginChallenge(error)) {
        setChallengeRequired(true);
      }
      if (error.retryAfterSeconds && error.retryAfterSeconds > 0) {
        loginCooldownUntilRef.current = Date.now() + error.retryAfterSeconds * 1000;
        setLoginCooldown(error.retryAfterSeconds);
      }
      if (error.errorCode === Error.FIREBASE_AUTH_EMAIL_NOT_VERIFIED) {
        localStorage.removeItem('sessionToken');
        setVerificationEmail(email.trim().toLowerCase());
      }
      showAlert(getLoginErrorMessage(error, t), 'error');
    } finally {
      if (submittedTurnstileToken) {
        setTurnstileToken(null);
        setTurnstileResetKey(value => value + 1);
      }
      isLoggingInRef.current = false;
      setIsLoggingIn(false);
    }
  };

  // User reset password
  const resetPassword = e => {
    e.preventDefault();
    setIsResettingPassword(true);
    userRepository
      .ForgotPassword({ tenantId, email })
      .then(response => {
        setIsResettingPassword(false);
        showAlert(response.message, 'success');
        setShowForgotPasswordForm(false);
        setShowLoginForm(true);
      })
      .catch(error => {
        setIsResettingPassword(false);
        if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
          setTimeout(() => {
            logoutUser(navigate, tenantId);
          }, 3000);
        }

        showAlert(error.message, 'error');
      });
  };

  const versionInfo = () => {
    return (
      <div className={`mx-auto mt-4 block flex w-full justify-center gap-3 rounded-lg text-center`}>
        <div className="flex items-center gap-2">
          <Typography
            variant="body"
            className="font-light text-white"
            component="span"
          >
            <span className="opacity-50">{t('Backend')}:</span> {apiInfo.version}
          </Typography>
        </div>
        <div className="flex items-center gap-2">
          <Typography
            variant="body"
            className="font-light text-white"
            component="span"
          >
            <span className="opacity-50">{t('Frontend')}:</span> {frontendVersion}
          </Typography>
        </div>
      </div>
    );
  };

  return (
    <div className="relative mx-0 grid h-screen w-screen grid-cols-12">
      <div className="col-span-12 overflow-y-auto bg-[#151815] p-10 sm:col-span-8 md:col-span-7 xl:col-span-4">
        {showLoginForm && (
          <div className="flex h-full flex-col justify-between">
            <div>
              <Logo class="h-auto w-[200px]" />
              <Typography
                variant="body"
                className="mt-4 min-h-[17px] text-white"
              >
                {tenantInfo.name ? `${tenantInfo.name} (${tenantInfo.id})` : '‎'}
              </Typography>
            </div>
            <div>
              <Typography
                variant="h3"
                className="mt-2 text-white"
              >
                {t('Welcome to PACS AI')}
              </Typography>
              <Typography
                variant="body"
                className="mb-5 text-white text-opacity-70"
              >
                {t('Enter your email and password to sign in.')}
              </Typography>
              <form onSubmit={onLogin}>
                <label
                  className="sr-only"
                  htmlFor="email"
                >
                  {t('Email address')}
                </label>
                <Input
                  placeholder={t('Email address')}
                  autoFocus
                  autoComplete="email"
                  id="email"
                  className="mb-4 w-full"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value.toLowerCase())}
                  onKeyPress={e => e.key === ' ' && e.preventDefault()}
                />
                <label
                  className="sr-only"
                  htmlFor="password"
                >
                  {t('Password')}
                </label>
                <Input
                  placeholder={t('Password')}
                  autoComplete="current-password"
                  id="password"
                  className="mb-4 w-full"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <div className="mb-7 flex justify-end">
                  <button
                    type="button"
                    className="text-md rounded-lg bg-transparent p-0 font-medium text-white text-opacity-70 !ring-0"
                    onClick={handleForgotPasswordClick}
                  >
                    {t('Forgot Password')}?
                  </button>
                </div>
                {challengeRequired && (
                  <div
                    ref={challengePromptRef}
                    tabIndex={-1}
                    role="group"
                    aria-labelledby="login-verification-heading"
                    className="focus:ring-primary-light mb-4 rounded-lg bg-white bg-opacity-5 p-3 outline-none focus:ring-2"
                  >
                    <Typography
                      id="login-verification-heading"
                      variant="body"
                      component="p"
                      className="text-sm text-white text-opacity-80"
                    >
                      {t('Additional verification is required before signing in.')}
                    </Typography>
                    <TurnstileWidget
                      siteKey={turnstileSiteKey}
                      action="login"
                      copy={{
                        ariaLabel: t('Login human verification'),
                        loading: t('Loading login verification…'),
                        failed: t('Login verification failed. Please try again.'),
                        expired: t('Login verification expired. Please complete it again.'),
                        unavailable: t(
                          'Login verification is unavailable. Please try again later.'
                        ),
                        retry: t('Try login verification again'),
                      }}
                      resetKey={turnstileResetKey}
                      onTokenChange={setTurnstileToken}
                    />
                  </div>
                )}
                {loginCooldown > 0 && (
                  <p
                    className="mb-4 text-sm text-amber-200"
                    role="status"
                    aria-live="polite"
                  >
                    {t('Login is temporarily limited. Try again in {{seconds}} seconds.', {
                      seconds: loginCooldown,
                    })}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={
                    isLoggingIn || loginCooldown > 0 || (challengeRequired && !turnstileToken)
                  }
                  className="h-[51px] w-full rounded-lg !px-0"
                >
                  {isLoggingIn ? t('Signing in…') : t('Login')}
                </Button>
              </form>
              {verificationEmail && (
                <div className="mt-4 rounded-lg bg-white bg-opacity-10 p-4 text-white">
                  <Typography
                    variant="body"
                    className="text-sm text-white text-opacity-80"
                  >
                    {t('Please verify your email before logging in.')}
                  </Typography>
                  <Button
                    disabled={isSendingVerification || verificationCooldown > 0}
                    className="mt-3 h-[42px] w-full rounded-lg !px-0"
                    onClick={resendVerificationEmail}
                  >
                    {verificationCooldown > 0
                      ? t('Resend available in {{seconds}}s', {
                          seconds: verificationCooldown,
                        })
                      : isSendingVerification
                        ? '...'
                        : t('Resend verification email')}
                  </Button>
                </div>
              )}
              {tenantInfo.onboardingEnableRegistration === true && (
                <div className="mt-4 flex w-full justify-center">
                  <p className="text-center text-base">
                    <span className="font-normal text-white text-opacity-70">{t('New here?')}</span>{' '}
                    <button
                      type="button"
                      disabled={isLoggingIn}
                      className="inline rounded-lg bg-transparent p-0 font-bold text-white !ring-0 disabled:opacity-50"
                      onClick={handleCreateAccountClick}
                    >
                      {t('Create an account')}
                    </button>
                  </p>
                </div>
              )}
            </div>
            <div>
              {versionInfo()}
              <Typography
                variant="body"
                className="mt-4 text-center font-light text-white text-opacity-70"
              >
                {t('© 2026 PACS AI. All rights reserved.')}
              </Typography>
            </div>
          </div>
        )}
        {showForgotPasswordForm && (
          <div className="flex h-full flex-col justify-between">
            <div>
              <button
                type="button"
                className="text-md flex items-center rounded-lg bg-transparent p-0 font-medium text-white text-opacity-70 !ring-0"
                onClick={handleBackToLoginClick}
              >
                <img
                  src={chevronLeft}
                  alt="Chevron left"
                  className="w-8"
                />
                <Typography
                  variant="subtitle"
                  className="text-center font-light text-white text-opacity-70"
                >
                  {t('Back to login')}
                </Typography>
              </button>
            </div>
            <div>
              <Typography
                variant="h3"
                className="text-white"
              >
                {t('Forgot Password')}
              </Typography>
              <Typography
                variant="body"
                className="mb-5 text-white text-opacity-70"
              >
                {t('To reset your password, please provide your registered email address.')}
              </Typography>
              <Input
                placeholder={t('Email address')}
                autoFocus
                id="email"
                className="mb-4 w-full"
                type="text"
                onChange={e => setEmail(e.target.value.toLowerCase())}
                onKeyPress={e => e.key === ' ' && e.preventDefault()}
              />

              <Button
                disabled={isResettingPassword}
                className="mt-7 h-[51px] w-full rounded-lg !px-0"
                onClick={resetPassword}
              >
                {isResettingPassword ? '...' : t('Reset Password')}
              </Button>
            </div>
            <div>
              {versionInfo()}
              <Typography
                variant="body"
                className="mt-4 text-center font-light text-white text-opacity-70"
              >
                {t('© 2026 PACS AI. All rights reserved.')}
              </Typography>
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          backgroundImage: `url(${loginBG})`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
        className="col-span-12 hidden p-10 sm:col-span-4 sm:block md:col-span-5 xl:col-span-8"
      ></div>
    </div>
  );
};

export default LoginPage;
