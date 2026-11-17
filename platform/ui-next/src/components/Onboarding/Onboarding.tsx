import { useEffect, useRef } from 'react';
import { useShepherd } from 'react-shepherd';
import { StepOptions, TourOptions } from 'shepherd.js';
import { useLocation } from 'react-router';
import 'shepherd.js/dist/css/shepherd.css';
import './Onboarding.css';

import { hasTourBeenShown, markTourAsShown, defaultShowHandler, middleware } from './utilities';

type TourDefinition = {
  id: string;
  route: string;
  tourOptions: TourOptions;
  steps: StepOptions[];
};

const defaultShouldShowTour = (tourId: string) => !hasTourBeenShown(tourId);

const Onboarding = ({
  tours = [],
  shouldShowTour = defaultShouldShowTour,
  onTourShown = markTourAsShown,
}: {
  tours?: TourDefinition[];
  /**
   * Decides whether a tour starts. May be async (e.g. a server-side per-user
   * flag); a rejection falls back to the local "shown" flag. Defaults to the
   * local flag only.
   */
  shouldShowTour?: (tourId: string) => boolean | Promise<boolean>;
  /** Called once a tour has started. Defaults to recording the local flag. */
  onTourShown?: (tourId: string) => void | Promise<void>;
}) => {
  const Shepherd = useShepherd();
  const location = useLocation();
  const startedTourIds = useRef<Set<string>>(new Set());

  /**
   * Show the tour if it hasn't been shown yet based on the current route.
   * Constructs a tour instance and adds steps to it based on the matching tour.
   */
  useEffect(() => {
    if (!tours.length) {
      return;
    }

    const matchingTour = tours.find(tour => tour.route === location.pathname);
    if (!matchingTour) {
      return;
    }

    let cancelled = false;

    const startTour = () => {
      if (startedTourIds.current.has(matchingTour.id)) {
        return;
      }
      startedTourIds.current.add(matchingTour.id);

      const tourInstance = new Shepherd.Tour({
        ...matchingTour.tourOptions,
        defaultStepOptions: {
          ...matchingTour.tourOptions?.defaultStepOptions,
          floatingUIOptions: matchingTour.tourOptions?.defaultStepOptions?.floatingUIOptions || {
            middleware,
          },
          when: {
            ...matchingTour.tourOptions?.defaultStepOptions?.when,
            show:
              matchingTour.tourOptions?.defaultStepOptions?.when?.show ||
              (() => defaultShowHandler(Shepherd)),
          },
        },
      });
      matchingTour.steps.forEach(step => tourInstance.addStep(step));
      tourInstance.start();
      Promise.resolve()
        .then(() => onTourShown(matchingTour.id))
        .catch(() => markTourAsShown(matchingTour.id));
    };

    Promise.resolve()
      .then(() => shouldShowTour(matchingTour.id))
      .catch(() => !hasTourBeenShown(matchingTour.id))
      .then(show => {
        if (!cancelled && show) {
          startTour();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [Shepherd, tours, location.pathname, shouldShowTour, onTourShown]);

  return null;
};

export { Onboarding };
