import React from 'react';
import { createRoot } from 'react-dom/client';
import WebappOutputModeModal from '../WebappOutputModeModal';
import HTMLOutputModeModal from '../HTMLOutputModeModal';
import { ViewerModelResultDrawer } from '../viewerResults/ViewerModelResultDrawer';

type WebappCase = {
  mode: 'webapp';
  containerName: string;
  webappPath: string;
  webappDataBase64: string;
};

type HtmlCase = {
  mode: 'html';
  htmlBase64: string;
};

type ReportCase = {
  mode: 'report';
  htmlBase64: string;
};

type SecurityCase = WebappCase | HtmlCase | ReportCase;

declare global {
  interface Window {
    __SECURITY_CASE: SecurityCase;
  }
}

const securityCase = window.__SECURITY_CASE;

function mount() {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('missing root');
  }
  if (securityCase.mode === 'webapp') {
    createRoot(root).render(
      <WebappOutputModeModal
        isOpen
        onClose={() => {}}
        loading={false}
        title="Model"
        containerName={securityCase.containerName}
        data={{
          webappPath: securityCase.webappPath,
          webappDataBase64: securityCase.webappDataBase64,
        }}
        selectedInferenceModel={null}
      />
    );
    return;
  }
  if (securityCase.mode === 'html') {
    createRoot(root).render(
      <HTMLOutputModeModal
        isOpen
        onClose={() => {}}
        loading={false}
        title="Model"
        modelName="model-web"
        modelVersion="1"
        outputMode="HTML"
        seriesInstanceUIDs="[]"
        data={{ htmlBase64: securityCase.htmlBase64 }}
        selectedInferenceModel={null}
      />
    );
    return;
  }
  createRoot(root).render(
    <ViewerModelResultDrawer
      result={{
        studyInstanceUID: '1.2.3',
        modelName: 'model-web',
        modelVersion: '1',
        modality: 'XA',
        modelId: 'model-1',
        artifactModelId: null,
        containerId: 'container-1',
        runId: 'run-1',
        executionId: 'execution-1',
        studyServiceJobId: null,
        completedAt: '2026-01-01T00:00:00Z',
        trigger: 'VIEWER_REQUEST',
        selectedViews: [],
        reportAvailable: true,
      }}
      repository={{
        loadLatestResults: async () => [],
        loadReport: async () => ({
          htmlBase64: securityCase.htmlBase64,
          contentType: 'text/html',
        }),
        runModel: async () => {
          throw new Error('unused');
        },
        loadRunStatus: async () => {
          throw new Error('unused');
        },
      }}
      onClose={() => {}}
      onMinimize={() => {}}
      onSelectView={() => true}
    />
  );
}

mount();
