import { markTourShown, shouldShowTour } from '@pacs-ai/extension-core/src/service/viewerTourService';

export type TourDefinition = {
  id: string;
  route: string;
  [key: string]: unknown;
};

/**
 * Local "tour shown" list that @ohif/ui-next's Onboarding reads before it
 * starts a tour (platform/ui-next/src/components/Onboarding/utilities.ts).
 */
const ONBOARDING_SHOWN_TOURS_KEY = 'shownTours';

function forgetLocallyShown(tourId: string): void {
  try {
    const list = JSON.parse(localStorage.getItem(ONBOARDING_SHOWN_TOURS_KEY) || '[]');
    if (Array.isArray(list) && list.includes(tourId)) {
      localStorage.setItem(
        ONBOARDING_SHOWN_TOURS_KEY,
        JSON.stringify(list.filter(item => item !== tourId))
      );
    }
  } catch (error) {
    // storage unavailable: Onboarding then sees no local flag either
  }
}

/**
 * The tours to hand to Onboarding: those the server (viewer tour) or the local
 * flag (other tours) says this user has not seen. Never rejects.
 *
 * shouldShowTour can answer "show" while this device still has the local
 * flag (the user asked for the tour again in Settings on another device), and
 * Onboarding skips tours with the local flag, so the flag is cleared for every
 * tour returned.
 */
export async function getUnseenTours<T extends TourDefinition>(tours: T[] = []): Promise<T[]> {
  const decisions = await Promise.all(
    tours.map(tour => shouldShowTour(tour.id).catch(() => false))
  );
  const unseen = tours.filter((_tour, index) => decisions[index]);
  unseen.forEach(tour => forgetLocallyShown(tour.id));
  return unseen;
}

/** Record on the server (and locally) that a tour has started. Never rejects. */
export function markToursStarted(tours: TourDefinition[], pathname: string): void {
  tours
    .filter(tour => tour.route === pathname)
    .forEach(tour => {
      markTourShown(tour.id);
    });
}
