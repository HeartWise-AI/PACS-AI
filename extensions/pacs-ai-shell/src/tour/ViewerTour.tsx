import React, { useEffect, useRef, useState } from 'react';
import Shepherd from 'shepherd.js';
import { Onboarding } from '@ohif/ui-next';
import { markTourShown } from '@pacs-ai/extension-core/src/service/viewerTourService';
import { getUnseenTours, type TourDefinition } from './viewerTours';
import { reportTourShown } from './reportTourShown';
import { holdViewerOnboarding } from './viewerOnboardingGate';

const TOURS_CUSTOMIZATION = 'ohif.tours';

/**
 * Viewer tour gating (F9). The tours come from the `ohif.tours`
 * customization; this sets that customization, for the current mode only, to
 * the tours the server says this user has not seen, and only then renders
 * OHIF's Onboarding with it. Onboarding starts a tour when its route is the
 * current page (getUnseenTours cleared the local flag it checks). When the
 * first step of a tour is on screen, reportTourShown records it through the
 * core tour service (server flag and local flag), so the tour shows once per
 * user across devices and the server is told only once it really started.
 *
 * Until the tour Onboarding starts has ended, or it is known that none will
 * start, ViewerTour holds the viewer onboarding gate so that the tutorial
 * checklist does not put a second tour on screen.
 */
function ViewerTour({ customizationService }: { customizationService: any }) {
  const [tours, setTours] = useState<TourDefinition[] | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const release = holdViewerOnboarding();
    releaseRef.current = release;
    const defined = (customizationService.getCustomization(TOURS_CUSTOMIZATION) ||
      []) as TourDefinition[];

    getUnseenTours(defined).then(unseen => {
      if (cancelled) {
        return;
      }
      customizationService.setCustomizations(
        {
          [TOURS_CUSTOMIZATION]: {
            $set: unseen.map(tour => reportTourShown(tour, markTourShown)),
          },
        },
        customizationService.Scope.Mode
      );
      const next = customizationService.getCustomization(TOURS_CUSTOMIZATION) || [];
      setTours(next);
      if (!next.length) {
        release();
      }
    }, release);

    return () => {
      cancelled = true;
      release();
    };
  }, [customizationService]);

  // Onboarding, a child, has run its effect: the tour it started for this
  // page, if any, is Shepherd's active tour. The gate is free once it ends.
  useEffect(() => {
    if (!tours?.length) {
      return;
    }
    const release = releaseRef.current;
    const active = Shepherd.activeTour;
    if (!active || typeof active.on !== 'function') {
      release?.();
      return;
    }
    const onInactive = () => release?.();
    active.on('inactive', onInactive);
    return () => {
      active.off('inactive', onInactive);
    };
  }, [tours]);

  if (!tours?.length) {
    return null;
  }

  return <Onboarding tours={tours as any} />;
}

export default ViewerTour;
