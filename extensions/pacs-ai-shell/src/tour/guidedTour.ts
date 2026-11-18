import Shepherd from 'shepherd.js';
import type { Tour, TourOptions } from 'shepherd.js';

/**
 * Creates the Shepherd tour for one step of the tutorial checklist
 * (TutorialProgressOverlay).
 *
 * OHIF 3.13 dropped react-shepherd: App no longer mounts its
 * ShepherdJourneyProvider, so `useShepherd()` has no Shepherd to return and
 * the checklist tours never started. Like @ohif/ui-next's Onboarding, we use
 * the shepherd.js module directly (the single 15.x copy ui-next depends on);
 * Shepherd keeps the tour on screen in `Shepherd.activeTour`. A tour still
 * running there (the viewer tour or an earlier checklist step) is cancelled
 * first, so two modal overlays never stack.
 */
export function createGuidedTour(options: TourOptions): Tour {
  Shepherd.activeTour?.cancel();
  return new Shepherd.Tour(options);
}
