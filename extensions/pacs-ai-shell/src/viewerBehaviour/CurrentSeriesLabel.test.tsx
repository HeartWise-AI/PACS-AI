import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const mockDisplaySetService = {
  EVENTS: { DISPLAY_SETS_ADDED: 'added', DISPLAY_SETS_CHANGED: 'changed', DISPLAY_SETS_REMOVED: 'removed' },
  subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
  getActiveDisplaySets: jest.fn(),
};
let mockViewportGrid: any;
jest.mock(
  '@ohif/core',
  () => ({ useSystem: () => ({ servicesManager: { services: { displaySetService: mockDisplaySetService } } }) }),
  { virtual: true }
);
jest.mock('@ohif/ui-next', () => ({ useViewportGrid: () => [mockViewportGrid] }), {
  virtual: true,
});

import CurrentSeriesLabel, {
  CURRENT_SERIES_BUTTON_ID,
  CURRENT_SERIES_UI_TYPE,
  addCurrentSeriesLabel,
  currentSeriesText,
  isImageSeries,
} from './CurrentSeriesLabel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const img = (uid: string, study: string, extra: Record<string, unknown> = {}) => ({
  displaySetInstanceUID: uid,
  StudyInstanceUID: study,
  Modality: 'XA',
  imageIds: [`wadors:${uid}`],
  ...extra,
});

// Display sets in displaySetService order: one study of three image series,
// an SR and a PDF, plus an earlier study of the same patient.
const displaySets = [
  img('a', 'study-1', { SeriesNumber: 1, SeriesDescription: 'LAO' }),
  img('b', 'study-1', { SeriesNumber: 2, SeriesDescription: 'RAO CRA' }),
  img('c', 'study-1'),
];

const multiStudy = [
  img('p1', 'study-0', { SeriesNumber: 1, SeriesDescription: 'Prior LAO' }),
  img('p2', 'study-0', { SeriesNumber: 2 }),
  img('a', 'study-1', { SeriesNumber: 1, SeriesDescription: 'LAO' }),
  {
    displaySetInstanceUID: 'sr',
    StudyInstanceUID: 'study-1',
    Modality: 'SR',
    SeriesNumber: 900,
    SeriesDescription: 'Report',
  },
  img('b', 'study-1', { SeriesNumber: 2, SeriesDescription: 'RAO CRA' }),
  {
    displaySetInstanceUID: 'pdf',
    StudyInstanceUID: 'study-1',
    Modality: 'DOC',
    SeriesNumber: 901,
    SeriesDescription: 'Letter',
  },
  img('seg', 'study-1', { Modality: 'SEG', SeriesNumber: 902, SeriesDescription: 'Labels' }),
  img('noimages', 'study-1', { imageIds: [], SeriesNumber: 3 }),
  img('hidden', 'study-1', { excludeFromThumbnailBrowser: true, SeriesNumber: 4 }),
  img('c', 'study-1', { SeriesNumber: 5 }),
  img('p3', 'study-0', { SeriesNumber: 3 }),
];

describe('current series label', () => {
  test('position in the study, series number and description', () => {
    expect(currentSeriesText(['b'], displaySets)).toBe('2/3 · #2 RAO CRA');
    expect(currentSeriesText(['a'], displaySets)).toBe('1/3 · #1 LAO');
    expect(currentSeriesText(['c'], displaySets)).toBe('3/3');
    expect(currentSeriesText(['unknown'], displaySets)).toBe('');
    expect(currentSeriesText([], displaySets)).toBe('');
    expect(currentSeriesText(undefined, undefined)).toBe('');
  });

  test("counts only the image series of the viewport's own study", () => {
    // study-1 has a, b and c as image series; the prior study is not counted.
    expect(currentSeriesText(['a'], multiStudy)).toBe('1/3 · #1 LAO');
    expect(currentSeriesText(['b'], multiStudy)).toBe('2/3 · #2 RAO CRA');
    expect(currentSeriesText(['c'], multiStudy)).toBe('3/3 · #5');
    // The arrow keys can walk on into the prior study: its own count.
    expect(currentSeriesText(['p1'], multiStudy)).toBe('1/3 · #1 Prior LAO');
    expect(currentSeriesText(['p3'], multiStudy)).toBe('3/3 · #3');
  });

  test('shows only the series number and description for a non-image series', () => {
    expect(currentSeriesText(['sr'], multiStudy)).toBe('#900 Report');
    expect(currentSeriesText(['pdf'], multiStudy)).toBe('#901 Letter');
    expect(currentSeriesText(['seg'], multiStudy)).toBe('#902 Labels');
    expect(currentSeriesText(['noimages'], multiStudy)).toBe('#3');
    expect(currentSeriesText(['hidden'], multiStudy)).toBe('#4');
  });

  test('tells image series from the others', () => {
    expect(isImageSeries(multiStudy[0] as any)).toBe(true);
    ['sr', 'pdf', 'seg', 'noimages'].forEach(uid =>
      expect(
        isImageSeries(multiStudy.find(ds => ds.displaySetInstanceUID === uid) as any)
      ).toBe(false)
    );
    expect(isImageSeries(img('u', 's', { unsupported: true }) as any)).toBe(false);
    expect(isImageSeries(img('pr', 's', { Modality: 'PR' }) as any)).toBe(false);
    expect(isImageSeries(img('ko', 's', { Modality: 'KO' }) as any)).toBe(false);
    expect(isImageSeries(undefined)).toBe(false);
  });

  test('is placed in the viewport action bar', () => {
    const toolbarService = {
      sections: { viewportActionMenu: { topMiddle: 'viewportActionMenu.topMiddle' } },
      register: jest.fn(),
      updateSection: jest.fn(),
    };
    addCurrentSeriesLabel(toolbarService);
    expect(toolbarService.register).toHaveBeenCalledWith([
      { id: CURRENT_SERIES_BUTTON_ID, uiType: CURRENT_SERIES_UI_TYPE, props: {} },
    ]);
    expect(toolbarService.updateSection).toHaveBeenCalledWith('viewportActionMenu.topMiddle', [
      CURRENT_SERIES_BUTTON_ID,
    ]);
    expect(() => addCurrentSeriesLabel(undefined)).not.toThrow();
  });

  describe('rendered', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      mockDisplaySetService.getActiveDisplaySets.mockReturnValue(displaySets);
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    const render = (viewportId = 'viewport-0') =>
      act(() => root.render(<CurrentSeriesLabel viewportId={viewportId} />));

    test('shows "Series:" and the series of its viewport, and follows it', () => {
      mockViewportGrid = {
        activeViewportId: 'viewport-0',
        viewports: new Map([['viewport-0', { displaySetInstanceUIDs: ['a'] }]]),
      };
      render();
      const spans = container.querySelectorAll('span');
      expect(spans[0].textContent).toBe('Series: ');
      expect(spans[1].textContent).toBe('1/3 · #1 LAO');

      mockViewportGrid = {
        activeViewportId: 'viewport-0',
        viewports: new Map([['viewport-0', { displaySetInstanceUIDs: ['b'] }]]),
      };
      render();
      expect(container.querySelectorAll('span')[1].textContent).toBe('2/3 · #2 RAO CRA');
    });

    test('renders nothing for an empty viewport', () => {
      mockViewportGrid = { viewports: new Map([['viewport-0', { displaySetInstanceUIDs: [] }]]) };
      render();
      expect(container.innerHTML).toBe('');
    });
  });
});
