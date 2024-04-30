import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminTable, Button, Input, Logo, Typography } from '@ohif/ui';
import HeaderPanel from '/components/HeaderPanel';
import SidebarAdmin from '../../components/SidebarAdmin';

const KibanaLogsPage = () => {
  const headers = ['ID', 'Name', 'Email', 'License No.', 'Specialty', 'Email Status', 'Created At'];
  const data = [
    [
      '556342B',
      'Juan Dela Cruz',
      'abc123@gmail.com',
      'L1234567890',
      'Sample Specialty',
      'Verified',
      'Oct 19, 1994 14:19',
    ],
    [
      '556342B',
      'Juan Dela Cruz',
      'abc123@gmail.com',
      'L1234567890',
      'Sample Specialty',
      'Verified',
      'Oct 19, 1994 14:19',
    ],
    [
      '556342B',
      'Juan Dela Cruz',
      'abc123@gmail.com',
      'L1234567890',
      'Sample Specialty',
      'Verified',
      'Oct 19, 1994 14:19',
    ],
    [
      '556342B',
      'Juan Dela Cruz',
      'abc123@gmail.com',
      'L1234567890',
      'Sample Specialty',
      'Verified',
      'Oct 19, 1994 14:19',
    ],
    [
      '556342B',
      'Juan Dela Cruz',
      'abc123@gmail.com',
      'L1234567890',
      'Sample Specialty',
      'Verified',
      'Oct 19, 1994 14:19',
    ],
  ];

  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815] ">
        <SidebarAdmin />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="Kibana Logs" />
          {/* filter container */}
          <div className="flex justify-between rounded-xl border  border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <Input
              placeholder="Search member name, email, license no., etc."
              autoFocus
              id="search"
              className="w-[40%]"
              type="text"
            />
            <Button
              disabled={false}
              className="h-[51px] w-[51px] rounded-lg !px-0"
            >
              {'Q'}
            </Button>
          </div>
          {/* table container */}
          <div className="mt-5 rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <AdminTable
              headers={headers}
              data={data}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default KibanaLogsPage;
