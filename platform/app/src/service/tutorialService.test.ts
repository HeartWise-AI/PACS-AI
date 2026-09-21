import userRepository from '../api/userRepository';
import { resetTutorialAndNotify, TUTORIAL_RESET_EVENT } from './tutorialService';

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
});
