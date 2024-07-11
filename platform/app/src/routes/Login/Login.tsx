import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Button, Input, Logo, Typography } from '@ohif/ui';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './../../firebase';
import userRepository from '../../api/userRepository';
import tenantRepository from '../../api/tenantRepository';
import { GetPublicTenantByIDResponse } from '../../api/tenantDTO';
import { AlertContext } from '../../AlertProvider';
import loginBG from './../../assets/pacs/bg/login-bg.png';
import chevronLeft from './../../assets/pacs/icons/chevron-left-gradient.png';
import { Error } from '../../api/dto';
import { logoutUser } from '../../service/userService';

const LoginPage = () => {
  const { t } = useTranslation('Onboarding');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const showAlert = useContext(AlertContext);
  const [showLoginForm, setShowLoginForm] = useState(true);
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetPublicTenantByIDResponse>>({});
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const tenantId = new URLSearchParams(useLocation().search).get('t');

  auth.tenantId = tenantId;

  // Set page title
  useEffect(() => {
    document.title = 'Login - PACS AI';
  }, []);

  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const response = await tenantRepository.GetPublicTenantByID({
          tenantId,
        });
        setTenantInfo(response.data);
      } catch (error) {
        navigate('/tenantnotfound');
      }
    };
    fetchTenantInfo();
    getCurrentUser();
  }, [userRepository, tenantRepository]);

  const handleForgotPasswordClick = () => {
    setShowLoginForm(false);
    setShowForgotPasswordForm(true);
  };

  const handleBackToLoginClick = () => {
    setShowLoginForm(true);
    setShowForgotPasswordForm(false);
  };

  // User login
  const onLogin = e => {
    e.preventDefault();
    setIsLoggingIn(true);
    signInWithEmailAndPassword(auth, email, password)
      .then(userCredential => {
        // Signed-in in firebase auth
        userRepository
          .Login({
            tenantId: auth.tenantId,
            idToken: userCredential._tokenResponse.idToken,
          })
          .then(response => {
            // save sessionToken in localStorage
            const sessionToken = response.data.sessionToken;
            if (sessionToken) {
              localStorage.setItem('sessionToken', sessionToken);
            }

            // check if user is verified
            userRepository.GetCurrentUser().then(response => {
              localStorage.setItem('tenantId', auth.tenantId);
              if (!response.data.isEmailVerified) {
                navigate(`/change-password`);
              } else {
                navigate(`/`);
              }
            });
            setIsLoggingIn(false);
            showAlert(response.message, 'success');
          })
          .catch(error => {
            showAlert(error.message, 'error');
          });
      })
      .catch(() => {
        showAlert('Invalid email or password', 'error');
        setIsLoggingIn(false);
      });
  };

  // Get current user info
  const getCurrentUser = () => {
    userRepository.GetCurrentUser().then(response => {
      if (response.success) {
        navigate(`/`);
      } else {
        localStorage.removeItem('sessionToken');
      }
    });
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

  return (
    <div className="relative mx-0 grid h-screen w-screen grid-cols-12 ">
      <div className="col-span-12 bg-[#151815] p-10 sm:col-span-8 md:col-span-7 xl:col-span-4">
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
              <Input
                placeholder={t('Email address')}
                autoFocus
                id="email"
                className="mb-4 w-full"
                type="text"
                onChange={e => setEmail(e.target.value.toLowerCase())}
                onKeyPress={e => e.key === ' ' && e.preventDefault()}
              />
              <Input
                placeholder={t('Password')}
                id="password"
                className="mb-4 w-full"
                type="password"
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
              <Button
                disabled={isLoggingIn}
                className="h-[51px] w-full rounded-lg !px-0"
                onClick={onLogin}
              >
                {isLoggingIn ? '...' : t('Login')}
              </Button>
            </div>
            <div>
              <Typography
                variant="body"
                className="text-center font-light text-white text-opacity-70"
              >
                {t('© 2024 PACS AI. All rights reserved.')}
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
            <Typography
              variant="body"
              className="text-center font-light text-white text-opacity-70"
            >
              {t('© 2024 PACS AI. All rights reserved.')}
            </Typography>
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
