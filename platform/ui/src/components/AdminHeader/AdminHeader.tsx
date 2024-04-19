import React, { useState } from 'react';
import { Typography } from '@ohif/ui';
import { useTranslation } from 'react-i18next';

const AdminHeader = ({ title }) => {
  const { t } = useTranslation();

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
          <div className="flex items-center">
            <span className="text-common-light mr-3 text-lg">Hi, Juan</span>
            <button
              id="dropdownDefaultButton"
              data-dropdown-toggle="dropdown"
              className="inline-flex items-center rounded-lg bg-transparent px-5 py-2.5 text-center text-sm font-medium text-white !ring-0"
              type="button"
            >
              <svg
                className="ms-3 h-2.5 w-2.5"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 10 6"
              >
                <path
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="m1 1 4 4 4-4"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHeader;
