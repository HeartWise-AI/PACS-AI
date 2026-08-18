import React from 'react';
import { useTranslation } from 'react-i18next';
import { GenericModelResult } from '../GenericModelResult';

export interface UnsupportedModelResultProps {
  modelName: string;
  modelVersion: string | null;
  payload: unknown;
  reason: 'payload' | 'version' | 'renderer';
}

export function UnsupportedModelResult({
  modelName,
  modelVersion,
  payload,
  reason,
}: UnsupportedModelResultProps) {
  const { t } = useTranslation('StudyList');
  const message =
    reason === 'version'
      ? t('ProcessingEchoUnsupportedVersion', {
          defaultValue:
            'No structured result template is available for this model version. The raw result is available below for troubleshooting.',
        })
      : t('ProcessingEchoUnsupportedPayload', {
          defaultValue:
            'This result does not match the supported payload contract. The raw result is available below for troubleshooting.',
        });

  return (
    <section data-testid="unsupported-model-result">
      <div
        className="rounded-lg border border-[#f8d84a]/40 bg-[#3b351d] px-4 py-4 text-sm text-[#fff0a6]"
        role="alert"
      >
        <p className="font-bold">
          {modelName}
          {modelVersion ? ` · v${modelVersion}` : ''}
        </p>
        <p className="mt-2 leading-5">{message}</p>
      </div>
      <details
        className="mt-4"
        data-testid="unsupported-model-result-raw"
      >
        <summary className="cursor-pointer select-none text-sm font-bold text-[#78b7f5] focus:outline-none focus:ring-2 focus:ring-[#78b7f5]">
          {t('ProcessingEchoViewRawResult', { defaultValue: 'View raw result' })}
        </summary>
        <div className="mt-3">
          <GenericModelResult value={payload} />
        </div>
      </details>
    </section>
  );
}

export default UnsupportedModelResult;
