/**
 * ViewerTour with OHIF's real Onboarding component and the real core tour
 * service; only the API (userRepository) and shepherd are mocked.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const mockStart = jest.fn();
jest.mock('react-shepherd', () => ({
  useShepherd: () => ({
    // Like Shepherd: start() shows the first step, which runs the `show`
    // handler of the tour's default step options with the step as `this`.
    Tour: function MockTour(options) {
      const steps = [];
      return {
        addStep: step => steps.push(step),
        start: () => {
          mockStart();
          options?.defaultStepOptions?.when?.show?.call({ tour: { steps }, getElement: () => null });
        },
      };
    },
  }),
}));
const mockGetViewerTour = jest.fn();
const mockCompleteViewerTour = jest.fn();
jest.mock('@pacs-ai/extension-core/src/api/userRepository', () => ({
  __esModule: true,
  default: {
    GetViewerTour: (...args) => mockGetViewerTour(...args),
    CompleteViewerTour: (...args) => mockCompleteViewerTour(...args),
  },
}));
jest.mock('@ohif/ui-next', () => {
  const { Onboarding } = jest.requireActual('@ohif/ui-next/components/Onboarding/Onboarding');
  return { Onboarding };
});

import ViewerTour from './ViewerTour';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const viewerTour = { id: 'basicViewerTour', route: '/viewer', steps: [], tourOptions: {} };

function customizationService() {
  let modeValue;
  return {
    Scope: { Mode: 'mode' },
    getCustomization: () => modeValue ?? [viewerTour],
    setCustomizations: values => {
      modeValue = values['ohif.tours'].$set;
    },
  };
}

describe('ViewerTour with OHIF Onboarding', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    mockStart.mockReset();
    mockGetViewerTour.mockReset();
    mockCompleteViewerTour.mockReset();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  const render = async (path = '/viewer') => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <ViewerTour customizationService={customizationService()} />
        </MemoryRouter>
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
  };

  test('starts the tour for a user the server says has not seen it, then records it', async () => {
    mockGetViewerTour.mockResolvedValue({ data: { userId: 'u1', viewerTourCompletedAt: null } });
    mockCompleteViewerTour.mockResolvedValue({ data: { userId: 'u1' } });

    await render();

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockCompleteViewerTour).toHaveBeenCalledTimes(1);
    expect(mockStart.mock.invocationCallOrder[0]).toBeLessThan(
      mockCompleteViewerTour.mock.invocationCallOrder[0]
    );
    expect(JSON.parse(localStorage.getItem('shownTours'))).toEqual(['basicViewerTour']);
  });

  test('starts it again after a reset on another device despite the local flag', async () => {
    localStorage.setItem('shownTours', JSON.stringify(['basicViewerTour']));
    localStorage.setItem('viewerTourServerSyncedUsers', JSON.stringify(['u1']));
    mockGetViewerTour.mockResolvedValue({ data: { userId: 'u1', viewerTourCompletedAt: null } });
    mockCompleteViewerTour.mockResolvedValue({ data: { userId: 'u1' } });

    await render();

    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  test('does not start or record anything for a user who has seen it', async () => {
    mockGetViewerTour.mockResolvedValue({
      data: { userId: 'u1', viewerTourCompletedAt: '2026-11-01T00:00:00Z' },
    });

    await render();

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockCompleteViewerTour).not.toHaveBeenCalled();
  });

  test('does not record the tour on a page where it does not start', async () => {
    mockGetViewerTour.mockResolvedValue({ data: { userId: 'u1', viewerTourCompletedAt: null } });

    await render('/segmentation');

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockCompleteViewerTour).not.toHaveBeenCalled();
  });
});
