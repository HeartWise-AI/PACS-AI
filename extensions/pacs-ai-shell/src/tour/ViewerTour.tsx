import React, { useEffect, useState } from 'react';
import { Onboarding } from '@ohif/ui-next';
import { markTourShown } from '@pacs-ai/extension-core/src/service/viewerTourService';
import { getUnseenTours, type TourDefinition } from './viewerTours';

const TOURS_CUSTOMIZATION = 'ohif.tours';

/** The tours handed to Onboarding were already chosen by the server check. */
const alwaysShow = () => true;

/**
 * Viewer tour gating (F9). The tours come from the `ohif.tours`
 * customization; this sets that customization, for the current mode only, to
 * the tours the server says this user has not seen, and only then renders
 * OHIF's Onboarding with it. Onboarding starts a tour when its route is the
 * current page and only then calls onTourShown, which records it through the
 * core tour service (server flag and local flag), so the tour shows once per
 * user across devices.
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
        { [TOURS_CUSTOMIZATION]: { $set: unseen } },
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

  return (
    <Onboarding
      tours={tours as any}
      // Accepted by ui-next's Onboarding as PACS-AI changed it; P2.6 decides
      // how this is kept when Onboarding.tsx goes back to upstream.
      {...({ shouldShowTour: alwaysShow, onTourShown: markTourShown } as any)}
    />
  );
}

export default ViewerTour;
