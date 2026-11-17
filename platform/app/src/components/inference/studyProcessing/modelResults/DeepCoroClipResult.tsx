import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEEP_CORO_CLIP_ARTERY_GROUPS,
  type DeepCoroClipArtery,
  type DeepCoroClipResultPayload,
} from './deepCoroClipContract';

export interface DeepCoroClipResultProps {
  payload: DeepCoroClipResultPayload;
}

const arteryTranslation: Record<DeepCoroClipArtery, string> = {
  'Proximal RCA': 'ProcessingDeepCoroClipArteryProximalRca',
  'Mid RCA': 'ProcessingDeepCoroClipArteryMidRca',
  'Distal RCA': 'ProcessingDeepCoroClipArteryDistalRca',
  'Posterior Descending Artery': 'ProcessingDeepCoroClipArteryPda',
  'Posterolateral Branch': 'ProcessingDeepCoroClipArteryPosterolateral',
  'Left Main Branch': 'ProcessingDeepCoroClipArteryLeftMain',
  'Proximal LAD': 'ProcessingDeepCoroClipArteryProximalLad',
  'Mid LAD': 'ProcessingDeepCoroClipArteryMidLad',
  'Distal LAD': 'ProcessingDeepCoroClipArteryDistalLad',
  'D1 Branch': 'ProcessingDeepCoroClipArteryD1',
  'D2 Branch': 'ProcessingDeepCoroClipArteryD2',
  'Proximal LCX': 'ProcessingDeepCoroClipArteryProximalLcx',
  'Mid LCX': 'ProcessingDeepCoroClipArteryMidLcx',
  'Distal LCX': 'ProcessingDeepCoroClipArteryDistalLcx',
  'OM1 (Obtuse Marginal 1)': 'ProcessingDeepCoroClipArteryOm1',
  'OM2 (Obtuse Marginal 2)': 'ProcessingDeepCoroClipArteryOm2',
  'Branch Vessel': 'ProcessingDeepCoroClipArteryBranchVessel',
  LVp: 'ProcessingDeepCoroClipArteryLvp',
};

const diagnosisTranslation = {
  normal: ['ProcessingDeepCoroClipDiagnosisNormal', 'Normal'],
  blocked: ['ProcessingDeepCoroClipDiagnosisBlocked', 'Blocked'],
  calcified: ['ProcessingDeepCoroClipDiagnosisCalcified', 'Calcified'],
  cto: ['ProcessingDeepCoroClipDiagnosisCto', 'CTO'],
  thrombus: ['ProcessingDeepCoroClipDiagnosisThrombus', 'Thrombus'],
} as const;

const groups = [
  {
    id: 'rca',
    translation: 'ProcessingDeepCoroClipGroupRca',
    defaultLabel: 'Right coronary artery (RCA) system',
    arteries: DEEP_CORO_CLIP_ARTERY_GROUPS.rca,
  },
  {
    id: 'lca',
    translation: 'ProcessingDeepCoroClipGroupLca',
    defaultLabel: 'Left coronary artery (LCA) system',
    arteries: DEEP_CORO_CLIP_ARTERY_GROUPS.lca,
  },
  {
    id: 'other',
    translation: 'ProcessingDeepCoroClipGroupOther',
    defaultLabel: 'Other vessels',
    arteries: DEEP_CORO_CLIP_ARTERY_GROUPS.other,
  },
] as const;

interface FindingCellProps {
  diagnosis: keyof typeof diagnosisTranslation;
  estimate?: number;
  probability: number;
}

function FindingCell({ diagnosis, estimate, probability }: FindingCellProps) {
  const { t } = useTranslation('StudyList');
  const [diagnosisKey, diagnosisDefault] = diagnosisTranslation[diagnosis];

  return (
    <td className="border-t border-white/10 px-3 py-3 align-top text-xs text-[#c5cbc5]">
      <span className="block font-semibold text-white">
        {t(diagnosisKey, { defaultValue: diagnosisDefault })}
      </span>
      {estimate !== undefined && (
        <span className="mt-1 block tabular-nums">
          {t('ProcessingDeepCoroClipEstimate', { defaultValue: 'Estimate' })}: {estimate.toFixed(1)}
          %
        </span>
      )}
      <span className="mt-1 block tabular-nums">
        {t('ProcessingDeepCoroClipProbability', { defaultValue: 'Probability' })}:{' '}
        {(probability * 100).toFixed(1)}%
      </span>
    </td>
  );
}

