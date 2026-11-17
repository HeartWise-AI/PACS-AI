import type { Translate } from './keyResults';
import type {
  PredictionCounts,
  PredictionExam,
  PredictionExecution,
  PredictionLauncher,
  PredictionModel,
  PredictionState,
} from './types';

const SHORT_LABELS: Record<string, string> = {
  deepcorojepa: 'JEPA',
  deepcorosyntax: 'SYNTAX',
  deepcorocto: 'CTO',
  deepcoromace: 'MACE',
  cathefclip: 'CathEF',
  deeprvclip: 'DeepRV',
  panecho: 'PanEcho',
  echoprime: 'EchoPrime',
};

/** Short chip label of a model: JEPA, SYNTAX, CathEF... */
export function shortModelLabel(modelName: string): string {
  const known = SHORT_LABELS[modelName.toLowerCase().replace(/[^a-z0-9]/g, '')];
  if (known) {
    return known;
  }
  const stripped = modelName.replace(/^DeepCORO[-_ ]?/i, '').replace(/[-_ ]?CLIP$/i, '');
  return stripped || modelName;
}

// Dark theme chip colours from the approved mock-up; every pair is above
// 4.5:1 and the state is always written out, never conveyed by colour alone.
export const STATE_CLASSES: Record<PredictionState, string> = {
  completed: 'bg-[#1F3A26] text-[#9BE7AE]',
  running: 'bg-[#1D3340] text-[#9AD3F0]',
  waiting: 'bg-[#2C2F3E] text-[#C3C9F2]',
  queued: 'bg-[#2C2F3E] text-[#C3C9F2]',
  failed: 'bg-[#40231C] text-[#FFB199]',
  skipped: 'bg-[#3A3320] text-[#F3C988]',
  cancelled: 'bg-[#2E2E2E] text-[#D2D2D2]',
  // Grey: these models will not run.
  stalled: 'bg-[#34362F] text-[#D6DAD2]',
  expired: 'bg-[#2A2A2A] text-[#BDBDBD]',
};

/** States of a model that may still produce a result. */
export const IN_PROGRESS_STATES: readonly PredictionState[] = ['waiting', 'queued', 'running'];

/**
 * Whether the exam has a model that may still produce a result. Stalled
 * models never ran and will not start by themselves, so an exam whose only
 * unfinished models are stalled is not in progress.
 */
export function examInProgress(exam: PredictionExam): boolean {
  return exam.active && exam.models.some(model => IN_PROGRESS_STATES.includes(model.state));
}

export function stateLabel(state: PredictionState, t: Translate): string {
  switch (state) {
    case 'completed':
      return t('Completed');
    case 'running':
      return t('Running');
    case 'waiting':
      return t('Waiting');
    case 'queued':
      return t('Queued');
    case 'failed':
      return t('Failed');
    case 'skipped':
      return t('Skipped');
    case 'cancelled':
      return t('Cancelled');
    case 'stalled':
      return t('Never ran');
    case 'expired':
      return t('Expired');
  }
}

