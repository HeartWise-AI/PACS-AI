import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const mockOnboarding = jest.fn((_props: unknown) => null);
jest.mock('@ohif/ui-next', () => ({ Onboarding: props => mockOnboarding(props) }));
const mockGetUnseenTours = jest.fn((..._args: unknown[]) => undefined as any);
jest.mock('./viewerTours', () => ({
  getUnseenTours: (...args) => mockGetUnseenTours(...args),
}));
const mockMarkTourShown = jest.fn();
jest.mock('@pacs-ai/extension-core/src/service/viewerTourService', () => ({
  markTourShown: (...args) => mockMarkTourShown(...args),
}));

// eslint-disable-next-line import/first
import Shepherd from 'shepherd.js';
// eslint-disable-next-line import/first
import ViewerTour from './ViewerTour';
// eslint-disable-next-line import/first
import { whenViewerOnboardingIdle } from './viewerOnboardingGate';

// The tour Onboarding started, as Shepherd holds it.
const shepherd = Shepherd as unknown as { activeTour: unknown };

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const viewerTour = { id: 'basicViewerTour', route: '/viewer', steps: [] };

function createCustomizationService(initial) {
  let modeValue;
  return {
    Scope: { Mode: 'mode' },
    getCustomization: jest.fn(() => modeValue ?? initial),
    setCustomizations: jest.fn((values, scope) => {
      expect(scope).toBe('mode');
      modeValue = values['ohif.tours'].$set;
    }),
  };
}

describe('ViewerTour', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockOnboarding.mockClear();
    mockGetUnseenTours.mockReset();
    mockMarkTourShown.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    shepherd.activeTour = null;
    act(() => root.unmount());
    container.remove();
  });

  const render = async customizationService => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/viewer']}>
          <ViewerTour customizationService={customizationService} />
        </MemoryRouter>
      );
    });
  };

  test('hands Onboarding the unseen tours through the mode customization', async () => {
    const customizationService = createCustomizationService([viewerTour]);
    mockGetUnseenTours.mockResolvedValue([viewerTour]);

    await render(customizationService);

    expect(mockGetUnseenTours).toHaveBeenCalledWith([viewerTour]);
    const [values, scope] = customizationService.setCustomizations.mock.calls[0];
    expect(scope).toBe('mode');
    expect(values['ohif.tours'].$set).toEqual([
      expect.objectContaining({ id: 'basicViewerTour', route: '/viewer', steps: [] }),
    ]);
    const props = mockOnboarding.mock.calls[mockOnboarding.mock.calls.length - 1][0] as any;
    expect(props).toEqual({ tours: values['ohif.tours'].$set });
    // The server is told only when a step of the tour is on screen.
    expect(mockMarkTourShown).not.toHaveBeenCalled();
    const show = props.tours[0].tourOptions.defaultStepOptions.when.show;
    show.call({ tour: { steps: [] }, getElement: () => null });
    expect(mockMarkTourShown).toHaveBeenCalledWith('basicViewerTour');
    show.call({ tour: { steps: [] }, getElement: () => null });
    expect(mockMarkTourShown).toHaveBeenCalledTimes(1);
  });

  test('renders no Onboarding when the user has seen the tour', async () => {
    const customizationService = createCustomizationService([viewerTour]);
    mockGetUnseenTours.mockResolvedValue([]);

    await render(customizationService);

    expect(customizationService.setCustomizations).toHaveBeenCalledWith(
      { 'ohif.tours': { $set: [] } },
      'mode'
    );
    expect(mockOnboarding).not.toHaveBeenCalled();
    expect(mockMarkTourShown).not.toHaveBeenCalled();
  });
  test('keeps the onboarding gate held while the tour Onboarding started is on screen', async () => {
    // Codex review of #535: the checklist tour resumed in the viewer while
    // Onboarding started its own tour, and both overlays stayed on screen.
    const handlers: Record<string, () => void> = {};
    const tour = {
      on: jest.fn((event: string, handler: () => void) => (handlers[event] = handler)),
      off: jest.fn(),
    };
    mockOnboarding.mockImplementation(() => {
      shepherd.activeTour = tour;
      return null;
    });
    const customizationService = createCustomizationService([viewerTour]);
    let resolveUnseen: (tours: unknown[]) => void = () => undefined;
    mockGetUnseenTours.mockReturnValue(new Promise(resolve => (resolveUnseen = resolve)));
    let idle = false;

    await render(customizationService);
    whenViewerOnboardingIdle().then(() => (idle = true));
    await act(async () => resolveUnseen([viewerTour]));
    expect(idle).toBe(false);

    await act(async () => handlers.inactive());
    expect(idle).toBe(true);
    mockOnboarding.mockImplementation(() => null);
  });

  test('frees the onboarding gate when no tour is left to show', async () => {
    const customizationService = createCustomizationService([viewerTour]);
    mockGetUnseenTours.mockResolvedValue([]);

    await render(customizationService);

    await expect(whenViewerOnboardingIdle()).resolves.toBe(true);
  });
});
