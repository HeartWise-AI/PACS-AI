import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const mockStart = jest.fn();
const mockAddStep = jest.fn();
const mockTour = jest.fn().mockImplementation(() => ({ addStep: mockAddStep, start: mockStart }));

jest.mock('react-shepherd', () => ({
  useShepherd: () => ({ Tour: mockTour, activeTour: null }),
}));
jest.mock('react-router', () => ({
  useLocation: () => ({ pathname: '/viewer' }),
}));
jest.mock('shepherd.js/dist/css/shepherd.css', () => ({}), { virtual: true });

// eslint-disable-next-line import/first
import { Onboarding } from '@ohif/ui-next/components/Onboarding/Onboarding';

const tours = [
  {
    id: 'basicViewerTour',
    route: '/viewer',
    tourOptions: {},
    steps: [{ id: 'scroll', title: 'Scrolling Through Images' }],
  },
];

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

  const render = async (props: Record<string, unknown>) => {
    await act(async () => {
      root.render(
        <Onboarding
          tours={tours as never}
          {...props}
        />
      );
    });
  };

  it('starts the tour and records it when the async gate allows it', async () => {
    const onTourShown = jest.fn();
    await render({ shouldShowTour: jest.fn().mockResolvedValue(true), onTourShown });

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockAddStep).toHaveBeenCalledTimes(1);
    expect(onTourShown).toHaveBeenCalledWith('basicViewerTour');
  });

  it('does not start the tour when the gate says it was already completed', async () => {
    const onTourShown = jest.fn();
    await render({ shouldShowTour: jest.fn().mockResolvedValue(false), onTourShown });

    expect(mockStart).not.toHaveBeenCalled();
    expect(onTourShown).not.toHaveBeenCalled();
  });

  it('falls back to the local flag when the gate rejects', async () => {
    localStorage.setItem('shownTours', JSON.stringify(['basicViewerTour']));
    await render({ shouldShowTour: jest.fn().mockRejectedValue(new Error('offline')) });
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('keeps the local-only behaviour by default', async () => {
    await render({});
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('shownTours') || '[]')).toEqual(['basicViewerTour']);

    // re-render does not start it twice
    await render({});
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('does not start a tour after unmount while the gate is pending', async () => {
    let resolveGate: (value: boolean) => void = () => undefined;
    const gate = new Promise<boolean>(resolve => {
      resolveGate = resolve;
    });
    await render({ shouldShowTour: () => gate });
    act(() => root.unmount());
    await act(async () => {
      resolveGate(true);
      await gate;
    });
    expect(mockStart).not.toHaveBeenCalled();
    root = createRoot(container);
  });
});
