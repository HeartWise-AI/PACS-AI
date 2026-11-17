import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CathEfResultPayload, CathEfVesselType } from './cathEfContract';

export interface CathEfResultProps {
  payload: CathEfResultPayload;
}

const vesselLabels: Record<CathEfVesselType, [string, string]> = {
  Aorta: ['ProcessingCathEfVesselAorta', 'Aorta'],
  Catheter: ['ProcessingCathEfVesselCatheter', 'Catheter'],
  Femoral: ['ProcessingCathEfVesselFemoral', 'Femoral'],
  Graft: ['ProcessingCathEfVesselGraft', 'Graft'],
  LV: ['ProcessingCathEfVesselLv', 'Left ventricle'],
  'Left Coronary': ['ProcessingCathEfVesselLeftCoronary', 'Left coronary'],
  Other: ['ProcessingCathEfVesselOther', 'Other'],
  Pigtail: ['ProcessingCathEfVesselPigtail', 'Pigtail'],
  Radial: ['ProcessingCathEfVesselRadial', 'Radial'],
  'Right Coronary': ['ProcessingCathEfVesselRightCoronary', 'Right coronary'],
  Stenting: ['ProcessingCathEfVesselStenting', 'Stenting'],
  'Unknown Vessel': ['ProcessingCathEfVesselUnknown', 'Unknown vessel'],
};

export function CathEfResult({ payload }: CathEfResultProps) {
  const { t, i18n } = useTranslation('StudyList');
  const lvefBySeries = new Map(
    payload.predictions.LVEF?.values.map(prediction => [prediction.seriesNumber, prediction.value])
  );
  const number = new Intl.NumberFormat(i18n?.language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <section
      aria-labelledby="cathef-title"
      data-testid="cathef-result"
    >
      <header className="mb-4">
        <h3
          id="cathef-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingCathEfTitle', { defaultValue: 'CathEF series findings' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingCathEfDescription', {
            defaultValue:
              'Acquisition classification by angiographic series, with LVEF estimates where available.',
          })}
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03]">
        <table className="min-w-[560px] table-fixed border-collapse text-left">
          <caption className="sr-only">
            {t('ProcessingCathEfTableCaption', {
              defaultValue: 'CathEF vessel classification and LVEF estimates by series',
            })}
          </caption>
          <thead>
            <tr className="text-xs text-[#c5cbc5]">
              <th
                scope="col"
                className="w-[20%] px-3 py-3 font-semibold"
              >
                {t('ProcessingCathEfSeries', { defaultValue: 'Series' })}
              </th>
              <th
                scope="col"
                className="w-[45%] px-3 py-3 font-semibold"
              >
                {t('ProcessingCathEfClassification', {
                  defaultValue: 'Acquisition classification',
                })}
              </th>
              <th
                scope="col"
                className="w-[35%] px-3 py-3 font-semibold"
              >
                {t('ProcessingCathEfLvef', { defaultValue: 'Estimated LVEF' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {payload.predictions.vessels.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="border-t border-white/10 px-3 py-4 text-xs text-[#c5cbc5]"
                >
                  {t('ProcessingCathEfNoSeries', {
                    defaultValue: 'No classified angiographic series were returned.',
                  })}
                </td>
              </tr>
            ) : (
              payload.predictions.vessels.map((prediction, index) => {
                const [labelKey, label] = vesselLabels[prediction.vessel];
                const lvef = lvefBySeries.get(prediction.seriesNumber);
                return (
                  <tr
                    key={`${prediction.seriesNumber}-${index}`}
                    data-testid={`cathef-series-${prediction.seriesNumber}`}
                  >
                    <th
                      scope="row"
                      className="border-t border-white/10 px-3 py-3 text-xs font-semibold tabular-nums text-white"
                    >
                      {prediction.seriesNumber}
                    </th>
                    <td className="border-t border-white/10 px-3 py-3 text-xs text-white">
                      {t(labelKey, { defaultValue: label })}
                    </td>
                    <td className="border-t border-white/10 px-3 py-3 text-xs tabular-nums text-[#c5cbc5]">
                      {lvef === undefined
                        ? t('ProcessingCathEfUnavailable', { defaultValue: 'Not available' })
                        : `${number.format(lvef)}%`}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p
        className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-[#c5cbc5]"
        role="note"
        data-testid="cathef-assistive-note"
      >
        {t('ProcessingCathEfAssistiveNote', {
          defaultValue:
            'AI-generated estimates from coronary angiography. LVEF is reported only for eligible left-coronary series. Review the complete study and clinical context before use.',
        })}
      </p>
    </section>
  );
}

export default CathEfResult;
