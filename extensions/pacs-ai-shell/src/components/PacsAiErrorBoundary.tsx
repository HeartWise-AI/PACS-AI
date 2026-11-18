import React from 'react';
import { ErrorBoundary } from '@ohif/ui-next';

/**
 * Renders nothing in place of a failed subtree. PACS-AI never showed OHIF's
 * red "Something went wrong" notification on its pages or in the viewer (the
 * fork passed showNotification={false} to the route error boundary); OHIF's
 * default fallback shows that notification and a details dialog that is
 * closed until the notification's button opens it, so without the
 * notification nothing was visible either.
 */
function SilentFallback() {
  return null;
}

/**
 * OHIF's ErrorBoundary with a fallback that shows no notification. Wraps our
 * route pages and the viewer layout template, so their errors stop here
 * instead of reaching the route boundary in platform/app/src/routes.
 */
function PacsAiErrorBoundary({
  context,
  children,
}: {
  context: string;
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      context={context}
      fallbackComponent={SilentFallback as any}
    >
      {children}
    </ErrorBoundary>
  );
}

export default PacsAiErrorBoundary;
