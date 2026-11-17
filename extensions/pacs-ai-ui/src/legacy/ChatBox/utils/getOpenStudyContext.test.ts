import {
  getOpenStudyContext,
  openStudyMetadata,
  MAX_SERIES_PER_STUDY,
} from './getOpenStudyContext';

const STUDY_A = '2.25.100';
const STUDY_B = '2.25.200';

const displaySet = (uid: string, study: string, series: string, modality: string) => ({
  displaySetInstanceUID: uid,
  StudyInstanceUID: study,
  SeriesInstanceUID: series,
  Modality: modality,
});

function servicesFor(displaySets: any[], activeViewport?: { id: string; uids: string[] }) {
  const byUID = new Map(displaySets.map(item => [item.displaySetInstanceUID, item]));
  const viewports = new Map();
  if (activeViewport) {
    viewports.set(activeViewport.id, {
      viewportId: activeViewport.id,
      displaySetInstanceUIDs: activeViewport.uids,
    });
  }
  return {
    services: {
      displaySetService: {
        getActiveDisplaySets: () => displaySets,
        getDisplaySetByUID: (uid: string) => byUID.get(uid),
      },
      viewportGridService: {
        getState: () => ({ activeViewportId: activeViewport?.id, viewports }),
      },
    },
  };
}

describe('getOpenStudyContext', () => {
  it('uses the study shown in the active viewport, with that display set modality first', () => {
    const servicesManager = servicesFor(
      [
        displaySet('ds-a1', STUDY_A, '2.25.100.1', 'SR'),
        displaySet('ds-a2', STUDY_A, '2.25.100.2', 'XA'),
        displaySet('ds-b1', STUDY_B, '2.25.200.1', 'US'),
      ],
      { id: 'viewport-1', uids: ['ds-a2'] }
    );

    expect(getOpenStudyContext(servicesManager)).toEqual({
      studyInstanceUID: STUDY_A,
      modality: 'XA, SR',
      seriesInstanceUIDs: ['2.25.100.2', '2.25.100.1'],
    });
  });

  it('accepts viewport state stored as a plain object', () => {
    const servicesManager = servicesFor([displaySet('ds-b1', STUDY_B, '2.25.200.1', 'XA')]);
    servicesManager.services.viewportGridService.getState = () => ({
      activeViewportId: 'viewport-2',
      viewports: { a: { viewportId: 'viewport-2', displaySetInstanceUIDs: ['ds-b1'] } },
    });

    expect(getOpenStudyContext(servicesManager)?.studyInstanceUID).toBe(STUDY_B);
  });

  it('falls back to the first loaded study when no viewport is active', () => {
    const servicesManager = servicesFor([displaySet('ds-b1', STUDY_B, '2.25.200.1', 'XA')]);

    expect(getOpenStudyContext(servicesManager)?.studyInstanceUID).toBe(STUDY_B);
  });

  it('returns null when nothing is open or services are missing', () => {
    expect(getOpenStudyContext(servicesFor([]))).toBeNull();
    expect(getOpenStudyContext(undefined)).toBeNull();
    expect(getOpenStudyContext({ services: {} })).toBeNull();
  });

  it('bounds the series list to the orchestrator per-study limit', () => {
    const many = Array.from({ length: MAX_SERIES_PER_STUDY + 10 }, (_, index) =>
      displaySet(`ds-${index}`, STUDY_A, `2.25.100.${index}`, 'XA')
    );

    expect(getOpenStudyContext(servicesFor(many))?.seriesInstanceUIDs).toHaveLength(
      MAX_SERIES_PER_STUDY
    );
  });
});

describe('openStudyMetadata', () => {
  it('sends only the study UID and modality', () => {
    expect(
      openStudyMetadata({
        studyInstanceUID: STUDY_A,
        modality: 'XA',
        seriesInstanceUIDs: ['2.25.100.1'],
      })
    ).toEqual({ studyInstanceUID: STUDY_A, modality: 'XA' });
    expect(openStudyMetadata(null)).toBeUndefined();
  });
});