export function DeepCoroClipResult({ payload }: DeepCoroClipResultProps) {
  const { t } = useTranslation('StudyList');

  return (
    <section
      aria-labelledby="deepcoro-clip-result-title"
      data-testid="deepcoro-clip-result"
    >
      <header className="mb-4">
        <h3
          id="deepcoro-clip-result-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingDeepCoroClipTitle', { defaultValue: 'DeepCORO-CLIP vessel findings' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingDeepCoroClipDescription', {
            defaultValue:
              'Model-estimated stenosis, calcification, chronic total occlusion, and thrombus findings by coronary vessel.',
          })}
        </p>
      </header>

      <div className="space-y-5">
        {groups.map(group => {
          const groupTitle = t(group.translation, { defaultValue: group.defaultLabel });
          return (
            <section
              key={group.id}
              aria-labelledby={`deepcoro-clip-group-${group.id}`}
              data-testid={`deepcoro-clip-group-${group.id}`}
            >
              <h4
                id={`deepcoro-clip-group-${group.id}`}
                className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
              >
                {groupTitle}
              </h4>
              <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03]">
                <table className="min-w-[760px] table-fixed border-collapse text-left">
                  <caption className="sr-only">{groupTitle}</caption>
                  <thead>
                    <tr className="text-xs text-[#c5cbc5]">
                      <th
                        scope="col"
                        className="w-[24%] px-3 py-3 font-semibold"
                      >
                        {t('ProcessingDeepCoroClipVessel', { defaultValue: 'Vessel' })}
                      </th>
                      <th
                        scope="col"
                        className="w-[19%] px-3 py-3 font-semibold"
                      >
                        {t('ProcessingDeepCoroClipStenosis', {
                          defaultValue: 'Estimated stenosis',
                        })}
                      </th>
                      <th
                        scope="col"
                        className="w-[19%] px-3 py-3 font-semibold"
                      >
                        {t('ProcessingDeepCoroClipCalcification', {
                          defaultValue: 'Calcification',
                        })}
                      </th>
                      <th
                        scope="col"
                        className="w-[19%] px-3 py-3 font-semibold"
                      >
                        {t('ProcessingDeepCoroClipCto', {
                          defaultValue: 'Chronic total occlusion (CTO)',
                        })}
                      </th>
                      <th
                        scope="col"
                        className="w-[19%] px-3 py-3 font-semibold"
                      >
                        {t('ProcessingDeepCoroClipThrombus', { defaultValue: 'Thrombus' })}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.arteries.map(artery => {
                      const prediction = payload.predictions[artery];
                      return (
                        <tr
                          key={artery}
                          data-testid={`deepcoro-clip-artery-${artery}`}
                        >
                          <th
                            scope="row"
                            className="border-t border-white/10 px-3 py-3 align-top text-xs font-semibold text-white"
                          >
                            {t(arteryTranslation[artery], { defaultValue: artery })}
                          </th>
                          <FindingCell
                            diagnosis={prediction.diagnosis_stenosis}
                            estimate={prediction.regression}
                            probability={prediction.stenosis_prob}
                          />
                          <FindingCell
                            diagnosis={prediction.diagnosis_calcif}
                            probability={prediction.calcif_prob}
                          />
                          <FindingCell
                            diagnosis={prediction.diagnosis_cto}
                            probability={prediction.cto_prob}
                          />
                          <FindingCell
                            diagnosis={prediction.diagnosis_thrombus}
                            probability={prediction.thrombus_prob}
                          />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      <p
        className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-[#c5cbc5]"
        role="note"
        data-testid="deepcoro-clip-assistive-note"
      >
        {t('ProcessingDeepCoroClipAssistiveNote', {
          defaultValue:
            'AI-generated vessel-level estimates. Review the complete angiographic study and clinical context before use.',
        })}
      </p>
    </section>
  );
}

export default DeepCoroClipResult;
