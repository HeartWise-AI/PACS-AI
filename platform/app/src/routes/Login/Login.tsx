import React, { useState } from 'react';
import { Button, Input, Logo, Typography } from '@ohif/ui';
import { useTranslation } from 'react-i18next';
// import pacsLogo from 'platform/ui/src/assets/pacs/images/pacs-ai-logo.svg';

const LoginPage = () => {
  const [showLoginForm, setShowLoginForm] = useState(true);
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
  const { t } = useTranslation();

  const handleForgotPasswordClick = () => {
    setShowLoginForm(false);
    setShowForgotPasswordForm(true);
  };

  const handleBackToLoginClick = () => {
    setShowLoginForm(true);
    setShowForgotPasswordForm(false);
  };

  return (
    <div className="relative mx-0 grid h-screen w-screen grid-cols-12 ">
      <div className="col-span-12 bg-[#151815] p-10 sm:col-span-8 md:col-span-5 xl:col-span-4">
        {showLoginForm && (
          <div className="flex h-full flex-col justify-between">
            <div>
              {/* <h1 className="text-3xl text-white">PACS AI LOGO</h1>
              <img
                src={pacsLogo}
                alt="PACS logo"
              /> */}
              <Logo width="200" />
              <Typography
                variant="body"
                className="mt-2 text-white"
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
              />
              <Input
                placeholder="Password"
                autoFocus
                id="password"
                className="mb-4 w-full"
                type="password"
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
              >
                {'Login'}
              </Button>
            </div>
            <div>
              <h1 className="text-center text-base text-white text-opacity-70">
                © 2024 PACS AI. All rights reserved.
              </h1>
            </div>
          </div>
        )}
        {showForgotPasswordForm && (
          <div className="flex h-full flex-col justify-between">
            <div>
              <button
                type="button"
                className="text-md rounded-lg bg-transparent p-0 font-medium text-white text-opacity-70 !ring-0"
                onClick={handleBackToLoginClick}
              >
                Back to login
              </button>
            </div>
            <div>
              <h1 className="text-[32px] text-white">Forgot Password</h1>
              <h2 className="mb-5 text-sm text-white text-opacity-70">
                To reset your password, please provide your registered email address.
              </h2>
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
            <h1 className="text-center text-base text-white text-opacity-70">
              © 2024 PACS AI. All rights reserved.
            </h1>
          </div>
        )}
      </div>
      <div className="col-span-12  bg-gray-900 p-10 sm:col-span-4 md:col-span-7 xl:col-span-8"></div>
    </div>
  );
};

export default LoginPage;
