/**
 * Tour gating with OHIF's own Onboarding (as upstream ships it): the gate is
 * the core tour service's shouldShowTour (server flag), applied by
 * ViewerTour before Onboarding sees the tours, and the tour is recorded
 * (markTourShown) once its first step is on screen. Until P2.6 these cases
 * were tested against gating props PACS-AI had added to Onboarding.tsx.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const mockStart = jest.fn();
const mockAddStep = jest.fn();
const mockTour = jest.fn().mockImplementation(options => ({
  addStep: mockAddStep,
  // Like Shepherd: starting shows the first step, which runs the default
  // step options' `show` handler with the step as `this`.
  start: () => {
    mockStart();
    options?.defaultStepOptions?.when?.show?.call({ tour: { steps: [] }, getElement: () => null });
  },
}));

jest.mock('react-shepherd', () => ({
  useShepherd: () => ({ Tour: mockTour, activeTour: null }),
}));
jest.mock('shepherd.js/dist/css/shepherd.css', () => ({}), { virtual: true });

const mockShouldShowTour = jest.fn();
const mockMarkTourShown = jest.fn();
jest.mock('@pacs-ai/extension-core/src/service/viewerTourService', () => ({
  shouldShowTour: (...args) => mockShouldShowTour(...args),
  markTourShown: (...args) => mockMarkTourShown(...args),
}));
jest.mock('@ohif/ui-next', () => {
  const { Onboarding } = jest.requireActual('@ohif/ui-next/components/Onboarding/Onboarding');
  return { Onboarding };
});

// eslint-disable-next-line import/first
import ViewerTour from './ViewerTour';

const tours = [
  {
    id: 'basicViewerTour',
    route: '/viewer',
    tourOptions: {},
    steps: [{ id: 'scroll', title: 'Scrolling Through Images' }],
  },
];

function customizationService() {
  let modeValue;
  return {
    Scope: { Mode: 'mode' },
    getCustomization: () => modeValue ?? tours,
    setCustomizations: values => {
      modeValue = values['ohif.tours'].$set;
    },
  };
}

describe('Onboarding tour gating', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async (service = customizationService()) => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/viewer']}>
          <ViewerTour customizationService={service} />
        </MemoryRouter>
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };

  it('starts the tour and records it when the gate allows it', async () => {
    mockShouldShowTour.mockResolvedValue(true);
    await render();

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockAddStep).toHaveBeenCalledTimes(1);
    expect(mockMarkTourShown).toHaveBeenCalledWith('basicViewerTour');
    expect(mockStart.mock.invocationCallOrder[0]).toBeLessThan(
      mockMarkTourShown.mock.invocationCallOrder[0]
    );
  });

  it('does not start the tour when the gate says it was already completed', async () => {
    mockShouldShowTour.mockResolvedValue(false);
    await render();

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockMarkTourShown).not.toHaveBeenCalled();
  });

  it('does not start the tour when the gate fails and the local flag is set', async () => {
    localStorage.setItem('shownTours', JSON.stringify(['basicViewerTour']));
    mockShouldShowTour.mockRejectedValue(new Error('offline'));
    await render();
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockMarkTourShown).not.toHaveBeenCalled();
  });

  it('records the local flag and does not start the tour twice', async () => {
    mockShouldShowTour.mockResolvedValue(true);
    const service = customizationService();
    await render(service);
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('shownTours') || '[]')).toEqual(['basicViewerTour']);

    // re-render does not start it twice
    await render(service);
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockMarkTourShown).toHaveBeenCalledTimes(1);
  });

  it('does not start a tour after unmount while the gate is pending', async () => {
    let resolveGate: (value: boolean) => void = () => undefined;
    const gate = new Promise<boolean>(resolve => {
      resolveGate = resolve;
    });
    mockShouldShowTour.mockReturnValue(gate);
    await render();
    act(() => root.unmount());
    await act(async () => {
      resolveGate(true);
      await gate;
    });
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockMarkTourShown).not.toHaveBeenCalled();
    root = createRoot(container);
  });
});
