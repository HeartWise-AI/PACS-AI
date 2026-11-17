import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const mockOnboarding = jest.fn((_props: unknown) => null);
jest.mock('@ohif/ui-next', () => ({ Onboarding: props => mockOnboarding(props) }));
const mockGetUnseenTours = jest.fn((..._args: unknown[]) => undefined as any);
const mockMarkToursStarted = jest.fn((..._args: unknown[]) => undefined);
jest.mock('./viewerTours', () => ({
  getUnseenTours: (...args) => mockGetUnseenTours(...args),
  markToursStarted: (...args) => mockMarkToursStarted(...args),
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
    mockMarkToursStarted.mockReset();
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

  test('hands Onboarding the unseen tours through the mode customization and marks the start', async () => {
    const customizationService = createCustomizationService([viewerTour]);
    mockGetUnseenTours.mockResolvedValue([viewerTour]);

    await render(customizationService);

    expect(mockGetUnseenTours).toHaveBeenCalledWith([viewerTour]);
    expect(customizationService.setCustomizations).toHaveBeenCalledWith(
      { 'ohif.tours': { $set: [viewerTour] } },
      'mode'
    );
    expect(mockOnboarding).toHaveBeenLastCalledWith({ tours: [viewerTour] });
    expect(mockMarkToursStarted).toHaveBeenCalledWith([viewerTour], '/viewer');
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
    expect(mockMarkToursStarted).not.toHaveBeenCalled();
  });
});
