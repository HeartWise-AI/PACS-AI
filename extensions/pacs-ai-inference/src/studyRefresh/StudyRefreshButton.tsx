import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  isStudyRefreshBusy,
  type StudyRefreshError,
  type StudyRefreshResult,
  type StudyRefreshState,
} from './useStudyRefresh';

export interface StudyRefreshButtonProps {
  state: StudyRefreshState;
  // The server still expects images for this study.
  growing?: boolean;
  onRefresh: () => void;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

const ERROR_LABELS: Record<StudyRefreshError, { key: string; defaultValue: string }> = {
  retrieveFailed: {
    key: 'RefreshStudyRetrieveFailed',
    defaultValue: 'Retrieval from the PACS failed',
  },
  retrieveTimedOut: {
    key: 'RefreshStudyRetrieveTimedOut',
    defaultValue: 'Retrieval from the PACS is taking too long',
  },
  reloadFailed: {
    key: 'RefreshStudyReloadFailed',
    defaultValue: 'The series could not be reloaded',
  },
};

/** "3 new series", "2 new images" or "Up to date". */
export function studyRefreshResultLabel(result: StudyRefreshResult, t: Translate): string {
  let label: string;
  if (result.newSeries === 1) {
    label = t('RefreshStudyNewSeriesOne', { defaultValue: '1 new series' });
  } else if (result.newSeries > 1) {
    label = t('RefreshStudyNewSeries', {
      count: result.newSeries,
      defaultValue: `${result.newSeries} new series`,
    });
  } else if (result.newImages === 1) {
    label = t('RefreshStudyNewImagesOne', { defaultValue: '1 new image' });
  } else if (result.newImages > 1) {
    label = t('RefreshStudyNewImages', {
      count: result.newImages,
      defaultValue: `${result.newImages} new images`,
    });
  } else {
    label = t('RefreshStudyUpToDate', { defaultValue: 'Up to date' });
  }
  return result.retrievedFromPACS
    ? label
    : `${label} · ${t('RefreshStudyLocalOnly', {
        defaultValue: 'local copy only (PACS source unknown)',
      })}`;
}

function statusLabel(state: StudyRefreshState, t: Translate): string | null {
  switch (state.phase) {
    case 'resolving':
      return t('RefreshStudyRetrieving', { defaultValue: 'Retrieving…' });
    case 'retrieving':
      return state.progress === null
        ? t('RefreshStudyRetrieving', { defaultValue: 'Retrieving…' })
        : t('RefreshStudyRetrievingProgress', {
            progress: state.progress,
            defaultValue: `Retrieving… ${state.progress}%`,
          });
    case 'reloading':
      return t('RefreshStudyReloading', { defaultValue: 'Loading series…' });
    case 'done':
      return state.result ? studyRefreshResultLabel(state.result, t) : null;
    case 'error': {
      const error = ERROR_LABELS[state.error ?? 'reloadFailed'];
      const message = t(error.key, { defaultValue: error.defaultValue });
      // A failed retrieval still reloads the local copy: say what that found.
      return state.result && state.result.newSeries + state.result.newImages > 0
        ? `${message} · ${studyRefreshResultLabel({ ...state.result, retrievedFromPACS: true }, t)}`
        : message;
    }
    default:
      return null;
  }
}

/**
 * The refresh control of the viewer's study browser header: an icon button
 * and, next to it, what the refresh is doing or what it changed.
 */
export function StudyRefreshButton({ state, growing = false, onRefresh }: StudyRefreshButtonProps) {
  const { t } = useTranslation('StudyBrowser');
  const busy = isStudyRefreshBusy(state.phase);
  const label = t('RefreshStudyFromPACS', { defaultValue: 'Refresh study from PACS' });
  const growingHint = t('RefreshStudyStillGrowing', {
    defaultValue: 'The exam is still in progress; new images may be available',
  });
  const status = statusLabel(state, t as Translate);
  const failed = state.phase === 'error';

  return (
    <span
      className="flex min-w-0 items-center gap-1.5"
      data-testid="study-refresh"
      data-phase={state.phase}
    >
      <button
        type="button"
        className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/80 hover:bg-white/10 hover:text-[#c8f469] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8f469] disabled:cursor-default disabled:hover:bg-transparent"
        aria-label={label}
        aria-busy={busy}
        title={growing && !busy ? `${label} — ${growingHint}` : label}
        disabled={busy}
        onClick={onRefresh}
        data-testid="study-refresh-button"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${busy ? 'animate-spin text-[#c8f469] motion-reduce:animate-none' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4" />
          <path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" />
        </svg>
        {growing && !busy && (
          <span
            className="absolute right-0 top-0 h-2 w-2 rounded-full border border-[#151815] bg-[#f8d84a]"
            aria-hidden="true"
            title={growingHint}
            data-testid="study-refresh-growing"
          />
        )}
      </button>
      {status && (
        <span
          role={failed ? 'alert' : 'status'}
          className={`min-w-0 truncate text-xs ${failed ? 'text-[#ffb0b0]' : 'text-[#c5cbc5]'}`}
          title={status}
          data-testid="study-refresh-status"
        >
          {status}
        </span>
      )}
    </span>
  );
}

export default StudyRefreshButton;
