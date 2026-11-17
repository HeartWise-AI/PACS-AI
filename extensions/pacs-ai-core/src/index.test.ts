import pacsAiCoreExtension from './index';
import PacsAiAppProviders from './providers/PacsAiAppProviders';
import { pacsAiSessionService } from './services/PacsAiSessionService';
import { pacsAiModelsService } from './services/PacsAiModelsService';
import { pacsAiStudyContextService } from './services/PacsAiStudyContextService';
import registerLocales from './locales/registerLocales';

jest.mock('./locales/registerLocales', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('./providers/PacsAiAppProviders', () => ({ __esModule: true, default: () => null }));

function createManagers() {
  const services: Record<string, unknown> = {
    userAuthenticationService: { setServiceImplementation: jest.fn() },
  };
  const servicesManager = {
    services,
    registerServices: jest.fn(registrations =>
      registrations.forEach(registration => {
        services[registration.name] = registration.create({});
      })
    ),
  };
  const serviceProvidersManager = { registerProvider: jest.fn() };
  return { servicesManager, serviceProvidersManager };
}

describe('@pacs-ai/extension-core preRegistration', () => {
  test('registers the services, the auth header, the providers and the locales', () => {
    const { servicesManager, serviceProvidersManager } = createManagers();

    pacsAiCoreExtension.preRegistration({ servicesManager, serviceProvidersManager } as never);

    expect(servicesManager.services.pacsAiSessionService).toBe(pacsAiSessionService);
    expect(servicesManager.services.pacsAiModelsService).toBe(pacsAiModelsService);
    expect(servicesManager.services.pacsAiStudyContextService).toBe(pacsAiStudyContextService);
    const { setServiceImplementation } = servicesManager.services
      .userAuthenticationService as { setServiceImplementation: jest.Mock };
    expect(setServiceImplementation).toHaveBeenCalledWith({
      getAuthorizationHeader: expect.any(Function),
    });
    expect(serviceProvidersManager.registerProvider).toHaveBeenCalledWith(
      'pacsAiSessionService',
      PacsAiAppProviders
    );
    expect(registerLocales).toHaveBeenCalled();
  });
});
