import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Typography } from '@ohif/ui';
import userRepository from '../api/userRepository';

const HeaderPanel = ({ title }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const ref = useRef(null);
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || '';
  let name: string = 'User';

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await userRepository.GetCurrentUser();
        setCurrentUser(response.data);
      } catch (error) {
        logoutUser();
      }
    };

    fetchCurrentUser();
  }, [userRepository]);

  const logoutUser = () => {
    navigate(`/login?t=${tenantId}`);
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('tenantId');
  };

  if (currentUser) {
    name = currentUser.name.split(' ')[0];
  }

  return (
    <div className="relative mx-auto w-full pt-5">
      <div className="mb-5 flex flex-row justify-between py-5">
        <div className="flex min-w-[1px] shrink flex-row items-center gap-6">
          <Typography
            variant="h6"
            className="text-white"
          >
            {t(`${title}`)}
          </Typography>
        </div>
        <div className="flex flex-row">
          <div
            className="relative flex items-center"
            ref={ref}
          >
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center rounded-lg bg-transparent px-5 py-2.5 text-center text-sm font-medium text-white !ring-0"
              type="button"
            >
              <span className="text-common-light mr-3 text-lg">Hi, {name}</span>
              <svg
                className="ms-3 h-2.5 w-2.5"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 10 6"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="m1 1 4 4 4-4"
                />
              </svg>
            </button>

            {isOpen && (
              <div
                className="absolute z-50 w-28 divide-y divide-gray-100 rounded-lg bg-[#4C504B]"
                style={{ top: ref.current ? ref.current.offsetHeight : 0 }}
              >
                <ul className="py-2 text-sm text-white">
                  <li>
                    <a
                      className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
                      onClick={() => navigate(`/settings`)}
                    >
                      Settings
                    </a>
                  </li>
                  <li>
                    <a
                      className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
                      onClick={logoutUser}
                    >
                      Logout
                    </a>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderPanel;
