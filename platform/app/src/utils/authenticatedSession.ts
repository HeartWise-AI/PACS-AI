import { clearSubmittedWorklistSearch } from './worklistSearchSession';

export function clearAuthenticatedSession(): void {
  localStorage.removeItem('sessionToken');
  clearSubmittedWorklistSearch();
}
