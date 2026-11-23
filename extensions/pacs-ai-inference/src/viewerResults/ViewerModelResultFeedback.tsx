import React, { useMemo } from 'react';
import useAvailableModels from '@pacs-ai/extension-core/src/hooks/useAvailableModels';
import type { GetInferenceAvailableModelsResponse } from '@pacs-ai/extension-core/src/api/inferenceDTO';
import AddModelFeedback from '../AddModelFeedback';
import { resolveFeedbackModel } from './viewerResultsModel';
import type { ViewerModelResult } from './types';

interface ViewerModelResultFeedbackProps {
  result: ViewerModelResult;
}

/**
 * Thumbs up/down for the report shown in the result drawer. The vote is kept
 * per model version, like the output-mode modals, and records the run the
 * user was viewing. Renders nothing when the result's model is unknown.
 */
export default function ViewerModelResultFeedback({ result }: ViewerModelResultFeedbackProps) {
  const { inferenceAvailableModels } = useAvailableModels();
  const model = useMemo(
    () => resolveFeedbackModel(result, inferenceAvailableModels),
    [result, inferenceAvailableModels]
  );
  const reportRef = useMemo(
    () => ({
      runId: result.runId,
      executionId: result.executionId,
      studyServiceJobId: result.studyServiceJobId,
    }),
    [result.runId, result.executionId, result.studyServiceJobId]
  );

  if (!model) {
    return null;
  }

  return (
    <div
      className="shrink-0"
      data-testid="viewer-model-result-feedback"
    >
      <AddModelFeedback
        key={`${model.modelId}-${model.version}`}
        title={result.modelName}
        selectedInferenceModel={model as unknown as GetInferenceAvailableModelsResponse}
        reportRef={reportRef}
      />
    </div>
  );
}
