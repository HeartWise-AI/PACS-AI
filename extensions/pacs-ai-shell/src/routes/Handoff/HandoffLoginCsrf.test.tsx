import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import inferenceRepository from '@pacs-ai/extension-core/src/api/inferenceRepository';
import { HandoffSignIn } from './HandoffPage';
import { pacsAiSessionService } from '@pacs-ai/extension-core/src/services/PacsAiSessionService';
import pacsAPIAxios from '@pacs-ai/extension-core/src/pacsAPIAxios';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@pacs-ai/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Typography: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { variant?: string }) => <p {...props}>{children}</p>,
}));

// Obvious placeholders. Not credentials.
const VICTIM_SESSION = 'placeholder-victim-session';
const ATTACKER_SESSION = 'placeholder-attacker-session';
const VICTIM_TENANT = 'placeholder-victim-tenant';
const ATTACKER_TENANT = 'placeholder-attacker-tenant';
const HANDOFF_CODE = 'a'.repeat(43);
const API_ORIGIN = 'http://127.0.0.1';

type RecordedRequest = {
  path: string;
  authorization: string | null;
};

type MintedSession = {
  sessionToken: string;
  tenantId: string;
};

/**
 * POST /v1/iam/handoff/exchange as implemented by HandoffController.ExchangeHandoff:
 * the JSON object may contain only `code` (unknown fields are rejected), the
 * bearer header is not read, and a stored session code becomes that account's
 * session. Client IP is not a binding; it is not consulted here.
 */
function exchangeResult(body: string | undefined): {
  status: number;
  data: unknown;
  minted?: MintedSession;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body || '');
  } catch {
    return {
      status: 401,
      data: { success: false, message: 'invalid', data: { error: 'invalid_code' } },
    };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      status: 401,
      data: { success: false, message: 'invalid', data: { error: 'invalid_code' } },
    };
  }
  const fields = Object.keys(parsed as Record<string, unknown>);
  const code = (parsed as { code?: unknown }).code;
  if (
    fields.length !== 1 ||
    fields[0] !== 'code' ||
    typeof code !== 'string' ||
    code !== HANDOFF_CODE
  ) {
    return {
      status: 401,
      data: { success: false, message: 'invalid', data: { error: 'invalid_code' } },
    };
  }
  const minted = { sessionToken: ATTACKER_SESSION, tenantId: ATTACKER_TENANT };
  return {
    status: 200,
    minted,
    data: {
      success: true,
      message: 'Signed in.',
      data: { ...minted, returnPath: '/viewer?StudyInstanceUIDs=1.2.3' },
    },
  };
}

