import React from 'react';
import { useTranslation } from 'react-i18next';
import { getMemberAccessStatusPresentation } from './memberAccessStatus';

export interface MemberAccessStatusBadgeProps {
  accessState?: string;
}

export default function MemberAccessStatusBadge({ accessState }: MemberAccessStatusBadgeProps) {
  const { t } = useTranslation('Members');
  const { labelKey, className } = getMemberAccessStatusPresentation(accessState);
  const label = t(labelKey);

  return (
    <span
      className={`inline-block rounded-full px-2 py-1 ${className}`}
      aria-label={`${t('Access Status')}: ${label}`}
    >
      {label}
    </span>
  );
}
