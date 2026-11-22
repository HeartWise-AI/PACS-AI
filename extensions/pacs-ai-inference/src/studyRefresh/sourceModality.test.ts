import {
  readStudySourceModality,
  rememberStudySourceModality,
  resolveSourceModality,
  STUDY_SOURCE_MODALITY_STORAGE_KEY,
} from './sourceModality';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

const MODALITIES = {
  MHI_PACS: { allowMove: true, targetCMoveEnabled: true },
  ARCHIVE: { allowMove: true, targetCMoveEnabled: true },
};

describe('study source modality', () => {
  it('remembers the modality a study was opened from, per study', () => {
    const storage = memoryStorage();
    rememberStudySourceModality('1.2.3', 'MHI_PACS', storage);
    rememberStudySourceModality('1.2.4', 'ARCHIVE', storage);
    rememberStudySourceModality('1.2.3', 'ARCHIVE', storage);

    expect(readStudySourceModality('1.2.3', storage)).toBe('ARCHIVE');
    expect(readStudySourceModality('1.2.4', storage)).toBe('ARCHIVE');
    expect(readStudySourceModality('1.2.5', storage)).toBeNull();
  });

  it('keeps a bounded number of studies and survives a corrupt entry', () => {
    const storage = memoryStorage();
    for (let index = 0; index < 60; index++) {
      rememberStudySourceModality(`1.2.${index}`, 'MHI_PACS', storage);
    }
    expect(JSON.parse(storage.getItem(STUDY_SOURCE_MODALITY_STORAGE_KEY)!)).toHaveLength(50);
    expect(readStudySourceModality('1.2.0', storage)).toBeNull();
    expect(readStudySourceModality('1.2.59', storage)).toBe('MHI_PACS');

    const corrupt = memoryStorage({ [STUDY_SOURCE_MODALITY_STORAGE_KEY]: '{not json' });
    expect(readStudySourceModality('1.2.3', corrupt)).toBeNull();
    rememberStudySourceModality('1.2.3', 'MHI_PACS', corrupt);
    expect(readStudySourceModality('1.2.3', corrupt)).toBe('MHI_PACS');
  });

  it('ignores a missing study or modality and a missing storage', () => {
    const storage = memoryStorage();
    rememberStudySourceModality('', 'MHI_PACS', storage);
    rememberStudySourceModality('1.2.3', undefined, storage);
    expect(storage.getItem(STUDY_SOURCE_MODALITY_STORAGE_KEY)).toBeNull();
    expect(() => rememberStudySourceModality('1.2.3', 'MHI_PACS', null)).not.toThrow();
    expect(readStudySourceModality('1.2.3', null)).toBeNull();
  });
});

describe('resolveSourceModality', () => {
  const remembered = () => {
    const storage = memoryStorage();
    rememberStudySourceModality('1.2.3', 'ARCHIVE', storage);
    return storage;
  };

  it('prefers the modality the study was opened from', async () => {
    await expect(
      resolveSourceModality({
        studyInstanceUID: '1.2.3',
        loadModalities: async () => MODALITIES,
        sessionStorage: remembered(),
        localStorage: memoryStorage({ selectedDICOMModality: 'MHI_PACS' }),
      })
    ).resolves.toEqual({ modalityId: 'ARCHIVE', origin: 'study' });
  });

  it("falls back to the work list's selected modality", async () => {
    await expect(
      resolveSourceModality({
        studyInstanceUID: '1.2.9',
        loadModalities: async () => MODALITIES,
        sessionStorage: remembered(),
        localStorage: memoryStorage({ selectedDICOMModality: 'MHI_PACS' }),
      })
    ).resolves.toEqual({ modalityId: 'MHI_PACS', origin: 'worklist' });
  });

  it('ignores a recorded modality the tenant no longer has', async () => {
    await expect(
      resolveSourceModality({
        studyInstanceUID: '1.2.3',
        loadModalities: async () => ({ MHI_PACS: MODALITIES.MHI_PACS }),
        sessionStorage: remembered(),
        localStorage: memoryStorage({ selectedDICOMModality: 'GONE' }),
      })
    ).resolves.toEqual({ modalityId: 'MHI_PACS', origin: 'single' });
  });

  it('uses the only retrievable modality of the tenant', async () => {
    await expect(
      resolveSourceModality({
        studyInstanceUID: '1.2.3',
        loadModalities: async () => ({
          MHI_PACS: { allowMove: true, targetCMoveEnabled: true },
          STORE_ONLY: { allowMove: true, targetCMoveEnabled: false },
        }),
        sessionStorage: memoryStorage(),
        localStorage: memoryStorage(),
      })
    ).resolves.toEqual({ modalityId: 'MHI_PACS', origin: 'single' });
  });

  it('cannot tell with several retrievable modalities and nothing recorded', async () => {
    await expect(
      resolveSourceModality({
        studyInstanceUID: '1.2.3',
        loadModalities: async () => MODALITIES,
        sessionStorage: memoryStorage(),
        localStorage: memoryStorage(),
      })
    ).resolves.toBeNull();
  });

  it('uses a recorded modality as it is when the list cannot be loaded', async () => {
    await expect(
      resolveSourceModality({
        studyInstanceUID: '1.2.9',
        loadModalities: async () => {
          throw new Error('unavailable');
        },
        sessionStorage: memoryStorage(),
        localStorage: memoryStorage({ selectedDICOMModality: 'MHI_PACS' }),
      })
    ).resolves.toEqual({ modalityId: 'MHI_PACS', origin: 'worklist' });

    await expect(
      resolveSourceModality({
        studyInstanceUID: '1.2.9',
        loadModalities: async () => null,
        sessionStorage: memoryStorage(),
        localStorage: memoryStorage(),
      })
    ).resolves.toBeNull();
  });
});
