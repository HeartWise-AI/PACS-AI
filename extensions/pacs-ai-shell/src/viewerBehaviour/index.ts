import { applyPacsAiHotkeys } from './hotkeyBindings';
import { startCineAutoplay, stopCineAutoplay } from './cineAutoplay';
import { applyPacsAiCinePlayer } from './PacsAiCinePlayer';

export { withPacsAiHotkeys, applyPacsAiHotkeys } from './hotkeyBindings';
export {
  AUTOPLAY_MODALITIES,
  preferredFrameRate,
  startCineAutoplay,
  stopCineAutoplay,
} from './cineAutoplay';
export { default as PacsAiCinePlayer, applyPacsAiCinePlayer } from './PacsAiCinePlayer';
export {
  default as CurrentSeriesLabel,
  addCurrentSeriesLabel,
  CURRENT_SERIES_BUTTON_ID,
  CURRENT_SERIES_UI_TYPE,
} from './CurrentSeriesLabel';

/**
 * The PACS-AI viewer behaviour (F15) for the mode being entered: arrow keys
 * change the series and page keys the image, our cine player, and cine
 * autoplay for US and XA. Run from onModeEnter; safe to run twice for the
 * same mode (the second run changes nothing).
 */
export function enterPacsAiViewerBehaviour(servicesManager): void {
  const services = servicesManager?.services;
  if (!services) {
    return;
  }
  applyPacsAiHotkeys(services.customizationService);
  applyPacsAiCinePlayer(services.customizationService);
  startCineAutoplay(servicesManager);
}

/** Undoes enterPacsAiViewerBehaviour (the customizations end with the mode). */
export function exitPacsAiViewerBehaviour(servicesManager): void {
  stopCineAutoplay(servicesManager);
}