function requestPath(config: InternalAxiosRequestConfig): string {
  const url = config.url || '';
  const absolute = /^https?:\/\//.test(url)
    ? url
    : `${(config.baseURL || API_ORIGIN).replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  return new URL(absolute).pathname;
}

function authorizationHeader(config: InternalAxiosRequestConfig): string | null {
  const headers = config.headers;
  if (!headers) {
    return null;
  }
  const value =
    typeof headers.get === 'function'
      ? headers.get('Authorization')
      : (headers as { Authorization?: unknown }).Authorization;
  return value ? String(value) : null;
}

function userForSession(authorization: string | null) {
  const attacker = authorization === `Bearer ${ATTACKER_SESSION}`;
  return {
    id: attacker ? 'attacker' : 'victim',
    tenantId: attacker ? ATTACKER_TENANT : VICTIM_TENANT,
    role: 'USER',
    accessState: 'ACTIVE',
    name: attacker ? 'Attacker' : 'Victim',
    email: attacker ? 'attacker@example.org' : 'victim@example.org',
    licenseNo: '',
    specialty: '',
    isEmailVerified: true,
    isAccountDisabled: false,
    isConsentSigned: true,
    isAdminCreated: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

const requests: RecordedRequest[] = [];
const mintedSessions: MintedSession[] = [];
const storageWrites: Array<[string, string]> = [];
const storageRemovals: string[] = [];

function installAdapter() {
  axios.defaults.adapter = async config => {
    const path = requestPath(config);
    const authorization = authorizationHeader(config);
    requests.push({ path, authorization });
    const body = typeof config.data === 'string' ? config.data : JSON.stringify(config.data ?? '');
    let status = 200;
    let data: unknown = { success: true, message: 'ok', data: {} };

    if (path === '/v1/iam/handoff/exchange') {
      const result = exchangeResult(body);
      status = result.status;
      data = result.data;
      if (result.minted) {
        mintedSessions.push(result.minted);
      }
    } else if (path === '/v1/user/me') {
      data = { success: true, message: 'ok', data: userForSession(authorization) };
    } else if (path === '/v1/user/policies/status') {
      data = { success: true, message: 'ok', data: { acceptanceRequired: false } };
    } else if (path.startsWith('/v1/orchestrator/threads/') || path.startsWith('/v1/inference/')) {
      data = { success: true, message: 'ok', data: {} };
    } else {
      status = 404;
      data = { success: false, message: 'not found', data: {} };
    }

    const response = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 200 && status < 300) {
      return response;
    }
    return Promise.reject(
      new AxiosError('request failed', AxiosError.ERR_BAD_REQUEST, config, null, response)
    );
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

async function flush() {
  await new Promise(resolve => setTimeout(resolve, 20));
}

async function openAttackerHandoff() {
  window.history.replaceState(null, '', `/auth/handoff#code=${HANDOFF_CODE}`);
  render(
    <MemoryRouter initialEntries={['/auth/handoff']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <HandoffSignIn />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
  await flush();
  for (const button of screen.queryAllByRole('button')) {
    const label = button.textContent || '';
    if (/cancel/i.test(label)) {
      continue;
    }
    fireEvent.click(button);
  }
  await flush();
}

async function continueAsWhoeverIsStored() {
  await pacsAPIAxios().get('/v1/user/me');
  await orchestratorRepository
    .CreateMessage({ threadId: 'thread-1', message: 'placeholder question' })
    .catch(() => undefined);
  await inferenceRepository
    .UpdateModelFeedback({
      id: null,
      inferenceModelId: 'model-1',
      modelId: 'model-1',
      feedbackType: 'up',
      modelFeedbackAnswers: null,
    })
    .catch(() => undefined);
  await inferenceRepository
    .StartInferenceModelContainer({ containerID: 'container-1' })
    .catch(() => undefined);
  await inferenceRepository.StartInferenceIngestionJob({ id: 'job-1' }).catch(() => undefined);
}

function installedSession() {
  return {
    sessionToken: localStorage.getItem('sessionToken'),
    tenantId: localStorage.getItem('tenantId'),
    sessionsCreated: mintedSessions.map(session => session.sessionToken),
    sessionTokenWrites: storageWrites
      .filter(([key]) => key === 'sessionToken')
      .map(([, value]) => value),
    tenantWrites: storageWrites.filter(([key]) => key === 'tenantId').map(([, value]) => value),
    sessionTokenRemoved: storageRemovals.includes('sessionToken'),
    attackerBearerOn: requests
      .filter(request => (request.authorization || '').includes(ATTACKER_SESSION))
      .map(request => request.path),
    authorizationHeader: pacsAiSessionService.getAuthorizationHeader()?.Authorization ?? null,
  };
}

beforeEach(() => {
  requests.length = 0;
  mintedSessions.length = 0;
  storageWrites.length = 0;
  storageRemovals.length = 0;
  localStorage.clear();
  sessionStorage.clear();
  process.env.APP_PUBLIC_API_URL = API_ORIGIN;
  installAdapter();
  const setItem = Storage.prototype.setItem;
  const removeItem = Storage.prototype.removeItem;
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    storageWrites.push([String(key), String(value)]);
    return setItem.call(this, key, value);
  });
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
    storageRemovals.push(String(key));
    return removeItem.call(this, key);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

test('a handoff link does not replace the signed-in session when this browser did not start it', async () => {
  localStorage.setItem('sessionToken', VICTIM_SESSION);
  localStorage.setItem('tenantId', VICTIM_TENANT);
  storageWrites.length = 0;
  storageRemovals.length = 0;
  const openTab = pacsAPIAxios();

  await openAttackerHandoff();
  await openTab.get('/v1/user/me');
  await continueAsWhoeverIsStored();

  expect(installedSession()).toEqual({
    sessionToken: VICTIM_SESSION,
    tenantId: VICTIM_TENANT,
    sessionsCreated: [],
    sessionTokenWrites: [],
    tenantWrites: [],
    sessionTokenRemoved: false,
    attackerBearerOn: [],
    authorizationHeader: `Bearer ${VICTIM_SESSION}`,
  });
});

test('a handoff link does not sign in a signed-out visitor when this browser did not start it', async () => {
  const openTab = pacsAPIAxios();

  await openAttackerHandoff();
  await openTab.get('/v1/user/me');
  await continueAsWhoeverIsStored();

  expect(installedSession()).toEqual({
    sessionToken: null,
    tenantId: null,
    sessionsCreated: [],
    sessionTokenWrites: [],
    tenantWrites: [],
    sessionTokenRemoved: false,
    attackerBearerOn: [],
    authorizationHeader: null,
  });
});
