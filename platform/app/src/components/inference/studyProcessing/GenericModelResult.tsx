import React from 'react';
import { useTranslation } from 'react-i18next';

export const GENERIC_RESULT_MAX_DEPTH = 12;
export const GENERIC_RESULT_MAX_COLLECTION_ITEMS = 50;

export interface GenericModelResultProps {
  value: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function primitiveValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

function valueKind(value: unknown): string {
  if (Array.isArray(value)) {
    return `array · ${value.length}`;
  }
  if (isRecord(value)) {
    return `object · ${Object.keys(value).length}`;
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

interface ResultNodeProps {
  label: string;
  value: unknown;
  depth: number;
  path: string;
}

function ResultNode({ label, value, depth, path }: ResultNodeProps) {
  const { t } = useTranslation('StudyList');
  const arrayValue = Array.isArray(value) ? value : null;
  const objectValue = isRecord(value) ? value : null;
  const entries: Array<[string, unknown]> = arrayValue
    ? arrayValue.map((item, index) => [`[${index}]`, item])
    : objectValue
      ? Object.entries(objectValue)
      : [];
  const collection = Boolean(arrayValue || objectValue);

  if (!collection) {
    return (
      <div className="grid grid-cols-[minmax(9rem,0.45fr)_1fr] gap-4 border-b border-white/10 py-2.5 last:border-b-0">
        <div className="break-words font-mono text-xs font-semibold text-[#9fa89f]">{label}</div>
        <div className="min-w-0 whitespace-pre-wrap break-words font-mono text-sm text-white">
          {primitiveValue(value)}
        </div>
      </div>
    );
  }

  if (depth >= GENERIC_RESULT_MAX_DEPTH) {
    return (
      <div className="border-b border-white/10 py-3 last:border-b-0">
        <div className="font-mono text-xs font-semibold text-[#9fa89f]">{label}</div>
        <p className="mt-1 text-xs text-[#c5cbc5]">
          {t('ProcessingModelResultDepthLimit', {
            defaultValue: 'Additional nested data is hidden in the generic view.',
          })}
        </p>
      </div>
    );
  }

  const visibleEntries = entries.slice(0, GENERIC_RESULT_MAX_COLLECTION_ITEMS);
  const hiddenEntryCount = entries.length - visibleEntries.length;

  return (
    <details
      open={depth < 2}
      className="border-b border-white/10 py-2.5 last:border-b-0"
      data-testid="generic-model-result-collection"
    >
      <summary className="cursor-pointer select-none font-mono text-xs font-semibold text-[#78b7f5] focus:outline-none focus:ring-2 focus:ring-[#78b7f5]">
        {label}{' '}
        <span
          className="font-normal text-[#9fa89f]"
          aria-label={valueKind(value)}
        >
          ({valueKind(value)})
        </span>
      </summary>
      {entries.length === 0 ? (
        <p className="ml-4 mt-2 text-xs italic text-[#9fa89f]">
          {arrayValue
            ? t('ProcessingModelResultEmptyArray', { defaultValue: 'Empty array' })
            : t('ProcessingModelResultEmptyObject', { defaultValue: 'Empty object' })}
        </p>
      ) : (
        <div className="ml-4 mt-2 border-l border-white/10 pl-4">
          {visibleEntries.map(([entryLabel, entryValue]) => (
            <ResultNode
              key={`${path}/${entryLabel}`}
              label={entryLabel}
              value={entryValue}
              depth={depth + 1}
              path={`${path}/${entryLabel}`}
            />
          ))}
        </div>
      )}
      {hiddenEntryCount > 0 && (
        <p
          className="ml-4 mt-2 text-xs font-semibold text-[#f8d84a]"
          role="note"
          data-testid="generic-model-result-collection-limit"
        >
          {t('ProcessingModelResultCollectionLimit', {
            count: hiddenEntryCount,
            defaultValue: '{{count}} additional entries are not shown in the generic view.',
          })}
        </p>
      )}
    </details>
  );
}

export function GenericModelResult({ value }: GenericModelResultProps) {
  const { t } = useTranslation('StudyList');

  return (
    <section aria-labelledby="generic-model-result-title">
      <h3
        id="generic-model-result-title"
        className="mb-3 text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
      >
        {t('ProcessingModelResultData', { defaultValue: 'Result data' })}
      </h3>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4">
        <ResultNode
          label={t('ProcessingModelResultRoot', { defaultValue: 'result' })}
          value={value}
          depth={0}
          path="result"
        />
      </div>
    </section>
  );
}

export default GenericModelResult;
