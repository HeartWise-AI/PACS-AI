import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CARDIO_SYNTAX_TERRITORIES,
  type CardioSyntaxCategory,
  type CardioSyntaxResultPayload,
  type CardioSyntaxTerritory,
} from './cardioSyntaxContract';

export interface CardioSyntaxResultProps {
  payload: CardioSyntaxResultPayload;
}

const territoryTranslation: Record<CardioSyntaxTerritory, string> = {
  'Global Cardiac Syntax': 'ProcessingCardioSyntaxTerritoryGlobal',
  'Left Cardiac Syntax': 'ProcessingCardioSyntaxTerritoryLeft',
  'Right Cardiac Syntax': 'ProcessingCardioSyntaxTerritoryRight',
};

const categoryTranslation: Record<CardioSyntaxCategory, string> = {
  no_disease: 'ProcessingCardioSyntaxCategoryNoDisease',
  mild: 'ProcessingCardioSyntaxCategoryMild',
  moderate: 'ProcessingCardioSyntaxCategoryModerate',
  severe: 'ProcessingCardioSyntaxCategorySevere',
};

const territoryDefaults: Record<CardioSyntaxTerritory, string> = {
  'Global Cardiac Syntax': 'Global cardiac SYNTAX',
  'Left Cardiac Syntax': 'Left cardiac SYNTAX',
  'Right Cardiac Syntax': 'Right cardiac SYNTAX',
};

const categoryDefaults: Record<CardioSyntaxCategory, string> = {
  no_disease: 'No disease',
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
};

export function CardioSyntaxResult({ payload }: CardioSyntaxResultProps) {
  const { t } = useTranslation('StudyList');

  return (
    <section
      aria-labelledby="cardiosyntax-result-title"
      data-testid="cardiosyntax-result"
    >
      <header className="mb-4">
        <h3
          id="cardiosyntax-result-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingCardioSyntaxTitle', { defaultValue: 'AI-SYNTAX estimates' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingCardioSyntaxDescription', {
            defaultValue: 'Model-estimated coronary complexity scores by territory.',
          })}
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-3">
        {CARDIO_SYNTAX_TERRITORIES.map(territory => {
          const prediction = payload.predictions[territory];
          return (
            <div
              key={territory}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4"
              data-testid={`cardiosyntax-territory-${territory}`}
            >
              <dt className="text-xs font-semibold text-[#c5cbc5]">
                {t(territoryTranslation[territory], {
                  defaultValue: territoryDefaults[territory],
                })}
              </dt>
              <dd className="mt-3">
                <span className="block text-2xl font-bold tabular-nums text-white">
                  {prediction.regression.toFixed(1)}
                </span>
                <span className="mt-1 block text-xs font-semibold text-[#78b7f5]">
                  {t(categoryTranslation[prediction.category], {
                    defaultValue: categoryDefaults[prediction.category],
                  })}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      <p
        className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-[#c5cbc5]"
        role="note"
        data-testid="cardiosyntax-assistive-note"
      >
        {t('ProcessingCardioSyntaxAssistiveNote', {
          defaultValue:
            'AI-generated estimate. Review the complete study and clinical context before use.',
        })}
      </p>
    </section>
  );
}

export default CardioSyntaxResult;
