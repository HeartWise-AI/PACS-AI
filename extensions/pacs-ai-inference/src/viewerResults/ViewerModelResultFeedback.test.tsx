import React from 'react';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react';
import ViewerModelResultFeedback from './ViewerModelResultFeedback';
import type { ViewerModelResult } from './types';

jest.mock('react-router', () => ({ useNavigate: () => jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));
jest.mock('@pacs-ai/ui', () => ({
  Button: ({ children, ...props }: { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));
jest.mock('@pacs-ai/extension-core/src/api/dto', () => ({
  Error: { UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS' },
}));
jest.mock('@pacs-ai/extension-core/src/service/userService', () => ({ logoutUser: jest.fn() }));
jest.mock('@pacs-ai/extension-core/src/providers/AlertProvider', () => ({
  AlertContext: jest.requireActual('react').createContext(jest.fn()),
}));
jest.mock('@pacs-ai/extension-core/src/api/inferenceRepository', () => ({
  __esModule: true,
  default: {
    GetModelFeedbackByModelID: jest.fn(),
    UpdateModelFeedback: jest.fn(),
    RemoveModelFeedback: jest.fn(),
  },
}));
const mockAvailableModels = { inferenceAvailableModels: [] as unknown[] };
jest.mock('@pacs-ai/extension-core/src/hooks/useAvailableModels', () => ({
  __esModule: true,
  default: () => mockAvailableModels,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const inferenceRepository = require('@pacs-ai/extension-core/src/api/inferenceRepository').default;

function result(overrides: Partial<ViewerModelResult> = {}): ViewerModelResult {
  return {
    studyInstanceUID: '1.2.3',
    modelName: 'DeepCORO-JEPA',
    modelVersion: '1.3.0',
    modality: 'angiogram',
    modelId: 'firestore-registration-id',
    artifactModelId: 'deepcoro-info',
    containerId: null,
    runId: 'run-1',
    executionId: 'execution-1',
    studyServiceJobId: 'job-1',
    completedAt: '2026-11-10T10:00:00Z',
    trigger: 'VIEWER_REQUEST',
    selectedViews: null,
    reportAvailable: true,
    ...overrides,
  };
}

describe('ViewerModelResultFeedback', () => {
  let renderer: RenderResult | null = null;

  beforeEach(() => {
    mockAvailableModels.inferenceAvailableModels = [];
    inferenceRepository.GetModelFeedbackByModelID.mockReset().mockResolvedValue({ data: null });
    inferenceRepository.UpdateModelFeedback.mockReset().mockResolvedValue({});
    inferenceRepository.RemoveModelFeedback.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
  });

  async function mount(viewerResult: ViewerModelResult) {
    await act(async () => {
      renderer = render(<ViewerModelResultFeedback result={viewerResult} />);
    });
  }

  test('a thumbs-up records the vote on the model version with the report run', async () => {
    await mount(result());

    expect(inferenceRepository.GetModelFeedbackByModelID).toHaveBeenCalledWith({
      modelId: 'deepcoro-info-1.3.0',
      executionId: 'execution-1',
    });

    await act(async () => {
      fireEvent.click(renderer!.getByAltText('Thumbs up icon').closest('button')!);
    });

    expect(inferenceRepository.UpdateModelFeedback).toHaveBeenCalledWith({
      id: null,
      inferenceModelId: 'deepcoro-info',
      modelId: 'deepcoro-info-1.3.0',
      feedbackType: 'APPROVE',
      modelFeedbackAnswers: null,
      runId: 'run-1',
      executionId: 'execution-1',
      studyServiceJobId: 'job-1',
    });
  });

  test('uses the matching available model when the result has no artifact model id', async () => {
    mockAvailableModels.inferenceAvailableModels = [
      {
        modelId: 'deepcoro-info',
        containerId: 'container-1',
        modelName: 'DeepCORO-JEPA',
        version: '1.3.0',
        approveFeedbackQuestionnaires: [],
        rejectFeedbackQuestionnaires: [],
      },
    ];
    await mount(result({ artifactModelId: null }));

    expect(renderer!.getByTestId('viewer-model-result-feedback')).toBeTruthy();
    expect(inferenceRepository.GetModelFeedbackByModelID).toHaveBeenCalledWith({
      modelId: 'deepcoro-info-1.3.0',
      executionId: 'execution-1',
    });
  });

  const submitButton = () => renderer!.getByText('Submit').closest('button')!;
  const reasonOptions = () => renderer!.getAllByRole('radio');

  test('thumbs down with no configured questionnaire asks for one of the six reasons', async () => {
    await mount(result());

    await act(async () => {
      fireEvent.click(renderer!.getByAltText('Thumbs down icon').closest('button')!);
    });

    expect(renderer!.getByText('Why did you reject this output?')).toBeTruthy();
    expect(reasonOptions().map(option => option.textContent)).toEqual([
      'Missed a clinically relevant finding',
      'Measurement disagrees with my read',
      'Report text unclear or verbose',
      'Wrong series or laterality',
      'Took too long to return',
      'Other',
    ]);
    expect(submitButton().disabled).toBe(true);
    expect(inferenceRepository.UpdateModelFeedback).not.toHaveBeenCalled();

    // Submitting without a reason casts no vote.
    await act(async () => {
      fireEvent.submit(submitButton().closest('form')!);
    });
    expect(inferenceRepository.UpdateModelFeedback).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(renderer!.getByText('Wrong series or laterality'));
    });
    expect(submitButton().disabled).toBe(false);

    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(inferenceRepository.UpdateModelFeedback).toHaveBeenCalledWith({
      id: null,
      inferenceModelId: 'deepcoro-info',
      modelId: 'deepcoro-info-1.3.0',
      feedbackType: 'REJECT',
      runId: 'run-1',
      executionId: 'execution-1',
      studyServiceJobId: 'job-1',
      modelFeedbackAnswers: [
        {
          questionnaireId: 'default-reject-reason',
          questionnaireQuestion: 'Why did you reject this output?',
          questionnaireAnswerIds: ['wrong-series-laterality'],
          questionnaireAnswers: ['Wrong series or laterality'],
        },
      ],
    });
  });

  test('the model questions follow the default reason', async () => {
    mockAvailableModels.inferenceAvailableModels = [
      {
        modelId: 'deepcoro-info',
        modelName: 'DeepCORO-JEPA',
        version: '1.3.0',
        approveFeedbackQuestionnaires: [],
        rejectFeedbackQuestionnaires: [
          {
            id: 'vessel',
            type: 'TEXT',
            questionEn: 'Which vessel?',
            questionFr: 'Quel vaisseau?',
            answerOptionsEn: null,
            answerOptionsFr: null,
          },
        ],
      },
    ];
    await mount(result({ artifactModelId: null }));

    await act(async () => {
      fireEvent.click(renderer!.getByAltText('Thumbs down icon').closest('button')!);
    });

    const text = renderer!.container.ownerDocument.body.textContent ?? '';
    expect(text.indexOf('Why did you reject this output?')).toBeLessThan(
      text.indexOf('Which vessel?')
    );
    expect(reasonOptions()).toHaveLength(6);
  });

  test('closing the reason modal casts no vote', async () => {
    await mount(result());

    await act(async () => {
      fireEvent.click(renderer!.getByAltText('Thumbs down icon').closest('button')!);
    });
    await act(async () => {
      fireEvent.click(renderer!.getByAltText('Close icon').closest('button')!);
    });

    expect(renderer!.queryByText('Why did you reject this output?')).toBeNull();
    expect(inferenceRepository.UpdateModelFeedback).not.toHaveBeenCalled();
  });

  test('removing a vote is scoped to the report', async () => {
    inferenceRepository.GetModelFeedbackByModelID.mockResolvedValue({
      data: { id: 'vote-1', feedbackType: 'APPROVE' },
    });
    await mount(result());

    await act(async () => {
      fireEvent.click(renderer!.getByAltText('Thumbs up icon').closest('button')!);
    });

    expect(inferenceRepository.RemoveModelFeedback).toHaveBeenCalledWith({
      modelId: 'deepcoro-info-1.3.0',
      executionId: 'execution-1',
    });
  });

  test('renders nothing when the model cannot be resolved', async () => {
    await mount(result({ artifactModelId: null }));

    expect(renderer!.container.innerHTML).toBe('');
    expect(inferenceRepository.GetModelFeedbackByModelID).not.toHaveBeenCalled();
  });
});
