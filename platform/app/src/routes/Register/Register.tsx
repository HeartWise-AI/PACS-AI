import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Button, Typography } from '@ohif/ui';
import { Input } from '@ohif/ui-next';
import userRepository from '../../api/userRepository';
import { GetDoctorSpecialtiesResponse, UserRole } from '../../api/userDTO';
import { Error } from '../../api/dto';
import { AlertContext } from '../../AlertProvider';
import { logoutUser } from '../../service/userService';
import loginBG from './../../assets/pacs/bg/login-bg.png';
import chevronLeft from './../../assets/pacs/icons/chevron-left-gradient.png';
import chevronDown from './../../assets/pacs/icons/chevron-down.png';
import eyeOff from './../../assets/pacs/icons/eye-off.png';
import eyeOn from './../../assets/pacs/icons/eye-on.png';

const membersSelectClassName =
  'mb-4 block h-[51px] w-full cursor-pointer appearance-none rounded-lg border-2 border-none bg-white bg-opacity-10 py-3 px-3 pr-8 text-lg leading-tight text-white focus:outline-none';

const passwordMinLength = 8;

const getPasswordValidationMessage = (password: string): string | null => {
  if (password.length < passwordMinLength) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain one uppercase';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain one lowercase';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain one special character';
  }
  return null;
};