export function formatElapsed(startedAt: string | null, now: number): string | null {
  const started = startedAt ? Date.parse(startedAt) : NaN;
  if (!Number.isFinite(started) || now < started) {
    return null;
  }
  const seconds = Math.floor((now - started) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

export interface ModelChip {
  key: string;
  state: PredictionState;
  text: string;
  label: string;
}

/** One chip per model, or a single "N of N ✓" chip when every model completed. */
export function examChips(exam: PredictionExam, now: number, t: Translate): ModelChip[] {
  const { models } = exam;
  if (models.length > 1 && models.every(model => model.state === 'completed')) {
    return [
      {
        key: 'all-completed',
        state: 'completed',
        text: t('{{completed}} of {{total}} ✓', { completed: models.length, total: models.length }),
        label: t('All {{total}} models completed', { total: models.length }),
      },
    ];
  }
  return models.map(model => {
    const short = shortModelLabel(model.modelName);
    let suffix: string;
    switch (model.state) {
      case 'completed':
        suffix = '✓';
        break;
      case 'running': {
        const elapsed = formatElapsed(model.startedAt, now);
        suffix = elapsed ? t('running {{elapsed}}', { elapsed }) : t('running');
        break;
      }
      case 'waiting':
        suffix = t('waiting');
        break;
      case 'queued':
        suffix = t('queued');
        break;
      case 'failed':
        suffix = t('failed');
        break;
      case 'skipped':
        suffix = t('skipped');
        break;
      case 'stalled':
        suffix = t('never ran');
        break;
      case 'expired':
        suffix = t('expired');
        break;
      default:
        suffix = t('cancelled');
    }
    return {
      key: model.executionId,
      state: model.state,
      text: `${short} ${suffix}`,
      label: t('{{model}} state {{state}}', {
        model: model.modelName,
        state: model.state === 'stalled' ? t('did not run') : stateLabel(model.state, t),
      }),
    };
  });
}

/** "4 completed · 1 waiting · 1 failed" (queued models count as waiting). */
export function countsLine(counts: PredictionCounts, t: Translate): string {
  const parts: string[] = [];
  const push = (value: number, key: string) => {
    if (value > 0) {
      parts.push(t(key, { count: value }));
    }
  };
  push(counts.completed, '{{count}} completed');
  push(counts.running, '{{count}} running');
  push(counts.waiting + counts.queued, '{{count}} waiting');
  push(counts.failed, '{{count}} failed');
  push(counts.skipped, '{{count}} skipped');
  push(counts.cancelled, '{{count}} cancelled');
  push(counts.stalled ?? 0, '{{count}} never ran');
  push(counts.expired ?? 0, '{{count}} expired');
  return parts.join(' · ');
}

export function launcherName(
  launcher: Pick<PredictionLauncher, 'kind' | 'name' | 'you'>,
  t: Translate
): string {
  if (launcher.kind === 'automatic') {
    return t('Automatic');
  }
  if (launcher.you) {
    return t('You');
  }
  return launcher.name ?? t('Another user');
}

export function executionLauncherName(execution: PredictionExecution, t: Translate): string {
  if (!execution.requestedByUserId) {
    return t('Automatic');
  }
  if (execution.requestedByYou) {
    return t('You');
  }
  return execution.requestedByName ?? t('Another user');
}

export function triggerOrigin(trigger: string, t: Translate): string | null {
  switch (trigger) {
    case 'VIEWER_REQUEST':
      return t('from the viewer');
    case 'MANUAL_REPROCESS':
      return t('from the work list');
    case 'LEGACY_IMPORT':
      return t('imported');
    default:
      return null;
  }
}

export interface LaunchedBySummary {
  primary: string;
  detail: string | null;
}

/** "Automatic" + "+ Dr X (1 rerun)", or "Dr X" + "from the viewer". */
export function launchedBySummary(
  launchers: PredictionLauncher[],
  t: Translate
): LaunchedBySummary {
  if (!launchers.length) {
    return { primary: '—', detail: null };
  }
  const [first, ...others] = launchers;
  const primary = launcherName(first, t);
  if (!others.length) {
    return {
      primary,
      detail: first.kind === 'automatic' ? t('on arrival') : triggerOrigin(first.trigger, t),
    };
  }
  const reruns = others.reduce((total, launcher) => total + launcher.runs, 0);
  const people = [...new Set(others.map(launcher => launcherName(launcher, t)))];
  const who = people.length === 1 ? people[0] : t('{{count}} others', { count: people.length });
  return {
    primary,
    detail:
      reruns === 1
        ? t('+ {{who}} (1 rerun)', { who })
        : t('+ {{who}} ({{count}} reruns)', { who, count: reruns }),
  };
}

export function failureReason(execution: PredictionExecution, t: Translate): string | null {
  const parts: string[] = [];
  if (execution.skipReason) {
    parts.push(execution.skipReason.message ?? skipReasonLabel(execution.skipReason.code, t));
  }
  if (execution.errorMessage && execution.state !== 'completed') {
    parts.push(execution.errorMessage);
  }
  return parts.length ? parts.join(' — ') : null;
}

export function skipReasonLabel(code: string, t: Translate): string {
  switch (code) {
    case 'NO_USABLE_DICOM':
      return t('No usable images in the exam');
    case 'UNSUPPORTED_MODALITY':
      return t('The exam modality is not supported by this model');
    case 'REQUIRED_SERIES_MISSING':
      return t('The images this model needs are missing');
    case 'MODEL_NOT_APPLICABLE':
      return t('The model does not apply to this exam');
    case 'PREREQUISITE_NOT_MET':
      return t('A prerequisite of this model was not met');
    case 'MODEL_DISABLED':
      return t('The model is disabled');
    case 'EXPIRED_NEVER_RAN':
      return t('Closed automatically because it did not complete in time');
    default:
      return code;
  }
}

/** What the key result column says when a run has no result. */
export function noResultText(execution: PredictionExecution, t: Translate): string {
  switch (execution.state) {
    case 'waiting':
      return t('Exam still receiving images');
    case 'queued':
      return t('Queued');
    case 'running':
      return t('Running…');
    case 'cancelled':
      return t('No result. Cancelled');
    case 'stalled':
      return t('No result. It never ran');
    default: {
      const reason = failureReason(execution, t);
      return reason ? t('No result. {{reason}}', { reason }) : t('No result.');
    }
  }
}

export function canRunAgain(model: PredictionModel): boolean {
  return model.state === 'failed' || model.state === 'skipped' || model.state === 'cancelled';
}

export function formatDateTime(value: string, locale?: string): { time: string; date: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { time: '—', date: '' };
  }
  return {
    time: date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    date: date.toLocaleDateString(locale),
  };
}

/** DICOM person names use ^ between components. */
export function readablePersonName(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const readable = value
    .split('^')
    .map(part => part.trim())
    .filter(Boolean)
    .join(' ');
  return readable || null;
}
