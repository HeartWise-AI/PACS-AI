import {
  createStudyNotificationMetadataResolver,
  type ResolvedStudyNotificationMetadata,
} from './studyNotificationMetadata';

// Synthetic identifiers only.
function metadata(studyInstanceUID: string): ResolvedStudyNotificationMetadata {
  return {
    accessionNumber: `ACC-${studyInstanceUID}`,
    modalitiesInStudy: 'US',
    patientId: 'SYN-0001',
    patientName: 'SYNTHETIC^PATIENT',
    studyInstanceUID,
  };
}

describe('study notification metadata resolver', () => {
  it('shares one lookup between concurrent requests for the same study', async () => {
    let release: (value: ResolvedStudyNotificationMetadata) => void = () => undefined;
    const fetchStudy = jest.fn(
      () => new Promise<ResolvedStudyNotificationMetadata>(resolve => (release = resolve))
    );
    const resolver = createStudyNotificationMetadataResolver({ fetchStudy });

    const first = resolver.resolve('1.2.3');
    const second = resolver.resolve('1.2.3');
    await Promise.resolve();
    release(metadata('1.2.3'));

    await expect(first).resolves.toEqual(metadata('1.2.3'));
    await expect(second).resolves.toEqual(metadata('1.2.3'));
    expect(fetchStudy).toHaveBeenCalledTimes(1);
  });

  it('answers from the cache once a study was resolved', async () => {
    const fetchStudy = jest.fn(async (uid: string) => metadata(uid));
    const resolver = createStudyNotificationMetadataResolver({ fetchStudy });

    expect(resolver.peek('1.2.3')).toBeNull();
    await resolver.resolve('1.2.3');
    await resolver.resolve('1.2.3');

    expect(fetchStudy).toHaveBeenCalledTimes(1);
    expect(resolver.peek('1.2.3')).toEqual(metadata('1.2.3'));
  });

  it('caps the cache and evicts the least recently used study', async () => {
    const fetchStudy = jest.fn(async (uid: string) => metadata(uid));
    const resolver = createStudyNotificationMetadataResolver({ fetchStudy, maxEntries: 2 });

    await resolver.resolve('1.1');
    await resolver.resolve('1.2');
    await resolver.resolve('1.1');
    await resolver.resolve('1.3');

    expect(resolver.peek('1.1')).not.toBeNull();
    expect(resolver.peek('1.2')).toBeNull();
    expect(resolver.peek('1.3')).not.toBeNull();
  });

  it('resolves to null when the lookup fails and retries only after a delay', async () => {
    let currentTime = 1000;
    const fetchStudy = jest
      .fn<Promise<ResolvedStudyNotificationMetadata | null>, [string]>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(metadata('1.2.3'));
    const resolver = createStudyNotificationMetadataResolver({
      fetchStudy,
      missRetryAfterMs: 500,
      now: () => currentTime,
    });

    await expect(resolver.resolve('1.2.3')).resolves.toBeNull();
    await expect(resolver.resolve('1.2.3')).resolves.toBeNull();
    expect(fetchStudy).toHaveBeenCalledTimes(1);

    currentTime += 500;
    await expect(resolver.resolve('1.2.3')).resolves.toEqual(metadata('1.2.3'));
    expect(fetchStudy).toHaveBeenCalledTimes(2);
  });

  it('survives a lookup that throws synchronously', async () => {
    const resolver = createStudyNotificationMetadataResolver({
      fetchStudy: () => {
        throw new Error('boom');
      },
    });

    await expect(resolver.resolve('1.2.3')).resolves.toBeNull();
  });

  it('does not query the server for something that is not a DICOM UID', async () => {
    const fetchStudy = jest.fn(async (uid: string) => metadata(uid));
    const resolver = createStudyNotificationMetadataResolver({ fetchStudy });

    await expect(resolver.resolve('study-1/../x')).resolves.toBeNull();
    await expect(resolver.resolve('')).resolves.toBeNull();
    expect(fetchStudy).not.toHaveBeenCalled();
  });

  it('drops answers that arrive after the session state was cleared', async () => {
    let release: (value: ResolvedStudyNotificationMetadata) => void = () => undefined;
    const fetchStudy = jest.fn(
      () => new Promise<ResolvedStudyNotificationMetadata>(resolve => (release = resolve))
    );
    const resolver = createStudyNotificationMetadataResolver({ fetchStudy });

    const pending = resolver.resolve('1.2.3');
    await Promise.resolve();
    resolver.clear();
    release(metadata('1.2.3'));

    await expect(pending).resolves.toBeNull();
    expect(resolver.peek('1.2.3')).toBeNull();
  });
});
