import userRepository from '../api/userRepository';
import {
  resetTutorialAndNotify,
  submitBeforeTutorialReset,
  TutorialResetInProgressError,
  TUTORIAL_RESET_EVENT,
} from './tutorialService';

jest.mock('../api/userRepository', () => ({
  __esModule: true,
  default: {
    ResetTutorial: jest.fn(),
    UpdateUserMetadata: jest.fn(),
  },
}));

const mockedUserRepository = userRepository as jest.Mocked<typeof userRepository>;

describe('resetTutorialAndNotify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes stored answers, notifies mounted UI, and resets persisted progress', async () => {
    mockedUserRepository.ResetTutorial.mockResolvedValue({ success: true } as never);
    mockedUserRepository.UpdateUserMetadata.mockResolvedValue({ success: true } as never);
    const listener = jest.fn();
    window.addEventListener(TUTORIAL_RESET_EVENT, listener);

    await resetTutorialAndNotify();

    expect(mockedUserRepository.ResetTutorial).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(mockedUserRepository.UpdateUserMetadata).toHaveBeenCalledWith({
      metadata: { tutorialProgressStep: 0 },
    });

    window.removeEventListener(TUTORIAL_RESET_EVENT, listener);
  });

  it('does not reset local or persisted progress when answer deletion fails', async () => {
    const failure = new Error('answer deletion failed');
    mockedUserRepository.ResetTutorial.mockRejectedValue(failure);
    const listener = jest.fn();
    window.addEventListener(TUTORIAL_RESET_EVENT, listener);

    await expect(resetTutorialAndNotify()).rejects.toBe(failure);

    expect(listener).not.toHaveBeenCalled();
    expect(mockedUserRepository.UpdateUserMetadata).not.toHaveBeenCalled();

    window.removeEventListener(TUTORIAL_RESET_EVENT, listener);
  });

  it('clears stale local answer state when deletion succeeds even if metadata reset fails', async () => {
    const failure = new Error('metadata update failed');
    mockedUserRepository.ResetTutorial.mockResolvedValue({ success: true } as never);
    mockedUserRepository.UpdateUserMetadata.mockRejectedValue(failure);
    const listener = jest.fn();
    window.addEventListener(TUTORIAL_RESET_EVENT, listener);

    await expect(resetTutorialAndNotify()).rejects.toBe(failure);

    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(TUTORIAL_RESET_EVENT, listener);
  });

  it('waits for an in-flight questionnaire submission before deleting answers', async () => {
    let finishSubmission: () => void;
    const submission = new Promise<void>(resolve => {
      finishSubmission = resolve;
    });
    const trackedSubmission = submitBeforeTutorialReset(() => submission);
    mockedUserRepository.ResetTutorial.mockResolvedValue({ success: true } as never);
    mockedUserRepository.UpdateUserMetadata.mockResolvedValue({ success: true } as never);

    const reset = resetTutorialAndNotify();
    await Promise.resolve();

    expect(mockedUserRepository.ResetTutorial).not.toHaveBeenCalled();

    finishSubmission();
    await trackedSubmission;
    await reset;

    expect(mockedUserRepository.ResetTutorial).toHaveBeenCalledTimes(1);
  });

  it('rejects a new questionnaire submission while reset is in progress', async () => {
    let finishSubmission: () => void;
    const submission = new Promise<void>(resolve => {
      finishSubmission = resolve;
    });
    const trackedSubmission = submitBeforeTutorialReset(() => submission);
    mockedUserRepository.ResetTutorial.mockResolvedValue({ success: true } as never);
    mockedUserRepository.UpdateUserMetadata.mockResolvedValue({ success: true } as never);

    const reset = resetTutorialAndNotify();
    const lateSubmit = jest.fn().mockResolvedValue(undefined);

    await expect(submitBeforeTutorialReset(lateSubmit)).rejects.toBeInstanceOf(
      TutorialResetInProgressError
    );
    expect(lateSubmit).not.toHaveBeenCalled();

    finishSubmission();
    await trackedSubmission;
    await reset;
  });
});
