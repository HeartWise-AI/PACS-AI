import React from 'react';
import TutorialProgressOverlay from '../components/TutorialProgressOverlay';

/**
 * App-wide shell UI, registered with OHIF's serviceProvidersManager in the
 * shell's preRegistration (after the core extension, so our alerts, react-
 * query and processing providers are around it). OHIF mounts registered
 * providers around its BrowserRouter, so the tutorial progress overlay stays
 * mounted across page changes, as it did when App.tsx rendered it; it reads
 * the location through useShellLocation instead of the router.
 */
function PacsAiShellProviders({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {children}
      <TutorialProgressOverlay />
    </>
  );
}

export default PacsAiShellProviders;
