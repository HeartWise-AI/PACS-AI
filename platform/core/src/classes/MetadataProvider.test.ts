import metadataProvider, {
  normalizePhotometricInterpretation,
  normalizeVOILUTFunction,
} from './MetadataProvider';

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

describe('MetadataProvider imagePixelModule photometric interpretation', () => {
  // Headers of an IVUS cine that was lossy-JPEG compressed and decompressed
  // upstream: still labelled RGB, but the bytes are YCbCr.
  const ivus = (overrides: Record<string, unknown> = {}) => ({
    Modality: 'IVUS',
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.3.1',
    PhotometricInterpretation: 'RGB',
    SamplesPerPixel: 3,
    PlanarConfiguration: 0,
    BitsAllocated: 8,
    BitsStored: 8,
    HighBit: 7,
    PixelRepresentation: 0,
    Rows: 512,
    Columns: 512,
    NumberOfFrames: 1543,
    LossyImageCompression: '01',
    LossyImageCompressionMethod: 'ISO_10918_1',
    ...overrides,
  });

  it('decodes a decompressed lossy-JPEG IVUS labelled RGB as YBR_FULL', () => {
    const module = metadataProvider.getTagFromInstance('imagePixelModule', ivus());
    expect(module.photometricInterpretation).toBe('YBR_FULL');
    expect(module.planarConfiguration).toBe(0);
    expect(module.samplesPerPixel).toBe(3);
    expect(
      normalizePhotometricInterpretation(
        ivus({ LossyImageCompressionMethod: ['ISO_10918_1'], SamplesPerPixel: ['3'] })
      )
    ).toBe('YBR_FULL');
    expect(
      normalizePhotometricInterpretation(
        ivus({ LossyImageCompressionMethod: ['ISO_14495_1', 'ISO_10918_1'] })
      )
    ).toBe('YBR_FULL');
  });

  it('leaves echo, XA and IVUS without lossy-JPEG history unchanged', () => {
    // echo with the same headers (GE Vivid, Philips EPIQ) is true RGB
    expect(normalizePhotometricInterpretation(ivus({ Modality: 'US' }))).toBe('RGB');
    expect(normalizePhotometricInterpretation(ivus({ LossyImageCompressionMethod: undefined }))).toBe(
      'RGB'
    );
    expect(
      normalizePhotometricInterpretation(ivus({ LossyImageCompressionMethod: 'ISO_14495_1' }))
    ).toBe('RGB');
    expect(normalizePhotometricInterpretation(ivus({ PhotometricInterpretation: 'YBR_FULL_422' }))).toBe(
      'YBR_FULL_422'
    );
    expect(
      normalizePhotometricInterpretation(
        ivus({ PhotometricInterpretation: 'MONOCHROME2', SamplesPerPixel: 1 })
      )
    ).toBe('MONOCHROME2');
    expect(normalizePhotometricInterpretation(ivus({ BitsAllocated: 16 }))).toBe('RGB');
    const xa = {
      Modality: 'XA',
      PhotometricInterpretation: 'MONOCHROME2',
      SamplesPerPixel: 1,
      BitsAllocated: 16,
    };
    expect(
      metadataProvider.getTagFromInstance('imagePixelModule', xa).photometricInterpretation
    ).toBe('MONOCHROME2');
    expect(
      metadataProvider.getTagFromInstance('imagePixelModule', ivus({ Modality: 'US' }))
        .photometricInterpretation
    ).toBe('RGB');
  });
});
