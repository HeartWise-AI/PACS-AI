import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  createOpenStudyRepository,
  prepareStudyForViewer,
  type OpenStudyFailure,
  type OpenStudyRepository,
} from '@pacs-ai/extension-inference/src/studyRefresh/openStudyRetrieve';
import { rememberPendingRetrieve } from '@pacs-ai/extension-inference/src/studyRefresh/progressiveRetrieve';
import {
  markViewerStudyRetrieved,
  studyInstanceUIDFromSearch,
  viewerPathForStudy,
} from '@pacs-ai/extension-core/src/utils/viewerUrl';

type Phase =
  | { status: 'working'; percent: number | null }
  | { status: 'failed'; reason: OpenStudyFailure | 'missing' };

export interface OpenStudyProps {
  // Tests inject the api-pacs calls.
  repository?: OpenStudyRepository;
}

const FAILURE_KEYS: Record<OpenStudyFailure | 'missing', string> = {
  missing: 'OpenStudyMissing',
  noSource: 'OpenStudyNoSource',
  retrieveFailed: 'OpenStudyRetrieveFailed',
  timedOut: 'OpenStudyTimedOut',
};

/**
 * `/open-study?StudyInstanceUIDs=…`: gets the study into the local store the
 * way the work list does (retrieve from the PACS, open once the first series
 * is stored), then replaces itself with the viewer. Links to a study from
 * anywhere in PACS-AI come here (see utils/viewerUrl studyOpenPath).
 */
export default function OpenStudy({ repository }: OpenStudyProps = {}) {
  const { t } = useTranslation('StudyList');
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>({ status: 'working', percent: null });
  const [attempt, setAttempt] = useState(0);
  const repositoryRef = useRef<OpenStudyRepository | null>(repository ?? null);
  if (!repositoryRef.current) {
    repositoryRef.current = createOpenStudyRepository();
  }

  const params = new URLSearchParams(location.search);
  const studyInstanceUID = studyInstanceUIDFromSearch(params);
  const modalitiesInStudy = params.get('modalitiesInStudy');
  const studyDate = params.get('studyDate');

  useEffect(() => {
    if (!studyInstanceUID) {
      setPhase({ status: 'failed', reason: 'missing' });
      return undefined;
    }
    let cancelled = false;
    setPhase({ status: 'working', percent: null });
    prepareStudyForViewer({
      studyInstanceUID,
      repository: repositoryRef.current as OpenStudyRepository,
      onProgress: percent => !cancelled && setPhase({ status: 'working', percent }),
      isCancelled: () => cancelled,
    }).then(
      outcome => {
        if (cancelled || outcome.status === 'cancelled') {
          return;
        }
        if (outcome.status === 'failed') {
          setPhase({ status: 'failed', reason: outcome.reason });
          return;
        }
        // The viewer reloads the series still arriving (progressiveRetrieve).
        rememberPendingRetrieve(studyInstanceUID, outcome.remainingJobIds);
        markViewerStudyRetrieved(studyInstanceUID);
        navigate(viewerPathForStudy(studyInstanceUID, { modalitiesInStudy, studyDate }), {
          replace: true,
        });
      },
      () => !cancelled && setPhase({ status: 'failed', reason: 'retrieveFailed' })
    );
    return () => {
      cancelled = true;
    };
  }, [studyInstanceUID, modalitiesInStudy, studyDate, attempt, navigate]);

  return (
    <div
      className="absolute flex h-full w-full items-center justify-center bg-black text-white"
      data-cy="open-study"
    >
      {phase.status === 'working' ? (
        <div
          className="flex w-80 flex-col items-center gap-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-base">{t('OpenStudyRetrieving')}</p>
          <div
            className="h-2 w-full overflow-hidden rounded bg-white/10"
            role="progressbar"
            aria-label={t('OpenStudyRetrieving')}
            aria-valuemin={0}
            aria-valuemax={100}
            {...(phase.percent !== null ? { 'aria-valuenow': phase.percent } : {})}
          >
            <div
              className={`h-full rounded bg-[#C8F469] ${phase.percent === null ? 'w-1/4 animate-pulse' : ''}`}
              style={phase.percent !== null ? { width: `${Math.max(4, phase.percent)}%` } : undefined}
            />
          </div>
          {phase.percent !== null && (
            <p
              className="text-sm text-white/60"
              data-cy="open-study-percent"
            >
              {phase.percent} %
            </p>
          )}
        </div>
      ) : (
        <div
          className="flex max-w-xl flex-col items-center gap-4 text-center"
          role="alert"
        >
          <h4>{t(FAILURE_KEYS[phase.reason])}</h4>
          <div className="flex gap-4">
            {phase.reason !== 'missing' && (
              <button
                type="button"
                className="rounded bg-[#C8F469] px-4 py-2 text-black"
                onClick={() => setAttempt(value => value + 1)}
              >
                {t('OpenStudyTryAgain')}
              </button>
            )}
            <Link
              className="text-primary px-4 py-2 underline"
              to="/"
            >
              {t('OpenStudyBackToList')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
