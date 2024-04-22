import React, { useState, useRef } from 'react';
import { Typography } from '@ohif/ui';
import { useTranslation } from 'react-i18next';

const AdminHeader = ({ title }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

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
              <span className="text-common-light mr-3 text-lg">Hi, Juan</span>
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
                className="absolute z-10 w-28 divide-y divide-gray-100 rounded-lg bg-gray-900 shadow "
                style={{ top: ref.current ? ref.current.offsetHeight : 0 }}
              >
                <ul className="py-2 text-sm text-white">
                  <li>
                    <a
                      href="/settings"
                      className="block px-4 py-2 hover:bg-gray-700"
                    >
                      Settings
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="block px-4 py-2 hover:bg-gray-700"
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

export default AdminHeader;
