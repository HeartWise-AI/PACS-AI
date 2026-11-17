import React from 'react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AlertProvider } from './AlertProvider';
import StudyProcessingProvider from '../studyProcessing/StudyProcessingProvider';
import InferenceProcessingProvider from '../inferenceProcessing/InferenceProcessingProvider';
import FrontendUpdateMonitor from '../updateMonitor/FrontendUpdateMonitor';

const queryClient = new QueryClient();

/**
 * App-wide PACS-AI providers, registered with OHIF's serviceProvidersManager
 * in the core extension's preRegistration. OHIF mounts them inside its own
 * providers (after ShepherdJourneyProvider, so notifications, dialogs and
 * modals are available here) and around its BrowserRouter. Nothing in here
 * may use React Router hooks.
 *
 * Order, outermost first: react-query, alerts, study processing, inference
 * processing (it reads study processing). The update monitor renders nothing.
 */
function PacsAiAppProviders({ children }) {
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

PacsAiAppProviders.propTypes = {
  children: PropTypes.node,
};

export default PacsAiAppProviders;
