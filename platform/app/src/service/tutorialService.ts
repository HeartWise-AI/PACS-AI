import userRepository from '../api/userRepository';

export const TUTORIAL_RESET_EVENT = 'tutorial-reset';

const pendingModelQuestionnaireSubmissions = new Set<Promise<unknown>>();
let resetInProgress = false;
let activeReset: Promise<void> | null = null;

export class TutorialResetInProgressError extends Error {
  constructor() {
    super('Tutorial reset is in progress.');
    this.name = 'TutorialResetInProgressError';
  }
}

/**
 * Register a model-questionnaire submission so reset can wait for it to settle
 * before deleting answers. Submissions that begin after reset starts are
 * rejected before their API request is created.
 */
export async function submitBeforeTutorialReset<T>(submit: () => Promise<T>): Promise<T> {
  if (resetInProgress) {
    throw new TutorialResetInProgressError();
  }

  const submission = submit();
  pendingModelQuestionnaireSubmissions.add(submission);
  try {
    return await submission;
  } finally {
    pendingModelQuestionnaireSubmissions.delete(submission);
  }
}

/**
 * Reset server-side onboarding answers, clear matching in-memory UI state,
 * and reset persisted tutorial progress.
 *
 * The event is emitted immediately after the server confirms that answers
 * were deleted so mounted tutorial components cannot keep stale completion
 * state, even if the subsequent metadata update fails.
 */
export async function resetTutorialAndNotify(): Promise<void> {
  if (activeReset) {
    return activeReset;
  }

  resetInProgress = true;
  activeReset = (async () => {
    await Promise.allSettled(Array.from(pendingModelQuestionnaireSubmissions));
    await userRepository.ResetTutorial();
    window.dispatchEvent(new CustomEvent(TUTORIAL_RESET_EVENT));
    await userRepository.UpdateUserMetadata({ metadata: { tutorialProgressStep: 0 } });
  })();

  try {
    await activeReset;
  } finally {
    resetInProgress = false;
    activeReset = null;
  }
}
