const mockGetUserMetadata = jest.fn();
const mockUpdateUserMetadata = jest.fn();

jest.mock('../api/userRepository', () => ({
  __esModule: true,
  default: {
    GetUserMetadata: (...args: unknown[]) => mockGetUserMetadata(...args),
    UpdateUserMetadata: (...args: unknown[]) => mockUpdateUserMetadata(...args),
  },
}));

import {
  loadNotifyAutomaticRuns,
  NOTIFICATION_PREFERENCES_CHANGED_EVENT,
  readNotifyAutomaticRuns,
  saveNotifyAutomaticRuns,
} from './notificationPreferences';

describe('notification preferences', () => {
  beforeEach(() => {
    mockGetUserMetadata.mockReset();
    mockUpdateUserMetadata.mockReset();
  });

  test('only an explicit false mutes', () => {
    expect(readNotifyAutomaticRuns({ notifyAutomaticRuns: false })).toBe(false);
    expect(readNotifyAutomaticRuns({ notifyAutomaticRuns: true })).toBe(true);
    expect(readNotifyAutomaticRuns({ notifyAutomaticRuns: 'false' })).toBe(true);
    expect(readNotifyAutomaticRuns({ tutorialProgressStep: 2 })).toBe(true);
    expect(readNotifyAutomaticRuns(undefined)).toBe(true);
    expect(readNotifyAutomaticRuns(null)).toBe(true);
  });

  test('loads the stored preference and defaults to on', async () => {
    mockGetUserMetadata.mockResolvedValueOnce({
      data: { metadata: { notifyAutomaticRuns: false } },
    });
    await expect(loadNotifyAutomaticRuns()).resolves.toBe(false);

    mockGetUserMetadata.mockRejectedValueOnce({ errorCode: 'MISSING_RECORD' });
    await expect(loadNotifyAutomaticRuns()).resolves.toBe(true);
  });

  test('saves only its own key and announces the change at once', async () => {
    mockUpdateUserMetadata.mockResolvedValue({ success: true });
    const listener = jest.fn();
    window.addEventListener(NOTIFICATION_PREFERENCES_CHANGED_EVENT, listener);

    await saveNotifyAutomaticRuns(false);

    window.removeEventListener(NOTIFICATION_PREFERENCES_CHANGED_EVENT, listener);
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith({
      metadata: { notifyAutomaticRuns: false },
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      notifyAutomaticRuns: false,
    });
  });

  test('does not announce a change that failed to save', async () => {
    mockUpdateUserMetadata.mockRejectedValue(new Error('network'));
    const listener = jest.fn();
    window.addEventListener(NOTIFICATION_PREFERENCES_CHANGED_EVENT, listener);

    await expect(saveNotifyAutomaticRuns(true)).rejects.toThrow('network');

    window.removeEventListener(NOTIFICATION_PREFERENCES_CHANGED_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
  });
});
