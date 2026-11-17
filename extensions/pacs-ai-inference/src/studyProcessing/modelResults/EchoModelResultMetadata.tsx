import React from 'react';
import { useTranslation } from 'react-i18next';

export interface EchoModelResultMetadataProps {
  modelName: string;
  modelVersion: string | null;
  status: 'completed';
}

export function EchoModelResultMetadata({
  modelName,
  modelVersion,
  status,
}: EchoModelResultMetadataProps) {
  const { t } = useTranslation('StudyList');

  return (
    <dl
      className="mb-5 grid grid-cols-1 gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs sm:grid-cols-3"
      data-testid="echo-model-result-metadata"
    >
      <div className="min-w-0">
        <dt className="font-semibold text-[#9fa89f]">
          {t('ProcessingEchoModelName', { defaultValue: 'Model' })}
        </dt>
        <dd className="mt-1 break-words font-bold text-white">{modelName}</dd>
      </div>
      <div className="min-w-0">
        <dt className="font-semibold text-[#9fa89f]">
          {t('ProcessingEchoModelVersion', { defaultValue: 'Version' })}
        </dt>
        <dd className="mt-1 break-words font-bold text-white">{modelVersion ?? '—'}</dd>
      </div>
      <div className="min-w-0">
        <dt className="font-semibold text-[#9fa89f]">
          {t('ProcessingEchoModelStatus', { defaultValue: 'Processing status' })}
        </dt>
        <dd className="mt-1 font-bold text-[#79d19a]">
          {status === 'completed'
            ? t('ProcessingEchoModelCompleted', { defaultValue: 'Completed' })
            : status}
        </dd>
      </div>
    </dl>
  );
}

export default EchoModelResultMetadata;
