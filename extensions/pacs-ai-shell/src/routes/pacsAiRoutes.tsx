import React from 'react';
import WorkList from '../worklist';
import Login from './Login';
import Register from './Register';
import PolicyAcceptance from './PolicyAcceptance';
import UserConsent from './User/Consent';
import ChangePassword from './ChangePassword';
import ResetPassword from './ResetPassword';
import AIModels from './AIModels';
import AiPredictions from './AiPredictions';
import Members from './Members';
import KibanaLogs from './KibanaLogs';
import Settings from './Settings';
import TenantNotFound from './TenantNotFound';
import WorkspaceSettings from './WorkspaceSettings';
import NotFoundStudy from './NotFoundStudy';
import PacsAiErrorBoundary from '../components/PacsAiErrorBoundary';

export type PacsAiRoute = {
  path: string;
  children: React.ComponentType;
  private?: boolean;
};

/**
 * One route element: the page inside our error boundary (no OHIF error
 * notification). Pages take no
 * props; they used to be rendered through OHIF's DataSourceWrapper, whose
 * study query and data-source props none of them used.
 */
function pacsAiRoute(path: string, Page: React.ComponentType, isPrivate = true): PacsAiRoute {
  function PacsAiRouteElement() {
    return (
      <PacsAiErrorBoundary context={`Route ${path}`}>
        <Page />
      </PacsAiErrorBoundary>
    );
  }
  PacsAiRouteElement.displayName = `PacsAiRoute(${path})`;
  return { path, children: PacsAiRouteElement, private: isPrivate };
}

/**
 * Our pages, registered as the `routes.customRoutes` customization. OHIF's
 * routes/index.tsx renders them with the same wrapper as its own routes:
 * `private: true` puts them behind PrivateRoute (OHIF's user authentication
 * service; PACS-AI does not enable it, sign-in is handled by our session and
 * API interceptors as before), and RouteWithErrorBoundary.
 *
 * `/` replaces OHIF's study list, which pacs-ai.js turns off
 * (showStudyList: false) so that OHIF does not register its own `/` first.
 * `/notfoundstudy` replaces OHIF's page of the same path (custom routes are
 * matched before OHIF's built-in ones).
 */
export function getPacsAiRoutes(): PacsAiRoute[] {
  return [
    pacsAiRoute('/', WorkList),
    pacsAiRoute('/login', Login),
    pacsAiRoute('/register', Register),
    pacsAiRoute('/policies/accept', PolicyAcceptance),
    pacsAiRoute('/user/consent', UserConsent),
    pacsAiRoute('/change-password', ChangePassword),
    pacsAiRoute('/reset-password', ResetPassword),
    pacsAiRoute('/ai-models', AIModels),
    pacsAiRoute('/ai-predictions', AiPredictions),
    pacsAiRoute('/admin/members', Members),
    pacsAiRoute('/admin/workspace-settings', WorkspaceSettings),
    pacsAiRoute('/admin/kibana-logs', KibanaLogs),
    pacsAiRoute('/settings', Settings),
    pacsAiRoute('/tenantnotfound', TenantNotFound, false),
    pacsAiRoute('/notfoundstudy', NotFoundStudy, false),
  ];
}
