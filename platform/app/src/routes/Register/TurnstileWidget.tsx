import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const turnstileScriptId = 'cloudflare-turnstile-script';
const turnstileScriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  theme: 'dark';
  size: 'flexible';
  callback: (token: string) => void;
  'error-callback': () => boolean;
  'expired-callback': () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoadPromise: Promise<TurnstileApi> | null = null;

const loadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }
  if (turnstileLoadPromise) {
    return turnstileLoadPromise;
  }

  turnstileLoadPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const rejectAndRemoveScript = (message: string) => {
      document.getElementById(turnstileScriptId)?.remove();
      reject(new Error(message));
    };
    const handleLoad = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      rejectAndRemoveScript('Cloudflare Turnstile did not initialize');
    };
    const handleError = () => rejectAndRemoveScript('Cloudflare Turnstile failed to load');
    const existingScript = document.getElementById(turnstileScriptId) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = turnstileScriptId;
    script.src = turnstileScriptUrl;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  }).catch(error => {
    turnstileLoadPromise = null;
    throw error;
  });

  return turnstileLoadPromise;
};

type VerificationStatus = 'loading' | 'ready' | 'failed' | 'expired' | 'unavailable';

interface TurnstileWidgetProps {
  siteKey: string;
  resetKey: number;
  onTokenChange: (token: string | null) => void;
}

const TurnstileWidget = ({ siteKey, resetKey, onTokenChange }: TurnstileWidgetProps) => {
  const { t } = useTranslation('Onboarding');
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const apiRef = useRef<TurnstileApi | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>('loading');

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    let cancelled = false;
    let api: TurnstileApi | null = null;
    let widgetId: string | null = null;

    onTokenChangeRef.current(null);
    if (!siteKey) {
      setStatus('unavailable');
      return;
    }
    setStatus('loading');

    void loadTurnstile()
      .then(loadedApi => {
        if (cancelled || !containerRef.current) {
          return;
        }
        api = loadedApi;
        widgetId = loadedApi.render(containerRef.current, {
          sitekey: siteKey,
          action: 'register',
          theme: 'dark',
          size: 'flexible',
          callback: token => {
            setStatus('ready');
            onTokenChangeRef.current(token);
          },
          'error-callback': () => {
            setStatus('failed');
            onTokenChangeRef.current(null);
            return true;
          },
          'expired-callback': () => {
            setStatus('expired');
            onTokenChangeRef.current(null);
          },
        });
        apiRef.current = loadedApi;
        widgetIdRef.current = widgetId;
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('unavailable');
          onTokenChangeRef.current(null);
        }
      });

    return () => {
      cancelled = true;
      if (api && widgetId) {
        api.remove(widgetId);
      }
      if (apiRef.current === api && widgetIdRef.current === widgetId) {
        apiRef.current = null;
        widgetIdRef.current = null;
      }
    };
  }, [resetKey, siteKey]);

  const retryChallenge = () => {
    if (!apiRef.current || !widgetIdRef.current) {
      return;
    }

    onTokenChangeRef.current(null);
    setStatus('loading');
    apiRef.current.reset(widgetIdRef.current);
  };

  const statusMessage =
    status === 'failed'
      ? t('Registration verification failed. Please try again.')
      : status === 'expired'
        ? t('Registration verification expired. Please complete it again.')
        : status === 'unavailable'
          ? t('Registration verification is unavailable. Please try again later.')
          : null;

  return (
    <div
      className="mt-5"
      aria-label={t('Human verification')}
    >
      <div ref={containerRef} />
      {status === 'loading' && (
        <p
          className="mt-2 text-sm text-white text-opacity-70"
          role="status"
        >
          {t('Loading registration verification…')}
        </p>
      )}
      {statusMessage && (
        <div className="mt-2 text-sm text-red-300">
          <p role="alert">{statusMessage}</p>
          {(status === 'failed' || status === 'expired') && (
            <button
              type="button"
              className="focus:ring-primary mt-2 rounded underline underline-offset-2 focus:outline-none focus:ring-2"
              onClick={retryChallenge}
            >
              {t('Try verification again')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TurnstileWidget;
