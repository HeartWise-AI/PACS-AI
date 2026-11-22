import React, { useEffect, useState } from 'react';
import { Onboarding } from '@ohif/ui-next';
import { markTourShown } from '@pacs-ai/extension-core/src/service/viewerTourService';
import { getUnseenTours, type TourDefinition } from './viewerTours';
import { reportTourShown } from './reportTourShown';

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
 */
function ViewerTour({ customizationService }: { customizationService: any }) {
  const [tours, setTours] = useState<TourDefinition[] | null>(null);

  useEffect(() => {
    let cancelled = false;
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
      setTours(customizationService.getCustomization(TOURS_CUSTOMIZATION) || []);
    });

    return () => {
      cancelled = true;
    };
  }, [customizationService]);

  if (!tours?.length) {
    return null;
  }

  return <Onboarding tours={tours as any} />;
}

export default ViewerTour;
