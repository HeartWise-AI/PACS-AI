import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@ohif/ui';

const TenantNotFound = () => {
  const { t } = useTranslation();

  // Set page title
  useEffect(() => {
    document.title = 'Tenant Not Found - PACS AI';
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center text-white">
      <div>
        <Typography
          variant="h4"
          className="text-primary-dark text-center font-light"
        >
          {t('Tenant Not Found')}
        </Typography>
      </div>
    </div>
  );
};

export default TenantNotFound;
