import React, { useEffect, useRef, useState } from 'react';
import { toStudyOpenPath } from '@pacs-ai/extension-core/src/utils/viewerUrl';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button, Typography } from '@pacs-ai/ui';
import handoffRepository from '@pacs-ai/extension-core/src/api/handoffRepository';
import userRepository from '@pacs-ai/extension-core/src/api/userRepository';
import { navigateAfterAuth } from '@pacs-ai/extension-core/src/service/userService';
import { isSafeReturnPath } from '@pacs-ai/extension-core/src/service/policyAcceptanceSession';

/**
 * Sign-in handoff from CardioAgent (CA-268).
 *
 * /auth/handoff#code=…  trades the one-time code for a normal PACS-AI session,
 *                       then continues like a password login.
 * /auth/link#code=…     links the CardioAgent account to the signed-in PACS-AI
 *                       user after they confirm (sign-in first if needed).
 *
 * The code arrives in the fragment, which browsers never send to a server,
 * and is removed from the address bar before any request.
 */

export type HandoffMode = 'handoff' | 'link';

export const LINK_CODE_STORAGE_KEY = 'pacsAiHandoffLinkCode';
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const readFragmentCode = (hash: string): string | null => {
  const code = new URLSearchParams(hash.replace(/^#/, '')).get('code');
  return code && CODE_PATTERN.test(code) ? code : null;
};

const stripFragment = () => {
  if (window.location.hash) {
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search
    );
  }
};

// A study link (`/viewer?StudyInstanceUIDs=…`) goes through /open-study, which
// retrieves the study from the PACS when the local store no longer has it.
const safePath = (path?: string) =>
  path && isSafeReturnPath(path) ? toStudyOpenPath(path) : '/';

type Status = 'working' | 'confirm' | 'error';

interface HandoffPageProps {
  mode: HandoffMode;
}

export const HandoffPage = ({ mode }: HandoffPageProps) => {
  const { t } = useTranslation('Onboarding');
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('working');
  const [message, setMessage] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const started = useRef(false);

  const fail = (text: string) => {
    setMessage(text);
    setStatus('error');
  };

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    document.title = 'Signing in - PACS AI';
    const fragmentCode = readFragmentCode(window.location.hash);
    stripFragment();

    if (mode === 'handoff') {
      if (!fragmentCode) {
        fail(t('This sign-in link is not valid. Open PACS-AI again from CardioAgent.'));
        return;
      }
      (async () => {
        try {
          const session = await handoffRepository.Exchange(fragmentCode);
          localStorage.setItem('tenantId', session.tenantId);
          localStorage.setItem('sessionToken', session.sessionToken);
          const current = await userRepository.GetCurrentUser().catch(() => null);
          if (!current?.success || !current.data) {
            localStorage.removeItem('sessionToken');
            fail(t('Sign-in is temporarily unavailable. Please try again later.'));
            return;
          }
          await navigateAfterAuth(navigate, current.data, safePath(session.returnPath));
        } catch (error) {
          void error;
          fail(
            t(
              'This sign-in link has expired or was already used. Open PACS-AI again from CardioAgent.'
            )
          );
        }
      })();
      return;
    }

    // Link: keep the code across the sign-in page.
    if (fragmentCode) {
      sessionStorage.setItem(LINK_CODE_STORAGE_KEY, fragmentCode);
    }
    if (!sessionStorage.getItem(LINK_CODE_STORAGE_KEY)) {
      fail(t('This link is not valid. Open PACS-AI again from CardioAgent.'));
      return;
    }
    if (!localStorage.getItem('sessionToken')) {
      const search = new URLSearchParams();
      const tenantId = localStorage.getItem('tenantId') || process.env.APP_PUBLIC_DEFAULT_TENANT;
      if (tenantId) {
        search.set('t', tenantId);
      }
      search.set('returnTo', '/auth/link');
      navigate(`/login?${search.toString()}`, { replace: true });
      return;
    }
    (async () => {
      const current = await userRepository.GetCurrentUser().catch(() => null);
      if (!current?.success || !current.data) {
        // The session interceptor sends an expired session back to sign-in.
        fail(t('Sign in to PACS-AI to link your account.'));
        return;
      }
      setAccountEmail(current.data.email || '');
      setStatus('confirm');
    })();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = async () => {
    const code = sessionStorage.getItem(LINK_CODE_STORAGE_KEY);
    if (!code) {
      fail(t('This link is not valid. Open PACS-AI again from CardioAgent.'));
      return;
    }
    setIsLinking(true);
    try {
      const result = await handoffRepository.Link(code);
      sessionStorage.removeItem(LINK_CODE_STORAGE_KEY);
      navigate(safePath(result.returnPath), { replace: true });
    } catch (error) {
      sessionStorage.removeItem(LINK_CODE_STORAGE_KEY);
      const status = (error as { response?: { status?: number } })?.response?.status;
      fail(
        status === 403
          ? t(
              'Your CardioAgent account uses a different email than this PACS-AI account, so they cannot be linked.'
            )
          : t('This link has expired or was already used. Open PACS-AI again from CardioAgent.')
      );
    } finally {
      setIsLinking(false);
    }
  };

  const cancel = () => {
    sessionStorage.removeItem(LINK_CODE_STORAGE_KEY);
    navigate('/', { replace: true });
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black text-white">
      <div
        className="max-w-md space-y-4 p-6 text-center"
        data-testid="handoff-page"
      >
        {status === 'working' && (
          <Typography
            variant="h6"
            role="status"
          >
            {t('Signing in to PACS-AI…')}
          </Typography>
        )}
        {status === 'confirm' && (
          <>
            <Typography variant="h6">{t('Link your CardioAgent account')}</Typography>
            <Typography
              variant="body"
              data-testid="handoff-link-account"
            >
              {t(
                'After linking, "Open in PACS-AI" in CardioAgent signs you in to this PACS-AI account:'
              )}{' '}
              <strong>{accountEmail}</strong>
            </Typography>
            <div className="flex justify-center gap-3">
              <Button
                onClick={link}
                disabled={isLinking}
                data-testid="handoff-link-confirm"
              >
                {t('Link accounts')}
              </Button>
              <Button
                onClick={cancel}
                disabled={isLinking}
                data-testid="handoff-link-cancel"
              >
                {t('Cancel')}
              </Button>
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <Typography
              variant="body"
              role="alert"
            >
              {message}
            </Typography>
            <Button onClick={() => navigate('/', { replace: true })}>{t('Go to PACS-AI')}</Button>
          </>
        )}
      </div>
    </div>
  );
};

export const HandoffSignIn = () => <HandoffPage mode="handoff" />;
export const HandoffLink = () => <HandoffPage mode="link" />;
