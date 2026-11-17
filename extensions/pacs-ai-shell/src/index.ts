// The work list's date range picker (react-dates) and our page styles. These
// were imported by platform/app/src/index.js and App.css before P2.3.
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import './styles/pacs-ai-shell.css';

import { id } from './id';
import { stopRouteErrorNotifications } from './errors/routeErrorNotifications';
import getLayoutTemplateModule from './layout/getLayoutTemplateModule';
import { replaceDefaultViewerLayout } from './layout/replaceDefaultViewerLayout';
import PacsAiShellProviders from './providers/PacsAiShellProviders';
import { getPacsAiRoutes } from './routes/pacsAiRoutes';

/**
 * OHIF registers its own study list at `/` ahead of custom routes when
 * appConfig.showStudyList is on, and React Router then serves it instead of
 * ours. pacs-ai.js turns it off, but the served app-config.js can be replaced
 * at run time (the image's entrypoint writes APP_CONFIG into it), so the
 * shell, which provides `/`, turns it off itself. App.tsx reads the flag after
 * the extensions have registered.
 */
export function turnOffOhifStudyList(appConfig?: { showStudyList?: boolean }): void {
  if (!appConfig) {
    return;
  }
  if (appConfig.showStudyList !== false) {
    if (appConfig.showStudyList) {
      console.warn(
        'PACS-AI: showStudyList is on in the app config; turning it off so that `/` serves the PACS-AI work list.'
      );
    }
    appConfig.showStudyList = false;
  }
}

/** serviceProvidersManager key for the shell's app-wide UI (no service of that name). */
export const PACS_AI_SHELL_PROVIDER = 'pacsAiShell';

/**
 * PACS-AI shell extension (docs/ohif-upgrade/PLAN.md 6.1): our pages as
 * routes.customRoutes, the work list, top navigation, the viewer layout
 * template and the viewer tour gating. Registered in
 * platform/app/pluginConfig.json after @pacs-ai/extension-core (its
 * providers wrap ours) and after @ohif/extension-default (its layout
 * template is replaced in preRegistration).
 */
const pacsAiShellExtension = {
  id,

  preRegistration({
    servicesManager,
    serviceProvidersManager,
    extensionManager,
    commandsManager,
    hotkeysManager,
    appConfig,
  }) {
    stopRouteErrorNotifications();
    turnOffOhifStudyList(appConfig);
    serviceProvidersManager.registerProvider(PACS_AI_SHELL_PROVIDER, PacsAiShellProviders);

    // Until modes/pacs-ai exists (P2.6), the stock modes render our layout.
    const [viewerLayout] = getLayoutTemplateModule({
      servicesManager,
      extensionManager,
      commandsManager,
      hotkeysManager,
    });
    replaceDefaultViewerLayout(extensionManager, viewerLayout.component);
  },

  getLayoutTemplateModule,

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
