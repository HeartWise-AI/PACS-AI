import React, { useEffect } from 'react';
import { useNotification } from '@ohif/ui-next';
import { startFrontendVersionMonitor } from '../utils/frontendVersionMonitor';

const UPDATE_NOTIFICATION_ID = 'frontend-update-available';

export default function FrontendUpdateMonitor() {
  const notification = useNotification();
  const showNotification = notification?.show;

  useEffect(() => {
    if (!showNotification) {
      return;
    }

    return startFrontendVersionMonitor({
      onUpdateAvailable: () => {
        showNotification({
          id: UPDATE_NOTIFICATION_ID,
          title: 'Update available',
          message: 'A new version of PACS-AI is available. Reload to update the application.',
          type: 'info',
          duration: Number.POSITIVE_INFINITY,
          action: {
            label: 'Reload',
            onClick: () => window.location.reload(),
          },
        });
      },
    });
  }, [showNotification]);

  return null;
}
