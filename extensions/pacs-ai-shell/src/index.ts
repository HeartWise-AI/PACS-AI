// The work list's date range picker (react-dates) and our page styles. These
// were imported by platform/app/src/index.js and App.css before P2.3.
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import './styles/pacs-ai-shell.css';

import { id } from './id';
import { stopRouteErrorNotifications } from './errors/routeErrorNotifications';
import PacsAiShellProviders from './providers/PacsAiShellProviders';
import { getPacsAiRoutes } from './routes/pacsAiRoutes';

/** serviceProvidersManager key for the shell's app-wide UI (no service of that name). */
export const PACS_AI_SHELL_PROVIDER = 'pacsAiShell';

/**
 * PACS-AI shell extension (docs/ohif-upgrade/PLAN.md 6.1): our pages as
 * routes.customRoutes, the work list, top navigation, the viewer layout
 * template and the viewer tour gating. Registered in
 * platform/app/pluginConfig.json after @pacs-ai/extension-core (its
 * providers wrap ours).
 */
const pacsAiShellExtension = {
  id,

  preRegistration({ serviceProvidersManager }) {
    stopRouteErrorNotifications();
    serviceProvidersManager.registerProvider(PACS_AI_SHELL_PROVIDER, PacsAiShellProviders);
  },

  getCustomizationModule() {
    return [
      {
        name: 'global',
        value: {
          'routes.customRoutes': {
            routes: getPacsAiRoutes(),
            notFoundRoute: null,
          },
        },
      },
    ];
  },
};

export default pacsAiShellExtension;
