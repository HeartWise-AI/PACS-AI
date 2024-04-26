import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Logo, Typography } from '@ohif/ui';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './../../firebase';
import loginBG from './../../assets/pacs/bg/login-bg.png';
import { Login } from '../../api/user.repository';
import chevronLeft from './../../assets/pacs/icons/chevron-left-gradient.png';

const LoginPage = () => {
  const [showLoginForm, setShowLoginForm] = useState(true);
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleForgotPasswordClick = () => {
    setShowLoginForm(false);
    setShowForgotPasswordForm(true);
  };

  const handleBackToLoginClick = () => {
    setShowLoginForm(true);
    setShowForgotPasswordForm(false);
  };

  auth.tenantId = 'qhn-mha-nzjew';
  const onLogin = e => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, email, password)
      .then(userCredential => {
        // Signed in
        const user = userCredential.user;
        console.log(user);
        console.log(userCredential._tokenResponse.idToken);
        Login(auth.tenantId, userCredential._tokenResponse.idToken);
      })
      .catch(error => {
        console.log('123', auth.tenantId);
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorCode, errorMessage);
      });
  };

  return (
    <div className="relative mx-0 grid h-screen w-screen grid-cols-12 ">
      <div className="col-span-12 bg-[#151815] p-10 sm:col-span-8 md:col-span-5 xl:col-span-4">
        {showLoginForm && (
          <div className="flex h-full flex-col justify-between">
            <div>
              <Logo class="h-auto w-[200px]" />
              <Typography
                variant="body"
                className="mt-4 text-white"
              >
                {t('PACS AI (1234567890-00)')}
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
                placeholder="Email address"
                autoFocus
                id="email"
                className="mb-4 w-full"
                type="text"
                onChange={e => setEmail(e.target.value)}
              />
              <Input
                placeholder="Password"
                autoFocus
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
                  {'Forgot password?'}
                </button>
              </div>
              <Button
                disabled={false}
                className="h-[51px] w-full rounded-lg !px-0"
                onClick={onLogin}
              >
                {'Login'}
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
                  {t(' Back to login')}
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
                placeholder="Email address"
                autoFocus
                id="email"
                className="mb-4 w-full"
                type="text"
              />

              <Button
                disabled={false}
                className="mt-7 h-[51px] w-full rounded-lg"
              >
                {'Reset Password'}
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
        className="col-span-12 p-10 sm:col-span-4 md:col-span-7 xl:col-span-8"
      ></div>
    </div>
  );
};

export default LoginPage;
