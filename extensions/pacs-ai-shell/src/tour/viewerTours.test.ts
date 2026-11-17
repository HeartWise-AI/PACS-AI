const mockShouldShowTour = jest.fn();
const mockMarkTourShown = jest.fn();

jest.mock('@pacs-ai/extension-core/src/service/viewerTourService', () => ({
  shouldShowTour: (...args) => mockShouldShowTour(...args),
  markTourShown: (...args) => mockMarkTourShown(...args),
}));

import { getUnseenTours, markToursStarted } from './viewerTours';

const viewerTour = { id: 'basicViewerTour', route: '/viewer' };
const otherTour = { id: 'otherTour', route: '/segmentation' };

describe('viewer tour gating', () => {
  beforeEach(() => {
    localStorage.clear();
    mockShouldShowTour.mockReset();
    mockMarkTourShown.mockReset();
  });

  test('keeps only the tours the tour service says to show', async () => {
    mockShouldShowTour.mockImplementation(async id => id === 'basicViewerTour');

    await expect(getUnseenTours([viewerTour, otherTour])).resolves.toEqual([viewerTour]);
    expect(mockShouldShowTour).toHaveBeenCalledWith('basicViewerTour');
    expect(mockShouldShowTour).toHaveBeenCalledWith('otherTour');
  });

  test('clears the local Onboarding flag of a tour the server wants shown again', async () => {
    localStorage.setItem('shownTours', JSON.stringify(['basicViewerTour', 'otherTour']));
    mockShouldShowTour.mockImplementation(async id => id === 'basicViewerTour');

    await getUnseenTours([viewerTour, otherTour]);

    expect(JSON.parse(localStorage.getItem('shownTours'))).toEqual(['otherTour']);
  });

  test('treats a failing decision as already seen', async () => {
    mockShouldShowTour.mockRejectedValue(new Error('offline'));

    await expect(getUnseenTours([viewerTour])).resolves.toEqual([]);
  });

  test('handles no tours', async () => {
    await expect(getUnseenTours(undefined)).resolves.toEqual([]);
    expect(mockShouldShowTour).not.toHaveBeenCalled();
  });

  test('marks only the tours whose route is the current page', () => {
    markToursStarted([viewerTour, otherTour], '/viewer');

    expect(mockMarkTourShown).toHaveBeenCalledTimes(1);
    expect(mockMarkTourShown).toHaveBeenCalledWith('basicViewerTour');
  });
});
