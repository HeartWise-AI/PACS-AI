import userRepository from '../api/userRepository';

export const TUTORIAL_RESET_EVENT = 'tutorial-reset';

/**
 * Reset server-side onboarding answers, clear matching in-memory UI state,
 * and reset persisted tutorial progress.
 *
 * The event is emitted immediately after the server confirms that answers
 * were deleted so mounted tutorial components cannot keep stale completion
 * state, even if the subsequent metadata update fails.
 */
export async function resetTutorialAndNotify(): Promise<void> {
  await userRepository.ResetTutorial();
  window.dispatchEvent(new CustomEvent(TUTORIAL_RESET_EVENT));
  await userRepository.UpdateUserMetadata({ metadata: { tutorialProgressStep: 0 } });
}
