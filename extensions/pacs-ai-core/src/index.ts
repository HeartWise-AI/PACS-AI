import { id } from './id';
import registerLocales from './locales/registerLocales';
import PacsAiSessionService, { pacsAiSessionService } from './services/PacsAiSessionService';

/**
 * PACS-AI core extension (docs/ohif-upgrade/PLAN.md 6.1): API client,
 * session, OHIF services and app providers, translations and the OHIF
 * compatibility adapter. Registered in platform/app/pluginConfig.json.
 */
const pacsAiCoreExtension = {
  id,

  preRegistration({ servicesManager }) {
    servicesManager.registerService(PacsAiSessionService.REGISTRATION);
    pacsAiSessionService.connectUserAuthenticationService(
      servicesManager.services.userAuthenticationService
    );
    registerLocales();
  },
};

export default pacsAiCoreExtension;
