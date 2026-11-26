import React, { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ViewerResultsRepository } from './viewerResultsRepository';
import {
  RUN_LABEL_MAX_LENGTH,
  normalizeRunLabel,
  runLabelSuggestions,
  sameRunLabel,
} from './viewerResultsModel';
import type { ViewerModelResult } from './types';

export interface ViewerRunLabelsProps {
  run: ViewerModelResult;
  repository: ViewerResultsRepository;
  canEdit: boolean;
  onLabelsChanged?: (run: ViewerModelResult, labels: string[]) => void;
}

/**
 * The labels of the run shown in the result drawer (PACS-447): chips, with a
 * remove button and an "Add label" field when the user may change them.
 * Labels are free text; the workspace's labels are offered as suggestions.
 */
export function ViewerRunLabels({
  run,
  repository,
  canEdit,
  onLabelsChanged,
}: ViewerRunLabelsProps) {
  const { t } = useTranslation('AIModelButton');
  const listId = useId();
  const labels = run.labels ?? [];
  const editable =
    canEdit && !!run.studyServiceJobId && !!repository.addRunLabel && !!repository.removeRunLabel;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceLabels, setWorkspaceLabels] = useState<string[]>([]);

  useEffect(() => {
    if (!editable || !repository.loadRunLabelSuggestions) {
      return;
    }
    let cancelled = false;
    repository
      .loadRunLabelSuggestions()
      .then(loaded => {
        if (!cancelled) {
          setWorkspaceLabels(loaded);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [editable, repository]);

  useEffect(() => {
    setDraft('');
    setError(null);
  }, [run.studyServiceJobId]);

  const change = async (operation: () => Promise<string[]>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await operation();
      onLabelsChanged?.(run, updated);
      return true;
    } catch (_error: unknown) {
      setError(t('ViewerRunLabelError', { defaultValue: 'The label could not be saved.' }));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const label = normalizeRunLabel(draft);
    if (!label) {
      setError(
        t('ViewerRunLabelInvalid', {
          max: RUN_LABEL_MAX_LENGTH,
          defaultValue: `A label has 1 to ${RUN_LABEL_MAX_LENGTH} characters.`,
        })
      );
      return;
    }
    if (labels.some(item => sameRunLabel(item, label))) {
      setDraft('');
      return;
    }
    if (await change(() => repository.addRunLabel!(run, label))) {
      setDraft('');
      setWorkspaceLabels(current =>
        current.some(item => sameRunLabel(item, label)) ? current : [label, ...current]
      );
    }
  };

  if (!labels.length && !editable) {
    return null;
  }

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-1.5 text-xs"
      data-testid="viewer-run-labels"
    >
      <span className="text-[#c5cbc5]">{t('ViewerRunLabels', { defaultValue: 'Labels' })}</span>
      {labels.map(label => (
        <span
          key={label}
          className="flex items-center gap-1 rounded-full border border-[#3ef1d1]/50 bg-[#3ef1d1]/10 px-2 py-0.5 font-semibold text-[#3ef1d1]"
          data-testid="viewer-run-label"
        >
          {label}
          {editable && (
            <button
              type="button"
              className="rounded-full px-1 leading-none text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-50"
              disabled={busy}
              aria-label={t('ViewerRunLabelRemove', {
                label,
                defaultValue: `Remove label ${label}`,
              })}
              title={t('ViewerRunLabelRemove', { label, defaultValue: `Remove label ${label}` })}
              onClick={() => void change(() => repository.removeRunLabel!(run, label))}
              data-testid="viewer-run-label-remove"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!labels.length && (
        <span className="text-[#c5cbc5]">{t('ViewerRunNoLabels', { defaultValue: 'None' })}</span>
      )}
      {editable && (
        <form
          className="flex items-center gap-1"
          onSubmit={event => {
            event.preventDefault();
            void add();
          }}
        >
          <input
            type="text"
            value={draft}
            maxLength={RUN_LABEL_MAX_LENGTH + 20}
            list={listId}
            disabled={busy}
            placeholder={t('ViewerRunLabelAdd', { defaultValue: 'Add label' })}
            aria-label={t('ViewerRunLabelAdd', { defaultValue: 'Add label' })}
            className="w-32 rounded border border-white/20 bg-black/30 px-2 py-0.5 text-white placeholder:text-white/40 focus:border-[#3ef1d1] focus:outline-none"
            onChange={event => {
              setDraft(event.target.value);
              setError(null);
            }}
            data-testid="viewer-run-label-input"
          />
          <datalist id={listId}>
            {runLabelSuggestions(workspaceLabels, labels).map(label => (
              <option
                key={label}
                value={label}
              />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="rounded border border-white/20 px-2 py-0.5 font-semibold text-white/80 hover:bg-white/10 disabled:opacity-40"
            data-testid="viewer-run-label-submit"
          >
            {t('ViewerRunLabelAddButton', { defaultValue: 'Add' })}
          </button>
        </form>
      )}
      {error && (
        <span
          role="alert"
          className="basis-full text-[#ffb0b0]"
        >
          {error}
        </span>
      )}
    </div>
  );
}

export default ViewerRunLabels;
