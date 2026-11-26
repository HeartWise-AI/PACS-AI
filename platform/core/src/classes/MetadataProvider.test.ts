import metadataProvider, { normalizeVOILUTFunction } from './MetadataProvider';

beforeEach(() => {
  (
    metadataProvider as unknown as {
      imageURIToUIDs: Map<string, unknown>;
    }
  ).imageURIToUIDs.clear();
});

describe('MetadataProvider', () => {
  it('uses the WADO frame query parameter as the frame number', () => {
    expect(
      metadataProvider.getUIDsFromImageID(
        'dicomweb:http://localhost/wado?requestType=WADO&studyUID=study-wado&seriesUID=series-wado&objectUID=sop-wado&contentType=application/dicom&transferSyntax=*&frame=5'
      )
    ).toEqual({
      StudyInstanceUID: 'study-wado',
      SeriesInstanceUID: 'series-wado',
      SOPInstanceUID: 'sop-wado',
      frameNumber: '5',
    });
  });

  it('uses the frame query parameter for local multiframe imageIds registered by base URL', () => {
    const baseImageId = 'blob:http://localhost/local-multiframe';
    const uids = {
      StudyInstanceUID: 'study-local',
      SeriesInstanceUID: 'series-local',
      SOPInstanceUID: 'sop-local',
    };

    metadataProvider.addImageIdToUIDs(baseImageId, uids);

    expect(metadataProvider.getUIDsFromImageID(`${baseImageId}&frame=3`)).toEqual({
      ...uids,
      frameNumber: '3',
    });
  });

  it('prefers the frame query parameter over stored frame metadata', () => {
    const baseImageId = 'blob:http://localhost/local-multiframe-with-frame-number';
    const uids = {
      StudyInstanceUID: 'study-local-with-frame-number',
      SeriesInstanceUID: 'series-local-with-frame-number',
      SOPInstanceUID: 'sop-local-with-frame-number',
      frameNumber: '1',
    };

    metadataProvider.addImageIdToUIDs(baseImageId, uids);

    expect(metadataProvider.getUIDsFromImageID(`${baseImageId}&frame=4`)).toEqual({
      ...uids,
      frameNumber: '4',
    });
  });

  it('prefers an exact frame imageId mapping before falling back to the base URL', () => {
    const baseImageId = 'blob:http://localhost/local-multiframe-exact-frame';
    metadataProvider.addImageIdToUIDs(baseImageId, {
      StudyInstanceUID: 'study-base',
      SeriesInstanceUID: 'series-base',
      SOPInstanceUID: 'sop-base',
      frameNumber: '1',
    });

    const frameImageId = `${baseImageId}&frame=3`;
    metadataProvider.addImageIdToUIDs(frameImageId, {
      StudyInstanceUID: 'study-frame',
      SeriesInstanceUID: 'series-frame',
      SOPInstanceUID: 'sop-frame',
      frameNumber: '3',
    });

    expect(metadataProvider.getUIDsFromImageID(frameImageId)).toEqual({
      StudyInstanceUID: 'study-frame',
      SeriesInstanceUID: 'series-frame',
      SOPInstanceUID: 'sop-frame',
      frameNumber: '3',
    });
  });
});

describe('MetadataProvider voiLutModule', () => {
  const instance = (VOILUTFunction?: unknown) => ({
    WindowCenter: '125',
    WindowWidth: '143',
    ...(VOILUTFunction === undefined ? {} : { VOILUTFunction }),
  });

  it('returns the VOI LUT function as a one-element array so createImage reads the whole value', () => {
    const module = metadataProvider.getTagFromInstance('voiLutModule', instance('SIGMOID'));
    expect(module.voiLUTFunction).toEqual(['SIGMOID']);
    // dicom-image-loader createImage uses voiLUTFunction[0]
    expect(module.voiLUTFunction[0]).toBe('SIGMOID');
    expect(module.windowCenter).toEqual([125]);
    expect(module.windowWidth).toEqual([143]);
  });

  it('normalizes multi-valued, padded or lower-case values and drops unknown ones', () => {
    expect(normalizeVOILUTFunction(['LINEAR_EXACT', 'SIGMOID'])).toBe('LINEAR_EXACT');
    expect(normalizeVOILUTFunction(' sigmoid ')).toBe('SIGMOID');
    expect(normalizeVOILUTFunction('UNKNOWN')).toBeUndefined();
    expect(normalizeVOILUTFunction(undefined)).toBeUndefined();
    expect(
      metadataProvider.getTagFromInstance('voiLutModule', instance()).voiLUTFunction
    ).toBeUndefined();
    expect(
      metadataProvider.getTagFromInstance('voiLutModule', {
        ...instance('SIGMOID'),
        WindowWidth: '0',
      }).voiLUTFunction
    ).toBeUndefined();
  });
});
