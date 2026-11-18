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

import ViewerTour from './ViewerTour';

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
});
