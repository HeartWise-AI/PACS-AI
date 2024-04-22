import React from 'react';
import { Button, Input, Typography } from '@ohif/ui';
import { useTranslation } from 'react-i18next';
import loginBG from './../../assets/pacs/bg/login-bg.png';

const ResetPasswordPage = () => {
  const { t } = useTranslation();

  return (
    <div className="relative mx-0 grid h-screen w-screen grid-cols-12 ">
      <div className="col-span-12 bg-[#151815] p-10 sm:col-span-8 md:col-span-5 xl:col-span-4">
        <div className="flex h-full flex-col justify-between">
          <div></div>
          <div>
            <Typography
              variant="h3"
              className="mt-2 text-white"
            >
              {t('Reset Password')}
            </Typography>
            <Typography
              variant="body"
              className="mb-5 text-white text-opacity-70"
            >
              {t('Provide your new password for abc@gmail.com account.')}
            </Typography>
            <Input
              placeholder="New Password"
              autoFocus
              id="newPassword"
              className="mb-4 w-full"
              type="password"
            />
            <Input
              placeholder="Confirm New Password"
              autoFocus
              id="confirmNewPassword"
              className="mb-4 w-full"
              type="password"
            />
            <Button
              disabled={false}
              className="mt-7 h-[51px] w-full rounded-lg"
            >
              {'Confirm'}
            </Button>
          </div>
          <div>
            <h1 className="text-center text-base text-white text-opacity-70">
              © 2024 PACS AI. All rights reserved.
            </h1>
          </div>
        </div>
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

export default ResetPasswordPage;
