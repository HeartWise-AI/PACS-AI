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
  studyInstanceUIDsFromSearch,
  studySearchKeepingOptions,
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
  const studyInstanceUIDs = studyInstanceUIDsFromSearch(params);
  const studiesKey = studyInstanceUIDs?.join(',') ?? '';
  // Viewer options of the link (modalitiesInStudy, studyDate, initial series
  // or instance, hanging protocol) go on to the viewer; patient keys never do.
  const viewerSearch = studyInstanceUIDs
    ? studySearchKeepingOptions(studyInstanceUIDs, location.search)
    : '';

  useEffect(() => {
    const uids = studiesKey ? studiesKey.split(',') : [];
    if (!uids.length) {
      setPhase({ status: 'failed', reason: 'missing' });
      return undefined;
    }
    let cancelled = false;
    setPhase({ status: 'working', percent: null });

    // Each study of the selection (usually one), in turn.
    const run = async () => {
      const handovers: Array<[string, string[]]> = [];
      for (let index = 0; index < uids.length; index++) {
        const outcome = await prepareStudyForViewer({
          studyInstanceUID: uids[index],
          repository: repositoryRef.current as OpenStudyRepository,
          onProgress: percent =>
            !cancelled &&
            setPhase({
              status: 'working',
              percent:
                percent === null ? null : Math.floor((index * 100 + percent) / uids.length),
            }),
          isCancelled: () => cancelled,
          // The viewer follows the series still arriving for the first study
          // only (study browser); the others are opened once complete.
          openOnFirstSeries: index === 0,
        });
        if (cancelled || outcome.status === 'cancelled') {
          return;
        }
        if (outcome.status === 'failed') {
          setPhase({ status: 'failed', reason: outcome.reason });
          return;
        }
        handovers.push([uids[index], outcome.remainingJobIds]);
      }
      // The viewer reloads the series still arriving (progressiveRetrieve).
      handovers.forEach(([uid, jobIds]) => rememberPendingRetrieve(uid, jobIds));
      markViewerStudyRetrieved(uids);
      navigate(`/viewer?${viewerSearch}`, { replace: true });
    };
    run().catch(() => !cancelled && setPhase({ status: 'failed', reason: 'retrieveFailed' }));
    return () => {
      cancelled = true;
    };
  }, [studiesKey, viewerSearch, attempt, navigate]);

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
