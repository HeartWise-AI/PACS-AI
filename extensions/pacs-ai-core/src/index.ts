import { id } from './id';
import registerLocales from './locales/registerLocales';
import PacsAiAppProviders from './providers/PacsAiAppProviders';
import PacsAiModelsService from './services/PacsAiModelsService';
import PacsAiSessionService, { pacsAiSessionService } from './services/PacsAiSessionService';
import PacsAiStudyContextService from './services/PacsAiStudyContextService';

// Our translations go in when this module is imported, not in
// preRegistration: OHIF imports every extension (pluginImports loadModules)
// before it registers any, and registers them one by one in pluginConfig
// order. Extensions listed before us (default, measurement-tracking) read
// i18n.t('SidePanel:...') while registering, so preRegistration is too late.
registerLocales();

/**
 * PACS-AI core extension (docs/ohif-upgrade/PLAN.md 6.1): API client,
 * session, OHIF services and app providers, translations and the OHIF
 * compatibility adapter. Registered in platform/app/pluginConfig.json.
 */
const pacsAiCoreExtension = {
  id,

  preRegistration({ servicesManager, serviceProvidersManager }) {
    servicesManager.registerServices([
      PacsAiSessionService.REGISTRATION,
      PacsAiModelsService.REGISTRATION,
      PacsAiStudyContextService.REGISTRATION,
    ]);
    pacsAiSessionService.connectUserAuthenticationService(
      servicesManager.services.userAuthenticationService
    );
    // One composite provider keeps our providers' order explicit; OHIF keys
    // providers by service name.
    serviceProvidersManager.registerProvider(
      PacsAiSessionService.REGISTRATION.name,
      PacsAiAppProviders
    );
  },
};

export default pacsAiCoreExtension;
