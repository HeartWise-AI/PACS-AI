import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Onboarding } from '@ohif/ui-next';
import { getUnseenTours, markToursStarted, type TourDefinition } from './viewerTours';

const TOURS_CUSTOMIZATION = 'ohif.tours';

/**
 * Viewer tour gating (F9). The tours come from the `ohif.tours`
 * customization; this sets that customization, for the current mode only, to
 * the tours the server says this user has not seen, and only then renders
 * OHIF's Onboarding with it. Onboarding starts a tour when its route is the
 * current page, and the start is recorded through the core tour service so
 * the tour shows once per user across devices.
 */
function ViewerTour({ customizationService }: { customizationService: any }) {
  const location = useLocation();
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

  useEffect(() => {
    if (tours?.length) {
      // Runs after Onboarding's own effect has started the matching tour.
      markToursStarted(tours, location.pathname);
    }
  }, [tours, location.pathname]);

  if (!tours?.length) {
    return null;
  }

  return <Onboarding tours={tours as any} />;
}

export default ViewerTour;
