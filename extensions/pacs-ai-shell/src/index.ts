// The work list's date range picker (react-dates) and our page styles. These
// were imported by platform/app/src/index.js and App.css before P2.3.
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import './styles/pacs-ai-shell.css';

import { id } from './id';
import { stopRouteErrorNotifications } from './errors/routeErrorNotifications';
import { getPacsAiRoutes } from './routes/pacsAiRoutes';

/**
 * PACS-AI shell extension (docs/ohif-upgrade/PLAN.md 6.1): our pages as
 * routes.customRoutes, the work list, top navigation, the viewer layout
 * template and the viewer tour gating. Registered in
 * platform/app/pluginConfig.json after @pacs-ai/extension-core.
 */
const pacsAiShellExtension = {
  id,

  preRegistration() {
    stopRouteErrorNotifications();
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
