import { getSafeCustomization } from './customization';
import { getActiveDisplaySets, getDisplaySetByUID, hasDisplaySetLookup } from './displaySets';
import { forgetStudyMetadata, getSeriesMetadataRetriever } from './dicomweb';

describe('ohifCompat', () => {
  test('getSafeCustomization reads a customization and never throws', () => {
    const customizationService = { getCustomization: jest.fn(() => ({ callbacks: [] })) };
    expect(getSafeCustomization(customizationService, 'studyBrowser.x')).toEqual({ callbacks: [] });
    expect(customizationService.getCustomization).toHaveBeenCalledWith('studyBrowser.x');
    expect(getSafeCustomization(undefined, 'studyBrowser.x')).toBeUndefined();

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = {
      getCustomization: () => {
        throw new Error('not registered');
      },
    };
    expect(getSafeCustomization(failing, 'studyBrowser.x')).toBeUndefined();
    warn.mockRestore();
  });

  test('display set reads tolerate missing services', () => {
    const displaySet = { displaySetInstanceUID: 'ds-1', StudyInstanceUID: 'study-1' };
    const displaySetService = {
      getActiveDisplaySets: () => [displaySet],
      getDisplaySetByUID: (uid: string) => (uid === 'ds-1' ? displaySet : undefined),
    };
    expect(getActiveDisplaySets(displaySetService)).toEqual([displaySet]);
    expect(getActiveDisplaySets(undefined)).toEqual([]);
    expect(getDisplaySetByUID(displaySetService, 'ds-1')).toBe(displaySet);
    expect(getDisplaySetByUID({}, 'ds-1')).toBeUndefined();
    expect(hasDisplaySetLookup(displaySetService)).toBe(true);
    expect(hasDisplaySetLookup({ getActiveDisplaySets: () => [] })).toBe(false);
  });

  test('series metadata retrieval and cache keys of the DICOMweb data source', () => {
    const metadata = jest.fn();
    const deleteStudyMetadataPromise = jest.fn();
    const dataSource = {
      retrieve: { series: { metadata } },
      deleteStudyMetadataPromise,
      getConfig: () => ({ name: 'dicomweb' }),
    };
    expect(getSeriesMetadataRetriever(dataSource)).toBe(metadata);
    expect(getSeriesMetadataRetriever({ retrieve: {} })).toBeUndefined();
    expect(getSeriesMetadataRetriever(null)).toBeUndefined();

    forgetStudyMetadata(dataSource, '1.2.3');
    expect(deleteStudyMetadataPromise.mock.calls).toEqual([['1.2.3'], ['dicomweb:1.2.3']]);
    expect(() => forgetStudyMetadata({}, '1.2.3')).not.toThrow();
  });
});
