import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AlertProvider } from './AlertProvider';
import StudyProcessingProvider from '../studyProcessing/StudyProcessingProvider';
import InferenceProcessingProvider from '../inferenceProcessing/InferenceProcessingProvider';
import FrontendUpdateMonitor from '../updateMonitor/FrontendUpdateMonitor';

const queryClient = new QueryClient();

/**
 * App-wide PACS-AI providers, registered with OHIF's serviceProvidersManager
 * in the core extension's preRegistration. OHIF 3.13 (App.tsx) mounts them
 * inside its notification and tooltip providers but before DialogProvider
 * and ModalProvider, so OHIF dialogs and modals are NOT available in here
 * (useDialog/useModal); in exchange, OHIF dialog and modal content sees these
 * contexts. They are also around its BrowserRouter: nothing in here may use
 * React Router hooks.
 *
 * Order, outermost first: react-query, alerts, study processing, inference
 * processing (it reads study processing). The update monitor renders nothing.
 */
function PacsAiAppProviders({ children }: { children?: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AlertProvider>
        <StudyProcessingProvider>
          <InferenceProcessingProvider>
            <FrontendUpdateMonitor />
            {children}
          </InferenceProcessingProvider>
        </StudyProcessingProvider>
      </AlertProvider>
    </QueryClientProvider>
  );
}

export default PacsAiAppProviders;
