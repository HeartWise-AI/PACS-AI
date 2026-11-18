import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// CurrentSeriesLabel's React hooks are not used by currentSeriesText.
jest.mock('@ohif/core', () => ({ useSystem: () => ({}) }), { virtual: true });
jest.mock('@ohif/ui-next', () => ({ useViewportGrid: () => [{}] }), { virtual: true });
// OHIF's own display set service and series order (package entries are build
// outputs, absent in unit tests).
import DisplaySetService from '@ohif/core/src/services/DisplaySetService/DisplaySetService';
import { seriesSortCriteria } from '@ohif/core/src/utils/sortStudy';
import { startDisplaySetOrder, stopDisplaySetOrder } from './displaySetOrder';
import { currentSeriesText } from './CurrentSeriesLabel';

/**
 * A stack display set as OHIF 3.13 creates it: no `imageIds` until a viewport
 * loads it (CornerstoneCacheService), `numImageFrames` from the start.
 */
const series = (number: number, study = 'study-1', extra: Record<string, unknown> = {}) => ({
  displaySetInstanceUID: `${study}-ds${number}`,
  StudyInstanceUID: study,
  SeriesInstanceUID: `${study}-series${number}`,
  SeriesNumber: number,
  SeriesDescription: 'Coronaire gauche',
  Modality: 'XA',
  numImageFrames: 60,
  ...extra,
});

/**
 * What OHIF's `updateViewportDisplaySet` command (the arrow keys,
 * extensions/default/src/commandsModule.ts) does to pick the next series: the
 * next entry of `displaySetService.activeDisplaySets` after the shown one.
 */
function nextSeries(displaySetService, shownUID: string, direction = 1) {
  const list = [...displaySetService.activeDisplaySets];
  const index = list.findIndex(ds => ds.displaySetInstanceUID === shownUID);
  return list[index + direction];
}

describe('display set order (arrow keys and Series label in study browser order)', () => {
  let displaySetService;
  let servicesManager;

  beforeEach(() => {
    displaySetService = new (DisplaySetService as any)();
    const customizationService = {
      getCustomization: key =>
        key === 'sortingCriteria' ? seriesSortCriteria.seriesInfoSortingCriteria : undefined,
    };
    servicesManager = { services: { displaySetService, customizationService } };
  });

  // OHIF 3.13 adds display sets as each series' metadata arrives (network
  // completion order), one DISPLAY_SETS_ADDED at a time.
  const arrive = (...displaySets) =>
    displaySets.forEach(displaySet => displaySetService.addDisplaySets(displaySet));

  test('without it (3.13 as shipped), ArrowDown follows arrival order: #1 -> #5', () => {
    arrive(series(1), series(5), series(2), series(3), series(4));
    expect(nextSeries(displaySetService, 'study-1-ds1').SeriesNumber).toBe(5);
  });

  test('ArrowDown from series #1 goes to #2, in study browser order, with display sets added incrementally', () => {
    startDisplaySetOrder(servicesManager);
    arrive(series(1));
    // Shown first: the label counts what has arrived so far.
    expect(currentSeriesText(['study-1-ds1'], displaySetService.getActiveDisplaySets())).toBe(
      '1/1 · #1 Coronaire gauche'
    );
    arrive(series(5), series(2), series(3), series(4));

    expect(displaySetService.getActiveDisplaySets().map(ds => ds.SeriesNumber)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    const next = nextSeries(displaySetService, 'study-1-ds1');
    expect(next.SeriesNumber).toBe(2);
    expect(nextSeries(displaySetService, next.displaySetInstanceUID).SeriesNumber).toBe(3);
    expect(nextSeries(displaySetService, 'study-1-ds2', -1).SeriesNumber).toBe(1);
    stopDisplaySetOrder(servicesManager);
  });

  test('the label counts every image series of the study, loaded into a viewport or not', () => {
    startDisplaySetOrder(servicesManager);
    arrive(series(1), series(5), series(2), series(3), series(4));
    // Only the shown series has imageIds (CornerstoneCacheService sets them on load).
    displaySetService.getDisplaySetByUID('study-1-ds1').imageIds = ['wadors:1'];
    const active = displaySetService.getActiveDisplaySets();
    expect(currentSeriesText(['study-1-ds1'], active)).toBe('1/5 · #1 Coronaire gauche');
    expect(currentSeriesText(['study-1-ds2'], active)).toBe('2/5 · #2 Coronaire gauche');
    expect(currentSeriesText(['study-1-ds5'], active)).toBe('5/5 · #5 Coronaire gauche');
    stopDisplaySetOrder(servicesManager);
  });

  test('keeps studies in the order they appeared and puts SR last inside a study', () => {
    startDisplaySetOrder(servicesManager);
    arrive(series(3), series(900, 'study-1', { Modality: 'SR', numImageFrames: undefined }));
    arrive(series(1));
    arrive(series(2, 'prior'), series(1, 'prior'));
    expect(
      displaySetService
        .getActiveDisplaySets()
        .map(ds => `${ds.StudyInstanceUID}#${ds.SeriesNumber}`)
    ).toEqual(['study-1#1', 'study-1#3', 'study-1#900', 'prior#1', 'prior#2']);
    stopDisplaySetOrder(servicesManager);
  });

  test('stops sorting after stopDisplaySetOrder, and starting twice subscribes once', () => {
    startDisplaySetOrder(servicesManager);
    startDisplaySetOrder(servicesManager);
    stopDisplaySetOrder(servicesManager);
    arrive(series(2), series(1));
    expect(displaySetService.getActiveDisplaySets().map(ds => ds.SeriesNumber)).toEqual([2, 1]);
  });

  test('does nothing without a sortingCriteria customization or services', () => {
    servicesManager.services.customizationService = { getCustomization: () => undefined };
    startDisplaySetOrder(servicesManager);
    arrive(series(2), series(1));
    expect(displaySetService.getActiveDisplaySets().map(ds => ds.SeriesNumber)).toEqual([2, 1]);
    stopDisplaySetOrder(servicesManager);
    expect(() => startDisplaySetOrder(undefined)).not.toThrow();
    expect(() => stopDisplaySetOrder(undefined)).not.toThrow();
  });
});
