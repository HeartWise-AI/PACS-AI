import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GenericModelResult } from './GenericModelResult';
import {
  buildReadableResult,
  type ReadableResult,
  type ReadableResultGroupId,
  type ReadableResultRow,
} from './readableResult';

const GROUP_LABELS: Record<ReadableResultGroupId, { key: string; defaultValue: string }> = {
  leftVentricle: {
    key: 'ProcessingReadableResultGroupLeftVentricle',
    defaultValue: 'Left ventricle',
  },
  rightVentricle: {
    key: 'ProcessingReadableResultGroupRightVentricle',
    defaultValue: 'Right ventricle',
  },
  leftAtrium: { key: 'ProcessingReadableResultGroupLeftAtrium', defaultValue: 'Left atrium' },
  rightAtrium: { key: 'ProcessingReadableResultGroupRightAtrium', defaultValue: 'Right atrium' },
  valves: { key: 'ProcessingReadableResultGroupValves', defaultValue: 'Valves' },
  other: { key: 'ProcessingReadableResultGroupOther', defaultValue: 'Other' },
};

// A shape next to the text, so an abnormal value is not marked by colour alone.
function AbnormalMark() {
  const { t } = useTranslation('StudyList');

  return (
    <span
      role="img"
      aria-label={t('ProcessingReadableResultAbnormal', { defaultValue: 'Flagged abnormal' })}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-black leading-none"
      data-testid="readable-model-result-abnormal-mark"
    >
      !
    </span>
  );
}

function QualifierBadge({ row }: { row: ReadableResultRow }) {
  if (!row.qualifier) {
    return null;
  }

  const abnormal = row.flag === 'abnormal';
  const className = abnormal
    ? 'border-2 border-[#ffb454] bg-[#3b2a12] font-bold text-[#ffd9a3]'
    : row.flag === 'normal'
      ? 'border border-white/20 text-[#c5cbc5]'
      : 'border border-[#78b7f5]/50 text-[#cfe5fb]';

  return (
    <span
      className={`ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 align-middle text-xs ${className}`}
      data-testid="readable-model-result-qualifier"
      data-flag={row.flag ?? 'none'}
    >
      {abnormal && <AbnormalMark />}
      {row.qualifier}
    </span>
  );
}

function ResultRow({ row }: { row: ReadableResultRow }) {
  const abnormal = row.flag === 'abnormal';

  return (
    <tr
      className={`border-b border-white/10 last:border-b-0 ${
        abnormal ? 'border-l-4 border-l-[#ffb454] bg-[#ffb454]/[0.06]' : ''
      }`}
      data-testid="readable-model-result-row"
      data-flag={row.flag ?? 'none'}
    >
      <th
        scope="row"
        className={`w-[55%] break-words py-2 pl-3 pr-4 text-left align-top text-sm ${
          abnormal ? 'font-bold text-white' : 'font-normal text-[#c5cbc5]'
        }`}
      >
        {row.label}
      </th>
      <td className="break-words py-2 pr-3 align-top text-sm text-white">
        <span className={abnormal ? 'font-bold' : undefined}>{row.value}</span>
        {/* A bare "Abnormal" value has no badge to carry the marker. */}
        {abnormal && !row.qualifier && (
          <span className="ml-2 text-[#ffd9a3]">
            <AbnormalMark />
          </span>
        )}
        <QualifierBadge row={row} />
      </td>
    </tr>
  );
}

export interface ReadableModelResultProps {
  readable: ReadableResult;
}

/** Tables for a flat result. Every value is rendered as text. */
export function ReadableModelResult({ readable }: ReadableModelResultProps) {
  const { t } = useTranslation('StudyList');

  return (
    <section
      aria-labelledby="readable-model-result-title"
      data-testid="readable-model-result"
    >
      <h3
        id="readable-model-result-title"
        className="mb-3 text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
      >
        {t('ProcessingModelResultData', { defaultValue: 'Result data' })}
      </h3>
      {readable.sections.map(section => (
        <div
          key={section.key ?? ''}
          className="mb-4 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]"
        >
          <table className="w-full table-fixed border-collapse">
            {section.key !== null && (
              <caption className="border-b border-white/10 px-3 py-2 text-left font-mono text-xs font-semibold text-[#9fa89f]">
                {section.key}
              </caption>
            )}
            <thead className="sr-only">
              <tr>
                <th scope="col">
                  {t('ProcessingReadableResultLabel', { defaultValue: 'Measurement' })}
                </th>
                <th scope="col">{t('ProcessingReadableResultValue', { defaultValue: 'Value' })}</th>
              </tr>
            </thead>
            {section.groups.map(group => (
              <tbody
                key={group.id ?? 'all'}
                data-testid="readable-model-result-group"
                data-group={group.id ?? 'all'}
              >
                {group.id !== null && (
                  <tr className="border-b border-white/10 bg-white/[0.05]">
                    <th
                      scope="rowgroup"
                      colSpan={2}
                      className="px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
                    >
                      {t(GROUP_LABELS[group.id].key, {
                        defaultValue: GROUP_LABELS[group.id].defaultValue,
                      })}
                    </th>
                  </tr>
                )}
                {group.rows.map((row, index) => (
                  <ResultRow
                    key={`${index}:${row.label}`}
                    row={row}
                  />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      ))}
      {readable.omittedKeys.length > 0 && (
        <p
          className="mb-3 text-xs font-semibold text-[#f8d84a]"
          role="note"
          data-testid="readable-model-result-omitted"
        >
          {t('ProcessingReadableResultOmitted', {
            fields: readable.omittedKeys.join(', '),
            defaultValue: 'Only in the raw data: {{fields}}.',
          })}
        </p>
      )}
      <p
        className="text-xs leading-5 text-[#9fa89f]"
        role="note"
        data-testid="readable-model-result-disclaimer"
      >
        {t('ProcessingReadableResultDisclaimer', {
          defaultValue:
            'Research use only. Values are shown as the model stored them, formatted automatically, and must be confirmed by image review before use.',
        })}
      </p>
    </section>
  );
}

export interface ReadableOrGenericModelResultProps {
  value: unknown;
}

/**
 * The display of a result without a model-specific renderer: readable tables
 * when the data is flat, with the generic tree one click away as raw data;
 * otherwise the generic tree alone.
 */
export function ReadableOrGenericModelResult({ value }: ReadableOrGenericModelResultProps) {
  const { t } = useTranslation('StudyList');
  const readable = useMemo(() => buildReadableResult(value), [value]);

  if (!readable) {
    return <GenericModelResult value={value} />;
  }

  return (
    <div>
      <ReadableModelResult readable={readable} />
      <details
        className="mt-4"
        data-testid="readable-model-result-raw"
      >
        <summary className="cursor-pointer select-none text-sm font-bold text-[#78b7f5] focus:outline-none focus:ring-2 focus:ring-[#78b7f5]">
          {t('ProcessingReadableResultRaw', { defaultValue: 'Raw data' })}
        </summary>
        <div className="mt-3">
          <GenericModelResult value={value} />
        </div>
      </details>
    </div>
  );
}

export default ReadableOrGenericModelResult;
