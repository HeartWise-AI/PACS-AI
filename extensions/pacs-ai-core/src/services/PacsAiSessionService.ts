import { clearAuthenticatedSession } from '../utils/authenticatedSession';

const SESSION_TOKEN_KEY = 'sessionToken';
const TENANT_ID_KEY = 'tenantId';

type AuthorizationHeader = { Authorization: string };

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
   */
  connectUserAuthenticationService(userAuthenticationService: {
    setServiceImplementation: (implementation: {
      getAuthorizationHeader: () => AuthorizationHeader | undefined;
    }) => void;
  }): void {
    userAuthenticationService.setServiceImplementation({
      getAuthorizationHeader: () => this.getAuthorizationHeader(),
    });
  }
}

export const pacsAiSessionService = new PacsAiSessionService();
