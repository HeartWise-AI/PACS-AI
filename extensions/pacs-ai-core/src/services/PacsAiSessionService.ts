import { clearAuthenticatedSession } from '../utils/authenticatedSession';

const SESSION_TOKEN_KEY = 'sessionToken';
const TENANT_ID_KEY = 'tenantId';

type AuthorizationHeader = { Authorization: string };

type UserAuthenticationServiceLike = {
  setServiceImplementation: (implementation: {
    getAuthorizationHeader?: () => AuthorizationHeader | undefined;
    [name: string]: unknown;
  }) => void;
};

/** Marks a userAuthenticationService already connected to the session. */
const SESSION_AUTH_CONNECTED = '__pacsAiSessionAuthConnected';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

/**
 * OHIF service `pacsAiSessionService`: the PACS-AI session as the rest of the
 * viewer sees it. The token lives in localStorage (written by the login page);
 * this service only reads it, so every request picks up the current token.
 */
export default class PacsAiSessionService {
  public static REGISTRATION = {
    name: 'pacsAiSessionService',
    altName: 'PacsAiSessionService',
    create: () => pacsAiSessionService,
  };

  getSessionToken(): string | null {
    return readStorage(SESSION_TOKEN_KEY) || null;
  }

  getTenantId(): string {
    return readStorage(TENANT_ID_KEY) || '';
  }

  isAuthenticated(): boolean {
    return !!this.getSessionToken();
  }

  /**
   * Bearer header for DICOMweb and image requests (the DICOMweb proxy
   * authenticates with the PACS-AI session). Returns undefined without a
   * session, like OHIF's default implementation.
   */
  getAuthorizationHeader(): AuthorizationHeader | undefined {
    const token = this.getSessionToken();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }

  clearSession(): void {
    clearAuthenticatedSession();
  }

  /**
   * Makes OHIF's userAuthenticationService (used by the DICOMweb data source,
   * the image loader and display-set loading) send our bearer token.
   * Replaces the edits we used to carry in DicomWebDataSource/index.ts and
   * initWADOImageLoader.js.
   *
   * The session token stays authoritative: OHIF's Mode route replaces
   * getAuthorizationHeader with a fixed token when a viewer URL carries
   * `?token=` (updateAuthServiceAndCleanUrl), for the rest of the SPA
   * session. PACS-AI links never use `?token=`, so later
   * getAuthorizationHeader implementations are dropped; the other
   * implementations (getState, setUser, ...) pass through.
   */
  connectUserAuthenticationService(
    userAuthenticationService: UserAuthenticationServiceLike & { [SESSION_AUTH_CONNECTED]?: true }
  ): void {
    if (userAuthenticationService[SESSION_AUTH_CONNECTED]) {
      return;
    }
    const setServiceImplementation =
      userAuthenticationService.setServiceImplementation.bind(userAuthenticationService);
    setServiceImplementation({ getAuthorizationHeader: () => this.getAuthorizationHeader() });
    userAuthenticationService.setServiceImplementation = implementation => {
      const { getAuthorizationHeader, ...rest } = implementation || {};
      if (getAuthorizationHeader) {
        console.warn(
          'PACS-AI: ignoring a replacement getAuthorizationHeader (e.g. ?token=); the PACS-AI session token is used.'
        );
      }
      setServiceImplementation(rest);
    };
    userAuthenticationService[SESSION_AUTH_CONNECTED] = true;
  }
}

export const pacsAiSessionService = new PacsAiSessionService();
