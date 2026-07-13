import React from 'react';
import { GetTenantInfoResponse } from '../../../../api/tenantDTO';
import CopyToClipboardButton from './CopyToClipboardButton';

type TenantHeaderProps = {
  tenantInfo: Partial<GetTenantInfoResponse>;
};

const TenantHeader = ({ tenantInfo }: TenantHeaderProps) => {
  if (!tenantInfo.name) {
    return (
      <div
        role="tenantInfo"
        className={`grid max-w-full animate-pulse grid-cols-9 gap-4`}
      >
        <div>
          <div className='className="mb-2 mb-2 h-7 w-[250px] rounded-lg bg-gray-200 bg-opacity-30'></div>
          <div className='className="mb-2 mb-2 h-2 w-[150px] rounded-lg bg-gray-200 bg-opacity-30'></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl text-white">{tenantInfo.name}</h1>
      <div className="flex flex-col text-sm font-light text-white text-opacity-70 sm:flex-row sm:items-center">
        <div className="flex items-center sm:ml-1">
          {tenantInfo.id}
          <CopyToClipboardButton text={tenantInfo.id || ''} />
        </div>
      </div>
    </div>
  );
};

export default TenantHeader;
