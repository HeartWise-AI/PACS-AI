import userRepository from '../../api/userRepository';

/** User metadata key of the personal automatic-run notification switch. */
export const NOTIFY_AUTOMATIC_RUNS_METADATA_KEY = 'notifyAutomaticRuns';

/** Fired on window when the signed-in user changes a notification preference. */
export const NOTIFICATION_PREFERENCES_CHANGED_EVENT = 'pacs:notification-preferences-changed';

export interface NotificationPreferencesChangedDetail {
  notifyAutomaticRuns: boolean;
}

/** Only an explicit false mutes; a missing or unreadable value keeps notifications on. */
export function readNotifyAutomaticRuns(metadata: unknown): boolean {
  if (typeof metadata !== 'object' || metadata === null) {
    return true;
  }
  return (metadata as Record<string, unknown>)[NOTIFY_AUTOMATIC_RUNS_METADATA_KEY] !== false;
}

/** Reads the signed-in user's preference; a user without metadata is not muted. */
export async function loadNotifyAutomaticRuns(): Promise<boolean> {
  try {
    const response = await userRepository.GetUserMetadata();
    return readNotifyAutomaticRuns(response?.data?.metadata);
    // A named binding: the test Babel setup cannot compile `catch {}` in async code.
  } catch (error: unknown) {
    return true;
  }
}

/**
 * Saves the preference and applies it at once to this browser's
 * notifications. The gateway applies it to its own filtering when the live
 * stream next reconnects.
 */
export async function saveNotifyAutomaticRuns(notifyAutomaticRuns: boolean): Promise<void> {
  await userRepository.UpdateUserMetadata({
    metadata: { [NOTIFY_AUTOMATIC_RUNS_METADATA_KEY]: notifyAutomaticRuns },
  });
  window.dispatchEvent(
    new CustomEvent<NotificationPreferencesChangedDetail>(NOTIFICATION_PREFERENCES_CHANGED_EVENT, {
      detail: { notifyAutomaticRuns },
    })
  );
}