const RegisterPage = () => {
  const { t } = useTranslation('Onboarding');
  const { t: tMembers } = useTranslation('Members');
  const navigate = useNavigate();
  const { search } = useLocation();
  const showAlert = useContext(AlertContext) as (message: string, variant: string) => void;

  const [email, setEmail] = useState(() => {
    const p = new URLSearchParams(search);
    return (p.get('email') || '').trim().toLowerCase();
  });
  const [invitationCode, setInvitationCode] = useState(() => {
    const p = new URLSearchParams(search);
    return (p.get('code') || '').trim();
  });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [specialties, setSpecialties] = useState<GetDoctorSpecialtiesResponse[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    document.title = 'Create an account - PACS AI';
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(search);
    setInvitationCode((params.get('code') || '').trim());
    const emailParam = params.get('email');
    if (emailParam?.trim()) {
      setEmail(emailParam.trim().toLowerCase());
    }
  }, [search]);

  useEffect(() => {
    const loadSpecialties = async () => {
      try {
        const response = await userRepository.GetDoctorSpecialties();
        setSpecialties(response.data || []);
      } catch (error) {
        showAlert(error.message, 'error');
        console.log(error?.message || 'Failed to load specialties', 'error');
      }
    };
    loadSpecialties();
    // load specialties once on mount
  }, []);

  /**
   * Handle back to login
   *
   * @returns
   */
  const handleBackToLogin = () => {
    navigate({ pathname: '/login', search });
  };

  /**
   * Submit register
   *
   * @returns
   */
  const submitRegister = async () => {
    const params = new URLSearchParams(search);
    const tenantIdFromInvite = (params.get('t') || '').trim();
    const codeFromUrl = invitationCode.trim() || (params.get('code') || '').trim();

    if (
      !email.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !licenseNo.trim() ||
      !specialty ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      showAlert(t('Please fill all required fields'), 'error');
      return;
    }
    const pwdMsg = getPasswordValidationMessage(password);
    if (pwdMsg) {
      showAlert(t(pwdMsg), 'error');
      return;
    }
    if (password !== confirmPassword) {
      showAlert(t('Passwords do not match'), 'error');
      return;
    }
    const tenantId = tenantIdFromInvite || localStorage.getItem('tenantId') || '';
    setIsRegistering(true);
    try {
      const response = await userRepository.RegisterTenantUser({
        tenantId,
        role: UserRole.USER,
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim().toLowerCase(),
        password,
        licenseNo: licenseNo.trim(),
        specialty,
        ...(codeFromUrl ? { code: codeFromUrl } : {}),
      });
      showAlert(response.message, 'success');
      navigate({ pathname: '/login', search });
    } catch (error) {
      showAlert(error?.message || 'Registration failed', 'error');
    }
    setIsRegistering(false);
  };

  return (
    <div className="relative mx-0 grid h-screen w-full max-w-full grid-cols-12 overflow-x-hidden">
      <div className="relative col-span-12 min-w-0 bg-[#151815] p-10 sm:col-span-8 md:col-span-7 xl:col-span-4">
        <div className="flex h-full min-h-0 min-w-0 flex-col justify-between">
          <div className="shrink-0">
            <button
              type="button"
              className="text-md flex items-center rounded-lg bg-transparent p-0 font-medium text-white text-opacity-70 !ring-0"
              onClick={handleBackToLogin}
            >
              <img
                src={chevronLeft}
                alt="Chevron left"
                className="w-8"
              />
              <Typography
                variant="subtitle"
                component="span"
                className="text-center font-light text-white text-opacity-70"
              >
                {t('Back to login')}
              </Typography>
            </button>
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-[.5px]">
            <Typography
              variant="h3"
              component="h1"
              className="mt-4 text-white"
            >
              {t('Create an Account')}
            </Typography>
            <Typography
              variant="body"
              component="p"
              className="mb-6 text-white text-opacity-70"
            >
              {t('Please review all details before proceeding')}
            </Typography>
            <form
              onSubmit={e => {
                e.preventDefault();
                void submitRegister();
              }}
            >
              <Typography
                variant="body"
                component="h2"
                className="mt-5 font-light text-white"
              >
                {tMembers('Personal Information')}
              </Typography>
              <div className="mt-4">
                <Input
                  id="register-email"
                  placeholder={tMembers('Email')}
                  className="mb-4 w-full"
                  type="text"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value.toLowerCase())}
                  onKeyPress={e => e.key === ' ' && e.preventDefault()}
                />
                <Input
                  id="register-firstname"
                  placeholder={tMembers('First Name')}
                  className="mb-4 w-full"
                  type="text"
                  autoComplete="given-name"
                  autoFocus
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                />
                <Input
                  id="register-lastname"
                  placeholder={tMembers('Last Name')}
                  className="mb-4 w-full"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                />
                <div className="relative">
                  <select
                    id="register-role"
                    value={UserRole.USER}
                    className={membersSelectClassName}
                    aria-label={tMembers('Role')}
                  >
                    <option
                      value={UserRole.USER}
                      className="!cursor-pointer !bg-[#323631] !py-2"
                    >
                      {t('User')}
                    </option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <img
                      src={chevronDown}
                      alt="Chevron down icon"
                      className="w-5"
                    />
                  </div>
                </div>

                <Input
                  id="register-license"
                  placeholder={tMembers('License No.')}
                  className="mb-4 w-full"
                  type="text"
                  value={licenseNo}
                  onChange={e => setLicenseNo(e.target.value)}
                />

                <div className="relative">
                  <select
                    id="register-specialty"
                    value={specialty}
                    onChange={e => setSpecialty(e.target.value)}
                    className={membersSelectClassName}
                  >
                    <option
                      value=""
                      disabled
                      className="!bg-[#323631] !py-2 text-white text-opacity-50"
                    >
                      {t('Select Specialty')}
                    </option>
                    {specialties.map(s => (
                      <option
                        key={s.id}
                        value={s.id}
                        className="!cursor-pointer !bg-[#323631] !py-2"
                      >
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <img
                      src={chevronDown}
                      alt="Chevron down icon"
                      className="w-5"
                    />
                  </div>
                </div>

                <div className="relative mb-4">
                  <Input
                    id="register-password"
                    placeholder={t('Password')}
                    className="w-full pr-12"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? t('Hide password') : t('Show password')}
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-white text-opacity-50 transition hover:text-opacity-90"
                    onClick={() => setShowPassword(v => !v)}
                  >
                    {showPassword ? (
                      <img
                        src={eyeOn}
                        alt="Eye on"
                        className="w-5"
                      />
                    ) : (
                      <img
                        src={eyeOff}
                        alt="Eye off"
                        className="w-5"
                      />
                    )}
                  </button>
                </div>

                <div className="relative mb-4">
                  <Input
                    id="register-confirm-password"
                    placeholder={t('Confirm Password')}
                    className="w-full pr-12"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? t('Hide password') : t('Show password')}
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-white text-opacity-50 transition hover:text-opacity-90"
                    onClick={() => setShowConfirmPassword(v => !v)}
                  >
                    {showConfirmPassword ? (
                      <img
                        src={eyeOn}
                        alt="Eye on"
                        className="w-5"
                      />
                    ) : (
                      <img
                        src={eyeOff}
                        alt="Eye off"
                        className="w-5"
                      />
                    )}
                  </button>
                </div>
              </div>

              <Button
                disabled={isRegistering}
                className="mt-6 h-[51px] w-full rounded-lg !px-0"
                onClick={() => {
                  void submitRegister();
                }}
              >
                {isRegistering ? '...' : t('Register')}
              </Button>
            </form>
          </div>
          <div className="shrink-0 pt-6">
            <Typography
              variant="body"
              component="p"
              className="text-center font-light text-white text-opacity-70"
            >
              {t('© 2026 PACS AI. All rights reserved.')}
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
        className="col-span-12 hidden min-w-0 p-10 sm:col-span-4 sm:block md:col-span-5 xl:col-span-8"
      ></div>
    </div>
  );
};

export default RegisterPage;
