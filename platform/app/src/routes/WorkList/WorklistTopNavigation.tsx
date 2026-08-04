import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import userRepository from '../../api/userRepository';
import tenantRepository from '../../api/tenantRepository';
import type { UserResponse } from '../../api/userDTO';
import type { GetTenantInfoResponse } from '../../api/tenantDTO';
import { logoutUser } from '../../service/userService';
import InferenceNotificationsBell from '../../components/inference/InferenceNotificationsBell';
import { useStudyProcessing } from '../../components/inference/studyProcessing';
import logoIcon from './../../assets/pacs/logo/pacs-ai-icon-logo.png';

export interface WorklistTopNavigationProps {
  fixturePreview: boolean;
}

export function WorklistTopNavigation({ fixturePreview }: WorklistTopNavigationProps) {
  const { t } = useTranslation('StudyList');
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [isMenuOpen, setMenuOpen] = useState(false);
  const { realtimeConnectionStatus } = useStudyProcessing();
  const tenantId = localStorage.getItem('tenantId') || '';

  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      try {
        const [userResponse, tenantResponse] = await Promise.all([
          userRepository.GetCurrentUser(),
          tenantRepository.GetTenantInfo(),
        ]);

        if (cancelled) {
          return;
        }

        setCurrentUser(userResponse.data);
        setTenantInfo(tenantResponse.data);

        if (
          !userResponse.data.isConsentSigned &&
          tenantResponse.data.onboardingEnableConsent !== false
        ) {
          navigate('/user/consent', { replace: true });
        }
      } catch {
        if (!cancelled) {
          logoutUser(navigate, tenantId);
        }
      }
    }

    loadIdentity();

    return () => {
      cancelled = true;
    };
  }, [navigate, tenantId]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const closeMenu = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', closeMenu, true);
    window.addEventListener('keydown', closeMenuOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeMenu, true);
      window.removeEventListener('keydown', closeMenuOnEscape);
    };
  }, [isMenuOpen]);

  const connectionIsHealthy = fixturePreview || realtimeConnectionStatus === 'connected';
  const connectionLabel = fixturePreview
    ? t('ProcessingFixtureConnected', { defaultValue: 'Fixture data connected' })
    : t('ProcessingLiveConnection', { defaultValue: 'Live · SSE connected' });
  const userName = currentUser?.name || t('ProcessingDefaultUser', { defaultValue: 'User' });
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center border-b border-white/10 bg-[#1b1f1a] px-7">
      <button
        type="button"
        className="flex items-center gap-3"
        onClick={() => navigate('/')}
        aria-label={t('Studies')}
      >
        <img
          src={logoIcon}
          alt=""
          className="h-8 w-8"
        />
        <span className="text-lg font-bold tracking-wide text-white">PACS-AI</span>
      </button>

      <div className="mx-5 h-6 w-px bg-white/15" />

      <nav
        className="flex items-center gap-7 text-sm"
        aria-label={t('ProcessingPrimaryNavigation', { defaultValue: 'Primary navigation' })}
      >
        <button
          type="button"
          className="font-medium text-white"
          onClick={() => navigate('/')}
        >
          {t('StudyList')}
        </button>
        <span
          className="cursor-not-allowed text-white/35"
          title={t('ProcessingViewerHint', {
            defaultValue: 'Select a study before opening the viewer.',
          })}
        >
          {t('BasicViewer')}
        </span>
        <button
          type="button"
          className="text-white/45 hover:text-white/80"
          onClick={() => navigate('/settings')}
        >
          {t('ProcessingSettings', { defaultValue: 'Settings' })}
        </button>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div
          className={`inline-flex h-[24px] items-center gap-2 rounded-full border px-3 text-xs font-semibold ${
            connectionIsHealthy
              ? 'border-[#4ade80]/35 bg-[#4ade80]/15 text-[#4ade80]'
              : 'border-[#facc15]/35 bg-[#facc15]/15 text-[#facc15]'
          }`}
          role="status"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connectionIsHealthy ? 'bg-[#4ade80]' : 'bg-[#facc15]'
            }`}
            aria-hidden="true"
          />
          {connectionLabel}
        </div>

        {fixturePreview && (
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[10px] text-white/50">
            realtimeWorklist
          </span>
        )}

        <InferenceNotificationsBell />

        <div
          className="relative"
          ref={menuRef}
        >
          <button
            type="button"
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
            onClick={() => setMenuOpen(previous => !previous)}
            aria-expanded={isMenuOpen}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#39413a] text-xs font-bold text-primary-main">
              {initials || 'U'}
            </span>
            <span className="hidden lg:block">
              <span className="block text-xs font-semibold text-white/90">{userName}</span>
              <span className="block text-[10px] text-white/40">{tenantInfo.name || tenantId}</span>
            </span>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-40 rounded-lg border border-white/10 bg-[#2a2e2a] p-1 shadow-xl">
              <button
                type="button"
                className="block w-full rounded px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                onClick={() => navigate('/settings')}
              >
                {t('ProcessingSettings', { defaultValue: 'Settings' })}
              </button>
              <button
                type="button"
                className="block w-full rounded px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                onClick={() => logoutUser(navigate, tenantId, false)}
              >
                {t('ProcessingLogout', { defaultValue: 'Logout' })}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default WorklistTopNavigation;
