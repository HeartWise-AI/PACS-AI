/**
 * Codex review of #535: back in the viewer with the run-inference step
 * pending, the overlay resumed its tour before the saved tutorial progress
 * (and the tenant's survey steps) had loaded, and completing that tour saved
 * the steps it had captured then, with the wrong step index.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

jest.mock('@pacs-ai/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Typography: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const mockLocation = { pathname: '/viewer', search: '?StudyInstanceUIDs=1.2.3' };
jest.mock('../navigation/routerLocation', () => ({
  useShellLocation: () => mockLocation,
  useShellNavigate: () => jest.fn(),
}));

const mockTourHandlers: Record<string, () => void> = {};
const mockCreateGuidedTour = jest.fn(() => ({
  addStep: jest.fn(),
  on: (event: string, handler: () => void) => {
    mockTourHandlers[event] = handler;
  },
  start: jest.fn(),
  complete: jest.fn(),
  isActive: () => true,
}));
jest.mock('../tour/guidedTour', () => ({
  createGuidedTour: (...args: unknown[]) => mockCreateGuidedTour(...(args as [])),
}));

const mockClearPending = jest.fn();
jest.mock('../tour/guidedStudyOpen', () => ({
  ...jest.requireActual('../tour/guidedStudyOpen'),
  getPendingTutorialStep: () => 'run-inference',
  clearPendingTutorialStep: () => mockClearPending(),
  waitForElement: () => Promise.resolve(globalThis.document.body),
}));

let mockResolveMetadata: (value: unknown) => void = () => undefined;
const mockUpdateUserMetadata = jest.fn(() => Promise.resolve({}));
jest.mock('@pacs-ai/extension-core/src/api/userRepository', () => ({
  __esModule: true,
  default: {
    GetCurrentUser: () => Promise.resolve({ data: { id: 'user-1', email: 'u@example.org' } }),
    GetUserMetadata: () => new Promise(resolve => (mockResolveMetadata = resolve)),
    UpdateUserMetadata: (...args: unknown[]) => mockUpdateUserMetadata(...(args as [])),
  },
}));
jest.mock('@pacs-ai/extension-core/src/api/tenantRepository', () => ({
  __esModule: true,
  default: {
    GetTenantInfo: () =>
      Promise.resolve({
        data: {
          onboardingQuestionnaires: {
            PRE_SURVEY: [{ id: 'pre-1', questionEn: 'Q', type: 'TEXT' }],
            POST_SURVEY: [{ id: 'post-1', questionEn: 'Q', type: 'TEXT' }],
          },
        },
      }),
  },
}));
jest.mock('@pacs-ai/extension-core/src/api/inferenceRepository', () => ({
  __esModule: true,
  default: {
    GetInferenceAvailableModels: () => Promise.resolve({ data: [] }),
    GetOnboardingModelQuestionnaireAnswers: () => Promise.resolve({ data: [] }),
  },
}));

// eslint-disable-next-line import/first
import TutorialProgressOverlay from './TutorialProgressOverlay';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));

describe('TutorialProgressOverlay resuming the run-inference tour in the viewer', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('waits for the saved progress, then saves the step index of the loaded steps', async () => {
    await act(async () => root.render(<TutorialProgressOverlay />));
    await flush();
    await flush();

    // Progress not loaded yet: every step looks pending, so no tour yet.
    expect(mockCreateGuidedTour).not.toHaveBeenCalled();

    // Pre-survey and View Available Models done (1-based 2).
    await act(async () => mockResolveMetadata({ data: { tutorialProgressStep: 2 } }));
    await flush();
    await flush();

    expect(mockCreateGuidedTour).toHaveBeenCalledTimes(1);
    expect(mockClearPending).toHaveBeenCalled();

    await act(async () => mockTourHandlers.complete());
    // run-inference is the third of the five steps: saved as 3.
    expect(mockUpdateUserMetadata).toHaveBeenLastCalledWith({
      metadata: { tutorialProgressStep: 3 },
    });
  });
});
