import {
  autoplayViewport,
  preferSeriesFrameRate,
  preferredFrameRate,
  shouldAutoplay,
  startCineAutoplay,
  stopCineAutoplay,
} from './cineAutoplay';

function pubSub(events: Record<string, string>) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  return {
    EVENTS: events,
    subscribe: jest.fn((event: string, listener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);
      return { unsubscribe: () => listeners.get(event)!.delete(listener) };
    }),
    emit(event: string, payload: unknown) {
      listeners.get(event)?.forEach(listener => listener(payload));
    },
    count(event: string) {
      return listeners.get(event)?.size ?? 0;
    },
  };
}

function setup(displaySets: Record<string, any>, viewports: Record<string, string[]>) {
  let cineState = { isCineEnabled: false };
  const displaySetService = {
    ...pubSub({
      DISPLAY_SETS_ADDED: 'added',
      DISPLAY_SETS_CHANGED: 'changed',
    }),
    getDisplaySetByUID: (uid: string) => displaySets[uid],
    getActiveDisplaySets: () => Object.values(displaySets),
  };
  const cornerstoneViewportService = pubSub({ VIEWPORT_DATA_CHANGED: 'dataChanged' });
  const cineService = {
    getState: () => cineState,
    setIsCineEnabled: jest.fn(enabled => {
      cineState = { ...cineState, isCineEnabled: enabled };
    }),
    setCine: jest.fn(),
  };
  const viewportGridService = {
    getDisplaySetsUIDsForViewport: (viewportId: string) => viewports[viewportId],
  };
  const servicesManager = {
    services: { displaySetService, cornerstoneViewportService, cineService, viewportGridService },
  };
  return { servicesManager, displaySetService, cornerstoneViewportService, cineService };
}

