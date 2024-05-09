import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router';
import { Link } from 'react-router-dom';
import { Button, Input, Typography } from '@ohif/ui';
import HeaderPanel from '../../components/HeaderPanel';
import Sidebar from '../../components/Sidebar';
import copyIcon from './../../assets/pacs/icons/copy-gradient.png';
import chevronDown from './../../assets/pacs/icons/chevron-down.png';
import logoVertical from './../../assets/pacs/logo/pacs-ai-logo-v.png';
import userRepository from '../../api/userRepository';
import { UserResponse } from '../../api/userDTO';
import { GetTenantInfoResponse } from '../../api/tenantDTO';
import { AlertContext } from '../../AlertProvider';
import Modal from '../../components/Modal';
import tenantRepository from '../../api/tenantRepository';

const SettingsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<Partial<UserResponse>>({});
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [selectedTab, setSelectedTab] = useState<string>('general');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isOpenChangePasswordModal, setIsOpenChangePasswordModal] = useState<boolean>(false);
  const showAlert = useContext(AlertContext);

  // Set page title
  useEffect(() => {
    document.title = 'Settings - PACS AI';
  }, []);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await userRepository.GetCurrentUser();
        setCurrentUser(response.data);
      } catch (error) {
        console.error(error);
      }
    };

    const fetchTenantInfo = async () => {
      try {
        const response = await tenantRepository.GetTenantInfo();
        setTenantInfo(response.data);
      } catch (error) {
        console.error(`Can't fetch tenant info: ${error}`);
      }
    };

    fetchCurrentUser();
    fetchTenantInfo();
  }, [userRepository, tenantRepository]);

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
        setIsOpenChangePasswordModal(false);
      })
      .catch(error => {
        setIsChangingPassword(false);
        showAlert(error.message, 'error');
      });
  };

  const CopyToClipboardButton = ({ text }) => {
    const copyToClipboard = () => {
      navigator.clipboard.writeText(text).then(() => {
        showAlert('Copy to clipboard success', 'success');
      });
    };

    return (
      <button className="p-0 focus:ring-0">
        <img
          src={copyIcon}
          alt="Copy icon"
          className="ml-2 h-5 w-5 cursor-pointer"
          onClick={copyToClipboard}
        />
      </button>
    );
  };

  const handleTabChange = (tab: string) => {
    setSelectedTab(tab);
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

  const GeneralSettings = () => {
    return (
      <div className="rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
        <div className="">
          <h1 className="text-2xl text-white">{t('General Settings')}</h1>
        </div>
        <div className="flex items-center pt-7">
          {/* <img
          src={`https://api.dicebear.com/7.x/identicon/svg?seed=${currentUser.id}`}
          alt="Profile"
          width="55"
          className="rounded-lg border border-gray-200 p-2"
        /> */}
          <div className="min-w-10 h-10 rounded-lg bg-white opacity-10"></div>
          {currentUser.name ? (
            <div className="ml-3">
              <h1 className="text-lg font-normal text-white">{currentUser.name}</h1>
              <div className="-mt-1 flex flex-col text-sm font-light text-white text-opacity-70 sm:flex-row sm:items-center ">
                <div className="text-left capitalize">{currentUser.specialty} •</div>
                <div className="flex items-center sm:ml-1">
                  {currentUser.licenseNo}
                  <CopyToClipboardButton text={currentUser.licenseNo} />
                </div>
              </div>
            </div>
          ) : (
            <div
              role="userInfo"
              className={`ml-3 mt-1 grid max-w-full animate-pulse grid-cols-9 gap-4`}
            >
              <div>
                <div className='className="mb-2 mb-2 h-3 w-[150px] rounded-lg bg-gray-200 bg-opacity-30'></div>
                <div className='className="mb-2 mb-2 h-2 w-[70px] rounded-lg bg-gray-200 bg-opacity-30'></div>
              </div>
            </div>
          )}
        </div>
        <div className="pt-7">
          <h1 className="text-lg font-normal text-white">{t('Security')}</h1>

          <div className="mt-2 flex items-center justify-between border-b border-white border-opacity-10 pb-5">
            <div>
              <h2 className="text-base font-light text-white">{t('Change Password')}</h2>
              <h2 className="text-sm text-white text-opacity-70">
                {t('Change your current password')}
              </h2>
            </div>
            <button
              className="text-primary focus:ring-0"
              onClick={() => setIsOpenChangePasswordModal(true)}
            >
              <span className="relative z-10 bg-gradient-to-r from-[rgba(200,244,105,1)] to-[rgba(25,154,95,1)] bg-clip-text text-lg font-bold text-transparent">
                {t('Change Password')}
              </span>
            </button>
          </div>
        </div>

        <div className="pt-5">
          <h1 className="text-lg font-normal text-white">{t('Preferences')}</h1>

          <div className="mt-2 flex items-center justify-between pb-5">
            <div>
              <h2 className="text-base font-light text-white">{t('Language')}</h2>
              <h2 className="text-sm text-white text-opacity-70">
                {t('Change your preferred language')}
              </h2>
            </div>
            <button className="flex h-[45px] w-[200px] items-center justify-between rounded-lg bg-white bg-opacity-10 px-3 text-lg font-light text-white">
              <span> {t('English')}</span>
              <img
                src={chevronDown}
                alt="Chevron down icon"
                className="h-5 w-5"
              />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AboutSettings = () => {
    return (
      <div className="rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
        <div className="flex w-full flex-col items-center justify-center">
          <img
            src={logoVertical}
            alt="Pacs logo"
            className="max-w-[138px]"
          />
          <Typography
            variant="subtitle"
            className="mt-5 text-center font-light text-white text-opacity-80"
          >
            {tenantInfo.name + ' ' + `(${tenantInfo.id})`}
          </Typography>
          <Typography
            variant="subtitle"
            className="mt-5 max-w-[70%] text-center font-light text-white text-opacity-80"
          >
            {t(
              'PACS AI is a custom built platform that will integrate artificial intelligence within the existing Pictures Archiving Communication System infrastructure across Canadian hospitals, facilitating real-time AI inference on medical images. The initiative focuses on leveraging pre-existing infrastructure for cost-effective, fair, and accessible AI deployment, ensuring patient privacy and data security, and promoting continual learning through feedback. The ultimate objective is to scale this solution, demonstrating its utility in improving clinical outcomes and promoting responsible AI adoption in healthcare.'
            )}
          </Typography>
          <Typography
            variant="body"
            className="mt-5 text-center font-light text-white text-opacity-80"
          >
            {t('v1.0.2')}
          </Typography>
          <Typography
            variant="body"
            className="mt-5 text-center font-light text-white text-opacity-80"
          >
            {t('Last updated: April 26, 2023 10:00 AM')}
          </Typography>
          <div className="mt-5 flex items-end gap-2">
            <Link
              href="#"
              showIcon={false}
              className="text-primary-dark text-base font-light"
            >
              Privacy Policy
            </Link>
            <span className="text-white text-opacity-80">&</span>
            <Link
              href="#"
              showIcon={false}
              className="text-primary-dark text-base font-light"
            >
              Terms and conditions
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815] ">
        <Sidebar />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="Settings" />
          <div className="mb-5">
            <ul className="-mb-px flex flex-wrap text-center text-sm font-medium">
              <li
                className={`me-2 cursor-pointer rounded-lg px-8 py-3 ${
                  selectedTab === 'general'
                    ? 'bg-gradient-to-r from-[rgba(200,244,105,0.2)] via-[rgba(200,244,105,0.2)] to-[rgba(5,144,94,0.2)]'
                    : 'bg-transparent'
                }`}
                onClick={() => {
                  handleTabChange('general');
                }}
              >
                <Typography
                  variant="subtitle"
                  className={`font-light ${
                    selectedTab === 'general' ? 'text-primary-dark' : 'text-white text-opacity-50'
                  }`}
                >
                  {t('General')}
                </Typography>
              </li>
              <li
                className={`me-2 cursor-pointer rounded-lg px-8 py-3 ${
                  selectedTab === 'about'
                    ? 'bg-gradient-to-r from-[rgba(200,244,105,0.2)] via-[rgba(200,244,105,0.2)] to-[rgba(5,144,94,0.2)]'
                    : 'bg-transparent'
                }`}
                onClick={() => {
                  handleTabChange('about');
                }}
              >
                <Typography
                  variant="subtitle"
                  className={`font-light ${
                    selectedTab === 'about' ? 'text-primary-dark' : 'text-white text-opacity-50'
                  }`}
                >
                  {t('About PACS AI')}
                </Typography>
              </li>
            </ul>
          </div>
          {selectedTab === 'general' && <GeneralSettings />}
          {selectedTab === 'about' && <AboutSettings />}
          {isOpenChangePasswordModal && (
            <Modal
              isOpen={isOpenChangePasswordModal}
              size="max-w-[520px]"
              onClose={() => {
                setIsOpenChangePasswordModal(false);
              }}
            >
              <div className="relative">
                <Typography
                  variant="h6"
                  className="font-light text-white"
                >
                  {t('Change Password')}
                </Typography>
                <Typography
                  variant="body"
                  className="mt-2 font-light text-white text-opacity-70"
                >
                  {t('Please provide your current and new password to continue.')}
                </Typography>

                <div className="mt-5">
                  <Input
                    id="newPassword"
                    placeholder="New Password"
                    className="mb-4 w-full"
                    type="password"
                    onChange={e => setNewPassword(e.target.value)}
                    autoFocus
                  />
                  <Input
                    id="confirmNewPassword"
                    placeholder="Confirm New Password"
                    className="mb-4 w-full"
                    type="password"
                    onChange={e => setConfirmNewPassword(e.target.value)}
                  />
                </div>
                <div className="mt-2 flex w-full justify-end">
                  <Button
                    disabled={isChangingPassword}
                    className="h-[41px] w-[111px] rounded-lg"
                    onClick={changePassword}
                  >
                    {isChangingPassword ? '...' : 'Confirm'}
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
