jest.mock('./hotkeyBindings', () => ({ applyPacsAiHotkeys: jest.fn() }));
jest.mock('./cineAutoplay', () => ({ startCineAutoplay: jest.fn(), stopCineAutoplay: jest.fn() }));
jest.mock('./PacsAiCinePlayer', () => ({ __esModule: true, default: () => null, applyPacsAiCinePlayer: jest.fn() }));
jest.mock('./CurrentSeriesLabel', () => ({ __esModule: true, default: () => null }));

import { enterPacsAiViewerBehaviour, exitPacsAiViewerBehaviour } from './index';
import { applyPacsAiHotkeys } from './hotkeyBindings';
import { startCineAutoplay, stopCineAutoplay } from './cineAutoplay';
import { applyPacsAiCinePlayer } from './PacsAiCinePlayer';

describe('PACS-AI viewer behaviour', () => {
  test('entering a mode sets the keys, the cine player and cine autoplay', () => {
    const customizationService = {};
    const servicesManager = { services: { customizationService } };
    enterPacsAiViewerBehaviour(servicesManager);
    expect(applyPacsAiHotkeys).toHaveBeenCalledWith(customizationService);
    expect(applyPacsAiCinePlayer).toHaveBeenCalledWith(customizationService);
    expect(startCineAutoplay).toHaveBeenCalledWith(servicesManager);
  });

  test('leaving a mode stops cine autoplay', () => {
    const servicesManager = { services: {} };
    exitPacsAiViewerBehaviour(servicesManager);
    expect(stopCineAutoplay).toHaveBeenCalledWith(servicesManager);
  });

  test('does nothing without services', () => {
    (startCineAutoplay as jest.Mock).mockClear();
    enterPacsAiViewerBehaviour(undefined);
    expect(startCineAutoplay).not.toHaveBeenCalled();
  });
});
