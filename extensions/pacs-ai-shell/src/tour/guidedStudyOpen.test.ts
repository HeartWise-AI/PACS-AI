import {
  buildTutorialWorklistPath,
  fetchLocalStudyUIDs,
  clearPendingTutorialStep,
  getPendingTutorialStep,
  isTutorialSearch,
  pickTutorialModality,
  pickTutorialStudy,
  setPendingTutorialStep,
  waitForElement,
} from './guidedStudyOpen';
import { getFiltersFromSearchParams } from '../worklist/worklistSearchRestore';

describe('pickTutorialModality', () => {
  it('prefers XA, then US, among the modalities the models take', () => {
    expect(
      pickTutorialModality([
        { supportedDicomModalities: ['US'] },
        { supportedDicomModalities: ['XA'] },
      ])
    ).toBe('XA');
    expect(pickTutorialModality([{ supportedDicomModalities: ['ECG', 'US'] }])).toBe('US');
  });

  it('falls back to another supported modality, then to XA', () => {
    expect(pickTutorialModality([{ supportedDicomModalities: ['ct'] }])).toBe('CT');
    expect(pickTutorialModality([{ supportedDicomModalities: ['NOT-A-CODE'] }])).toBe('XA');
    expect(pickTutorialModality([{ supportedDicomModalities: null }])).toBe('XA');
    expect(pickTutorialModality()).toBe('XA');
  });
});

describe('buildTutorialWorklistPath', () => {
  it('selects the modality, clears the dates and runs the search', () => {
    const path = buildTutorialWorklistPath('US');
    const searchParams = new URLSearchParams(path.slice(path.indexOf('?')));

    expect(path.startsWith('/?')).toBe(true);
    expect(isTutorialSearch(searchParams)).toBe(true);

    const restored = getFiltersFromSearchParams(searchParams, 'PACS', '20261118-20261118');
    expect(restored.shouldSearch).toBe(true);
    expect(restored.filters.modalitiesInStudy).toBe('US');
    expect(restored.filters.studyDate).toBe('');
    expect(restored.filters.modalityId).toBe('PACS');
  });

  it('is not a tutorial search without the parameter', () => {
    expect(isTutorialSearch(new URLSearchParams('modalitiesInStudy=XA'))).toBe(false);
  });
});

describe('pending tutorial step', () => {
  afterEach(() => clearPendingTutorialStep());

  it('is kept across routes in sessionStorage and can be cleared', () => {
    expect(getPendingTutorialStep()).toBeNull();
    setPendingTutorialStep('run-inference');
    expect(getPendingTutorialStep()).toBe('run-inference');
    clearPendingTutorialStep();
    expect(getPendingTutorialStep()).toBeNull();
  });
});

describe('waitForElement', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  it('resolves at once when the element is already there', async () => {
    document.body.innerHTML = '<div data-tour-id="row"></div>';
    await expect(waitForElement('[data-tour-id="row"]', 1000)).resolves.toBe(
      document.querySelector('[data-tour-id="row"]')
    );
  });

  it('resolves when the element appears later', async () => {
    const pending = waitForElement('[data-tour-id="row"]', 1000);
    const row = document.createElement('div');
    row.setAttribute('data-tour-id', 'row');
    document.body.appendChild(row);
    await expect(pending).resolves.toBe(row);
  });

  it('resolves when an attribute marks an existing element', async () => {
    document.body.innerHTML = '<div id="row"></div>';
    const pending = waitForElement('[data-tour-id="row"]', 1000);
    document.getElementById('row')!.setAttribute('data-tour-id', 'row');
    await expect(pending).resolves.toBe(document.getElementById('row'));
  });

  it('resolves null after the timeout or when aborted', async () => {
    jest.useFakeTimers();
    const timedOut = waitForElement('[data-tour-id="missing"]', 500);
    jest.advanceTimersByTime(500);
    await expect(timedOut).resolves.toBeNull();

    const controller = new AbortController();
    const aborted = waitForElement('[data-tour-id="missing"]', 5000, controller.signal);
    controller.abort();
    await expect(aborted).resolves.toBeNull();
  });
});

describe('pickTutorialStudy', () => {
  const studies = [
    { studyInstanceUID: 'old', studyDate: '20190101', studyTime: '235959' },
    { studyInstanceUID: 'new-morning', studyDate: '20261118', studyTime: '080000' },
    { studyInstanceUID: 'new-noon', studyDate: '20261118', studyTime: '120000.5' },
    { studyInstanceUID: 'no-date', studyDate: '', studyTime: '' },
  ];

  it('picks the most recent study already stored locally', () => {
    expect(pickTutorialStudy(studies, new Set(['old', 'new-morning', 'new-noon']))?.studyInstanceUID).toBe(
      'new-noon'
    );
    expect(pickTutorialStudy(studies, new Set(['old', 'new-morning']))?.studyInstanceUID).toBe(
      'new-morning'
    );
  });

  it('returns null when no study is stored locally', () => {
    expect(pickTutorialStudy(studies, new Set(['elsewhere']))).toBeNull();
    expect(pickTutorialStudy(studies)).toBeNull();
    expect(pickTutorialStudy([], new Set(['old']))).toBeNull();
  });
});

describe('fetchLocalStudyUIDs', () => {
  it('lists the local studies and keeps those of the modality', async () => {
    const get = jest.fn().mockResolvedValue({
      data: [
        { '0020000D': { vr: 'UI', Value: ['1.2.3'] }, '00080061': { vr: 'CS', Value: ['US'] } },
        { '0020000D': { vr: 'UI', Value: [' 1.2.4 '] }, '00080061': { vr: 'CS', Value: ['SR', 'us'] } },
        { '0020000D': { vr: 'UI', Value: ['1.2.5'] }, '00080061': { vr: 'CS', Value: ['XA'] } },
        { '0020000D': { vr: 'UI', Value: ['1.2.6'] } },
        { '00080061': { vr: 'CS', Value: ['US'] } },
      ],
    });
    const uids = await fetchLocalStudyUIDs('US', get);
    expect(Array.from(uids)).toEqual(['1.2.3', '1.2.4']);
    const [url, config] = get.mock.calls[0];
    expect(url).toBe('/proxy/orthanc/dicom-web/studies');
    expect(config.headers).toEqual({ Accept: 'application/dicom+json' });
    // The local Orthanc rejects a ModalitiesInStudy filter.
    expect(config.params).not.toHaveProperty('ModalitiesInStudy');
  });

  it('resolves with no studies when the lookup fails or answers oddly', async () => {
    await expect(fetchLocalStudyUIDs('XA', jest.fn().mockRejectedValue(new Error('down')))).resolves.toEqual(
      new Set()
    );
    await expect(fetchLocalStudyUIDs('XA', jest.fn().mockResolvedValue({ data: {} }))).resolves.toEqual(
      new Set()
    );
  });
});
