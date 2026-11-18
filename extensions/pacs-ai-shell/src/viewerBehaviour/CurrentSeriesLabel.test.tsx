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
} from './CurrentSeriesLabel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const displaySets = [
  { displaySetInstanceUID: 'a', SeriesNumber: 1, SeriesDescription: 'LAO' },
  { displaySetInstanceUID: 'b', SeriesNumber: 2, SeriesDescription: 'RAO CRA' },
  { displaySetInstanceUID: 'c' },
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
