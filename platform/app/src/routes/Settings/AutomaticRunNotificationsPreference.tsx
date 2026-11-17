import React, { useEffect, useState } from 'react';
import OnboardingToggle from '../WorkspaceSettings/onboarding/components/OnboardingToggle';
import {
  loadNotifyAutomaticRuns,
  saveNotifyAutomaticRuns,
} from '@pacs-ai/extension-core/src/inferenceProcessing/notificationPreferences';

type Props = {
  t: (key: string) => string;
  showAlert: (message: string, type: 'success' | 'error') => void;
};

/**
 * Settings > Preferences row: the signed-in user's switch for notifications
 * (bell + toast) about automatic analyses. It never hides work-list status;
 * notifications about analyses the user launched are unaffected.
 */
const AutomaticRunNotificationsPreference = ({ t, showAlert }: Props) => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadNotifyAutomaticRuns().then(value => {
      if (!cancelled) {
        setEnabled(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = async (next: boolean) => {
    const previous = enabled;
    setEnabled(next);
    setIsSaving(true);
    try {
      await saveNotifyAutomaticRuns(next);
    } catch (error) {
      setEnabled(previous);
      showAlert(error?.message || t('Failed to save the notification preference'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-5 flex items-center justify-between border-b border-white border-opacity-10 pb-5">
      <div>
        <h2 className="text-base font-light text-white">
          {t('Notify me about automatic analyses')}
        </h2>
        <h2 className="text-sm text-white text-opacity-70">
          {t('Bell and pop-up notifications when an automatic analysis finishes')}
        </h2>
      </div>
      <OnboardingToggle
        id="notify-automatic-runs"
        testId="notify-automatic-runs"
        ariaLabel={t('Notify me about automatic analyses')}
        checked={enabled !== false}
        disabled={enabled === null || isSaving}
        onToggle={onToggle}
      />
    </div>
  );
};

export default AutomaticRunNotificationsPreference;