describe('cine autoplay for US and XA', () => {
  test('autoplays modalities containing US or XA', () => {
    expect(shouldAutoplay('XA')).toBe(true);
    expect(shouldAutoplay('US')).toBe(true);
    expect(shouldAutoplay('IVUS')).toBe(true);
    expect(shouldAutoplay('CT')).toBe(false);
    expect(shouldAutoplay(undefined)).toBe(false);
  });

  test('prefers the Cine Rate, then the Frame Time, then 24 fps', () => {
    expect(preferredFrameRate({ instance: { CineRate: 15 }, FrameRate: 33.33 })).toBe(15);
    expect(preferredFrameRate({ instance: { CineRate: '30' } })).toBe(30);
    expect(preferredFrameRate({ FrameRate: 66.67 })).toBe(15);
    expect(preferredFrameRate({ instance: { CineRate: 0 } })).toBe(24);
    expect(preferredFrameRate(undefined)).toBe(24);
  });

  test("gives OHIF's player the frame time of the Cine Rate", () => {
    const displaySet: any = { instance: { CineRate: 15 }, FrameRate: 33.33 };
    preferSeriesFrameRate(displaySet);
    expect(Math.round(1000 / displaySet.FrameRate)).toBe(15);
    const withoutCineRate: any = { FrameRate: 33.33 };
    preferSeriesFrameRate(withoutCineRate);
    expect(withoutCineRate.FrameRate).toBe(33.33);
  });

  test('Shimadzu XA (Frame Time Vector only) plays at 7.5 fps, not 24', () => {
    const shimadzu: any = {
      Modality: 'XA',
      instance: {
        FrameTimeVector: ['0.00', '133.00', '133.00', '134.00'],
        RecommendedDisplayFrameRate: 7,
      },
    };
    expect(preferredFrameRate(shimadzu)).toBe(7.5);
    preferSeriesFrameRate(shimadzu);
    // OHIF's player computes 1000 / FrameRate and keeps one decimal under 10 fps
    expect(Math.round((1000 / shimadzu.FrameRate) * 10) / 10).toBe(7.5);

    const withoutVector: any = { Modality: 'XA', instance: { RecommendedDisplayFrameRate: 7 } };
    expect(preferredFrameRate(withoutVector)).toBe(7);
    preferSeriesFrameRate(withoutVector);
    expect(1000 / withoutVector.FrameRate).toBeCloseTo(7, 6);
  });

  test('keeps IVUS Cine Rate and echo/XA Frame Time; other modalities keep OHIF', () => {
    const ivus: any = {
      Modality: 'IVUS',
      instance: { CineRate: '29', FrameTime: 34.48 },
      FrameRate: 34.48,
    };
    expect(preferredFrameRate(ivus)).toBe(29);
    preferSeriesFrameRate(ivus);
    expect(Math.round(1000 / ivus.FrameRate)).toBe(29);

    const echo: any = { Modality: 'US', instance: { FrameTime: 19.5 }, FrameRate: 19.5 };
    expect(preferredFrameRate(echo)).toBe(51);
    preferSeriesFrameRate(echo);
    expect(echo.FrameRate).toBe(19.5);

    const philipsXA: any = {
      Modality: 'XA',
      instance: { FrameTime: '133.33' },
      FrameRate: '133.33',
    };
    expect(preferredFrameRate(philipsXA)).toBe(7.5);

    const mr: any = { Modality: 'MR', instance: { FrameTimeVector: [0, 100, 100] } };
    preferSeriesFrameRate(mr);
    expect(mr.FrameRate).toBeUndefined();
  });

  test('turns cine on and plays an XA viewport at its rate', () => {
    const { servicesManager, cineService } = setup(
      { xa: { Modality: 'XA', instance: { CineRate: 15 } } },
      { 'viewport-0': ['xa'] }
    );
    autoplayViewport(servicesManager, 'viewport-0');
    expect(cineService.setIsCineEnabled).toHaveBeenCalledWith(true);
    expect(cineService.setCine).toHaveBeenCalledWith({
      id: 'viewport-0',
      isPlaying: true,
      frameRate: 15,
    });
  });

  test('leaves other modalities to OHIF', () => {
    const { servicesManager, cineService } = setup(
      { ct: { Modality: 'CT' } },
      { 'viewport-0': ['ct'] }
    );
    autoplayViewport(servicesManager, 'viewport-0');
    autoplayViewport(servicesManager, 'viewport-unknown');
    expect(cineService.setIsCineEnabled).not.toHaveBeenCalled();
    expect(cineService.setCine).not.toHaveBeenCalled();
  });

  test('runs on every new series in a viewport until stopped, and starts only once', () => {
    const displaySets = { us: { Modality: 'US', FrameRate: 40 } as any };
    const { servicesManager, cornerstoneViewportService, displaySetService, cineService } = setup(
      displaySets,
      { 'viewport-0': ['us'] }
    );

    const stop = startCineAutoplay(servicesManager);
    expect(startCineAutoplay(servicesManager)).toBe(stop);
    expect(cornerstoneViewportService.count('dataChanged')).toBe(1);

    cornerstoneViewportService.emit('dataChanged', { viewportId: 'viewport-0' });
    expect(cineService.setCine).toHaveBeenLastCalledWith({
      id: 'viewport-0',
      isPlaying: true,
      frameRate: 25,
    });

    const added: any = { Modality: 'XA', instance: { CineRate: 12 }, FrameRate: 33.33 };
    displaySetService.emit('added', { displaySetsAdded: [added] });
    expect(Math.round(1000 / added.FrameRate)).toBe(12);

    stopCineAutoplay(servicesManager);
    expect(cornerstoneViewportService.count('dataChanged')).toBe(0);
    expect(displaySetService.count('added')).toBe(0);
    cineService.setCine.mockClear();
    cornerstoneViewportService.emit('dataChanged', { viewportId: 'viewport-0' });
    expect(cineService.setCine).not.toHaveBeenCalled();

    // A new mode starts it again.
    startCineAutoplay(servicesManager);
    expect(cornerstoneViewportService.count('dataChanged')).toBe(1);
    stopCineAutoplay(servicesManager);
  });

  test('does nothing without the cornerstone services', () => {
    expect(() => startCineAutoplay({ services: {} })()).not.toThrow();
    expect(() => stopCineAutoplay(undefined)).not.toThrow();
  });
});
