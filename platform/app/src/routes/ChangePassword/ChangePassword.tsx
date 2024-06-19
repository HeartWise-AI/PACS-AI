import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button, Input, Typography } from '@ohif/ui';
import userRepository from '../../api/userRepository';
import loginBG from './../../assets/pacs/bg/login-bg.png';
import { AlertContext } from '../../AlertProvider';
import { Error } from '../../api/dto';
import { logoutUser } from './../../utils/userUtils';

const ChangePasswordPage = () => {
  const { t } = useTranslation();
  const showAlert = useContext(AlertContext);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || '';

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await userRepository.GetCurrentUser();
        setCurrentUser(response.data);

        if (currentUser.isEmailVerified) {
          navigate(`/`);
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchCurrentUser();
  }, [userRepository]);

  /**
   * Change Password
   */
  const changePassword = e => {
    e.preventDefault();
    setIsChangingPassword(true);

    // validate the new password
    const passwordErrors = validatePassword(newPassword);
    const hasErrors = Object.values(passwordErrors).some(error => error);

    if (hasErrors) {
      setIsChangingPassword(false);
      showAlert(
        Object.values(passwordErrors)
          .filter(error => error)
          .join(', '),
        'error'
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setIsChangingPassword(false);
      showAlert(`Password doesn't match`, 'error');
      return;
    }

    userRepository
      .UpdatePassword({
        newPassword,
      })
      .then(response => {
        setIsChangingPassword(false);
        showAlert(response.message, 'success');
        navigate(`/`);
      })
      .catch(error => {
        setIsChangingPassword(false);
        if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
          setTimeout(() => {
            logoutUser(navigate, tenantId);
          }, 3000);
        }

        showAlert(error.message, 'error');
      });
  };

  // Check if password is valid
  const validatePassword = value => {
    return {
      required: !value && 'Password is required',
      minLength: value.length < 8 && 'Minimum 8 characters required',
      hasUpperCase: !/[A-Z]/.test(value) && 'At least one uppercase letter required',
      hasLowerCase: !/[a-z]/.test(value) && 'At least one lowercase letter required',
      hasNumber: !/\d/.test(value) && 'At least one number required',
      hasSpecialChar:
        !/[!@#$%^&*()_+={};:'"|,.<>?]+/.test(value) && 'At least one special character required',
    };
  };
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
              {t('Change Password')}
            </Typography>
            <Typography
              variant="body"
              className="mb-5 text-white text-opacity-70"
            >
              {t('Please change your default password to continue.')}
            </Typography>
            <Input
              placeholder="New Password"
              autoFocus
              id="newPassword"
              className="mb-4 w-full"
              type="password"
              onChange={e => setNewPassword(e.target.value)}
            />
            <Input
              placeholder="Confirm New Password"
              autoFocus
              id="confirmNewPassword"
              className="mb-4 w-full"
              type="password"
              onChange={e => setConfirmNewPassword(e.target.value)}
            />
            <Button
              disabled={isChangingPassword}
              className="h-[51px] w-full rounded-lg !px-0"
              onClick={changePassword}
            >
              {isChangingPassword ? '...' : 'Confirm'}
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

export default ChangePasswordPage;
