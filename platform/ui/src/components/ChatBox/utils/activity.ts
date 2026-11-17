import type { ChatActivity, ChatActivityStep } from '../types';

type Translate = (key: string, options?: Record<string, unknown>) => string;

// Machine key of a step -> translation keys in the ChatBox namespace. `withModel`
// takes {{model}}; `plain` is used when the step carries no model name.
const STEP_TEMPLATES: Record<string, { withModel?: string; plain?: string }> = {
  delegate_angiogram: { plain: 'StepDelegateAngiogram' },
  delegate_echo: { plain: 'StepDelegateEcho' },
  delegate_ecg: { plain: 'StepDelegateEcg' },
  delegate_web: { plain: 'StepDelegateWeb' },
  delegate: { plain: 'StepDelegate' },
  model_result: { withModel: 'StepModelResult', plain: 'StepModelResultAny' },
  model_result_or_run: { withModel: 'StepModelResultOrRun' },
  run_model: { withModel: 'StepRunModel', plain: 'StepRunModelAny' },
  study_models: { plain: 'StepStudyModels' },
  all_model_results: { plain: 'StepAllModelResults' },
  coronary_findings: { plain: 'StepCoronaryFindings' },
  verify_study: { plain: 'StepVerifyStudy' },
  web_search: { plain: 'StepWebSearch' },
  web_read: { plain: 'StepWebRead' },
  read_reference: { plain: 'StepReadReference' },
  plan: { plain: 'StepPlan' },
  tool: { plain: 'StepTool' },
};

/**
 * Label of a step in the viewer's language: the template of its machine key
 * (with the model name when it has one), else the backend's English label.
 */
export function stepLabel(step: ChatActivityStep, t: Translate): string {
  const template = STEP_TEMPLATES[step.key];
  const model = typeof step.model === 'string' && step.model.trim() ? step.model.trim() : null;
  const key = model ? template?.withModel || template?.plain : template?.plain;
  if (!key) {
    return step.label;
  }
  const translated = t(key, { model, defaultValue: step.label });
  // A missing translation comes back as the key itself.
  return translated && translated !== key ? translated : step.label;
}

/** "<1 s", "12 s" or "1 min 5 s". */
export function formatDuration(milliseconds: number | null | undefined, t: Translate): string {
  if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds) || milliseconds < 0) {
    return '';
  }
  if (milliseconds < 1000) {
    return t('ActivityUnderOneSecond', { defaultValue: '<1 s' });
  }
  const totalSeconds = Math.round(milliseconds / 1000);
  if (totalSeconds < 60) {
    return t('ActivitySeconds', { seconds: totalSeconds, defaultValue: `${totalSeconds} s` });
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return t('ActivityMinutesSeconds', {
    minutes,
    seconds,
    defaultValue: `${minutes} min ${seconds} s`,
  });
}

/** Number shown in "Used N tools": tool calls, or every step when none is a tool. */
export function countTools(activity: ChatActivity): number {
  const tools = activity.steps.filter(step => step.kind !== 'delegation').length;
  return tools > 0 ? tools : activity.steps.length;
}

/** Total time of a finished request, from the server or from its steps. */
export function totalDuration(activity: ChatActivity): number | null {
  if (typeof activity.elapsed_ms === 'number' && activity.elapsed_ms >= 0) {
    return activity.elapsed_ms;
  }
  if (activity.started_at && activity.ended_at) {
    const elapsed = Date.parse(activity.ended_at) - Date.parse(activity.started_at);
    return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
  }
  return null;
}
