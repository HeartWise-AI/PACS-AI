import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useInferenceProcessing } from './InferenceProcessingProvider';
import { getInferenceNotificationPresentation } from './inferenceNotifications';
import { buildProcessingNotificationWorklistPath } from './processingNotificationNavigation';

function formatRelativeTime(timestamp: string) {
  const then = Date.parse(timestamp);
  if (!Number.isFinite(then)) {
    return 'Unknown time';
  }

  const diffMinutes = Math.round((then - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, 'day');
}

function statusClassName(tone: 'error' | 'info' | 'success') {
  if (tone === 'error') {
    return 'text-red-400';
  }
  if (tone === 'info') {
    return 'text-yellow-400';
  }
  return 'text-green-400';
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function InferenceNotificationsBell() {
  const { t } = useTranslation('StudyList');
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { notifications, unreadCount, canShowBell, markAllRead, isBellOpen, setBellOpen } =
    useInferenceProcessing();

  useEffect(() => {
    if (!isBellOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || !containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(target)) {
        setBellOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setBellOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBellOpen, setBellOpen]);

  if (!canShowBell) {
    return null;
  }

  const handleBellClick = () => {
    setBellOpen(!isBellOpen);
    if (!isBellOpen) {
      markAllRead();
    }
  };

  const handleItemClick = (studyInstanceUID: string) => {
    setBellOpen(false);
    navigate(buildProcessingNotificationWorklistPath(studyInstanceUID));
  };

  return (
    <div
      className="relative mr-3 flex items-center"
      ref={containerRef}
    >
      <button
        type="button"
        onClick={handleBellClick}
        className="relative inline-flex items-center justify-center rounded-lg bg-transparent p-2.5 text-white hover:text-white/80"
        aria-label={t('ProcessingNotificationsAriaLabel')}
        aria-expanded={isBellOpen}
        aria-haspopup="true"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="min-w-5 absolute -right-0.5 -top-0.5 flex h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isBellOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-lg border border-gray-600 bg-[#4C504B] shadow-xl">
          <div className="border-b border-gray-600 px-4 py-3">
            <p className="text-sm font-semibold text-white">{t('ProcessingNotificationsTitle')}</p>
            <p className="mt-0.5 text-xs text-white/60">
              {t('ProcessingNotificationsCount', { count: notifications.length })}
            </p>
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-4 py-3 text-sm text-white/60">
                {t('ProcessingNotificationsEmpty')}
              </div>
            )}

            {notifications.map(notification => (
              <button
                key={notification.deduplicationKey}
                type="button"
                onClick={() => handleItemClick(notification.studyInstanceUID)}
                className="block w-full border-b border-gray-600 px-4 py-3 text-left transition-colors hover:bg-gray-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {notification.patientName ?? t('ProcessingNotificationUnknownStudy')}
                    </p>
                    <p className="mt-0.5 text-xs text-white/60">
                      {notification.modalitiesInStudy ?? t('ProcessingNotificationUnknownModality')}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      {formatRelativeTime(notification.occurredAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-medium ${statusClassName(
                      getInferenceNotificationPresentation(notification).tone
                    )}`}
                  >
                    {t(getInferenceNotificationPresentation(notification).labelKey)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
