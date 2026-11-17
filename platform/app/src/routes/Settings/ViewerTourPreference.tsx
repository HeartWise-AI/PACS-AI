import React, { useState } from 'react';
import { resetViewerTour } from '@pacs-ai/extension-core/src/service/viewerTourService';

type Props = {
  t: (key: string) => string;
  showAlert: (message: string, type: 'success' | 'error') => void;
};

/**
 * Settings > Preferences row that lets a user see the viewer onboarding tour
 * again on their next viewer open (the tour otherwise shows once per user).
 */
const ViewerTourPreference = ({ t, showAlert }: Props) => {
  const [isResetting, setIsResetting] = useState(false);

  const onReset = async () => {
    setIsResetting(true);
    try {
      await resetViewerTour();
      showAlert(t('The viewer tour will show the next time you open a study'), 'success');
    } catch (error) {
      showAlert(error?.message || t('Failed to reset the viewer tour'), 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="mt-5 flex items-center justify-between border-b border-white border-opacity-10 pb-5">
      <div>
        <h2 className="text-base font-light text-white">{t('Viewer tour')}</h2>
        <h2 className="text-sm text-white text-opacity-70">
          {t('Replay the viewer walkthrough the next time you open a study')}
        </h2>
      </div>
      <button
        type="button"
        data-testid="show-viewer-tour-again"
        className="text-primary focus:ring-0 disabled:opacity-50"
        disabled={isResetting}
        onClick={onReset}
      >
        <span className="relative z-10 bg-gradient-to-r from-[rgba(200,244,105,1)] to-[rgba(25,154,95,1)] bg-clip-text text-lg font-bold text-transparent">
          {isResetting ? '...' : t('Show the viewer tour again')}
        </span>
      </button>
    </div>
  );
};

export default ViewerTourPreference;
