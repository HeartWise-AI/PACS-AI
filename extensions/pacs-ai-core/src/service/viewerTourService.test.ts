const mockGetViewerTour = jest.fn();
const mockCompleteViewerTour = jest.fn();
const mockResetViewerTour = jest.fn();

jest.mock('../api/userRepository', () => ({
  __esModule: true,
  default: {
    GetViewerTour: (...args: unknown[]) => mockGetViewerTour(...args),
    CompleteViewerTour: (...args: unknown[]) => mockCompleteViewerTour(...args),
    ResetViewerTour: (...args: unknown[]) => mockResetViewerTour(...args),
  },
}));

import {
  VIEWER_TOUR_ID,
  hasLocalTourBeenShown,
  markTourShown,
  resetViewerTour,
  shouldShowTour,
} from './viewerTourService';

const notCompleted = { data: { userId: 'user-a', viewerTourCompletedAt: null } };
const completed = { data: { userId: 'user-a', viewerTourCompletedAt: 1763100000 } };
const apiError = { success: false, message: 'Service unavailable' };

const setLegacyLocalDismissal = () =>
  localStorage.setItem('shownTours', JSON.stringify([VIEWER_TOUR_ID]));

describe('viewerTourService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.resetAllMocks();
    mockCompleteViewerTour.mockResolvedValue(completed);
    mockResetViewerTour.mockResolvedValue(notCompleted);
  });

  it('shows the tour to a user who has never completed it anywhere', async () => {
    mockGetViewerTour.mockResolvedValue(notCompleted);

    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(true);
    expect(mockCompleteViewerTour).not.toHaveBeenCalled();
  });

  it('does not show the tour on a new device once the user completed it elsewhere', async () => {
    mockGetViewerTour.mockResolvedValue(completed);

    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(false);
    // the local fallback now mirrors the server
    expect(hasLocalTourBeenShown(VIEWER_TOUR_ID)).toBe(true);
  });

  it('migrates an existing local dismissal to the server instead of showing the tour', async () => {
    setLegacyLocalDismissal();
    mockGetViewerTour.mockResolvedValue(notCompleted);

    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(false);
    expect(mockCompleteViewerTour).toHaveBeenCalledTimes(1);

    // once migrated, the server is trusted on this device: a later server-side
    // reset (e.g. from Settings on another computer) shows the tour again.
    mockGetViewerTour.mockResolvedValue(notCompleted);
    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(true);
  });

  it('keeps the tour hidden and retries the migration when the migration call fails', async () => {
    setLegacyLocalDismissal();
    mockGetViewerTour.mockResolvedValue(notCompleted);
    mockCompleteViewerTour.mockRejectedValueOnce(apiError);

    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(false);
    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(false);
    expect(mockCompleteViewerTour).toHaveBeenCalledTimes(2);
  });

  it('falls back to the local flag when the API is unavailable and never shows the tour twice', async () => {
    mockGetViewerTour.mockRejectedValue(apiError);
    mockCompleteViewerTour.mockRejectedValue(apiError);

    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(true);
    await markTourShown(VIEWER_TOUR_ID);
    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(false);
    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(false);
  });

  it('falls back to the local flag when the API returns an unexpected payload', async () => {
    mockGetViewerTour.mockResolvedValue({ data: null });
    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(true);

    setLegacyLocalDismissal();
    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(false);
  });

  it('records completion locally and on the server when the tour starts', async () => {
    mockGetViewerTour.mockResolvedValue(notCompleted);
    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(true);

    await markTourShown(VIEWER_TOUR_ID);

    expect(hasLocalTourBeenShown(VIEWER_TOUR_ID)).toBe(true);
    expect(mockCompleteViewerTour).toHaveBeenCalledTimes(1);
  });

  it('does not show the tour again when saving completion failed but the server still says not completed', async () => {
    mockGetViewerTour.mockResolvedValue(notCompleted);
    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(true);
    mockCompleteViewerTour.mockRejectedValueOnce(apiError);
    await markTourShown(VIEWER_TOUR_ID);

    // next viewer load: server still null, but the local flag is migrated instead
    await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(false);
    expect(mockCompleteViewerTour).toHaveBeenCalledTimes(2);
  });

  it('keeps other tours on the local flag only', async () => {
    await expect(shouldShowTour('otherTour')).resolves.toBe(true);
    await markTourShown('otherTour');
    await expect(shouldShowTour('otherTour')).resolves.toBe(false);
    expect(mockGetViewerTour).not.toHaveBeenCalled();
    expect(mockCompleteViewerTour).not.toHaveBeenCalled();
  });

  describe('resetViewerTour (Settings > Show the viewer tour again)', () => {
    it('clears the local and server flags so the tour shows on the next viewer open', async () => {
      setLegacyLocalDismissal();
      mockGetViewerTour.mockResolvedValue(completed);
      await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(false);

      await resetViewerTour();

      expect(mockResetViewerTour).toHaveBeenCalledTimes(1);
      expect(hasLocalTourBeenShown(VIEWER_TOUR_ID)).toBe(false);
      mockGetViewerTour.mockResolvedValue(notCompleted);
      await expect(shouldShowTour(VIEWER_TOUR_ID)).resolves.toBe(true);
    });

    it('rejects when the server reset fails, after clearing the local flag', async () => {
      setLegacyLocalDismissal();
      mockResetViewerTour.mockRejectedValue(apiError);

      await expect(resetViewerTour()).rejects.toBe(apiError);
      expect(hasLocalTourBeenShown(VIEWER_TOUR_ID)).toBe(false);
    });

    it('preserves other tours in the local list', async () => {
      localStorage.setItem('shownTours', JSON.stringify(['otherTour', VIEWER_TOUR_ID]));

      await resetViewerTour();

      expect(JSON.parse(localStorage.getItem('shownTours') || '[]')).toEqual(['otherTour']);
    });
  });
});
