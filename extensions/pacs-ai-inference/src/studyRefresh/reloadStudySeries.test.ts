import { canReloadStudySeries, reloadStudySeries, snapshotStudySeries } from './reloadStudySeries';
import { isStudyGrowing, publishStudyGrowing } from './studyGrowingStore';

describe('reloadStudySeries', () => {
  it('drops the cached retrieval, then re-runs the series metadata retrieval', async () => {
    const calls: string[] = [];
    const dataSource = {
      getConfig: () => ({ name: 'dicomweb' }),
      deleteStudyMetadataPromise: jest.fn((key: string) => void calls.push(`delete ${key}`)),
      retrieve: {
        series: {
          metadata: jest.fn(async () => void calls.push('metadata')),
        },
      },
    };

    await reloadStudySeries(dataSource, '1.2.3');

    expect(calls).toEqual(['delete 1.2.3', 'delete dicomweb:1.2.3', 'metadata']);
    expect(dataSource.retrieve.series.metadata).toHaveBeenCalledWith({
      StudyInstanceUID: '1.2.3',
      madeInClient: false,
    });
  });

  it('works with a data source that has no retrieval cache', async () => {
    const metadata = jest.fn().mockResolvedValue(undefined);
    await reloadStudySeries({ retrieve: { series: { metadata } } }, '1.2.3');
    expect(metadata).toHaveBeenCalledTimes(1);
  });

  it('reports a data source that cannot reload a study', async () => {
    expect(canReloadStudySeries(null)).toBe(false);
    expect(canReloadStudySeries({ retrieve: {} })).toBe(false);
    expect(canReloadStudySeries({ retrieve: { series: { metadata: jest.fn() } } })).toBe(true);
    await expect(reloadStudySeries({}, '1.2.3')).rejects.toThrow();
  });
});

describe('snapshotStudySeries', () => {
  it('lists the series and counts the instances of the metadata store', () => {
    expect(
      snapshotStudySeries({
        series: [
          { SeriesInstanceUID: 's1', instances: [{}, {}] },
          { SeriesInstanceUID: 's2', instances: [] },
          { SeriesInstanceUID: 's3' },
        ],
      })
    ).toEqual({ seriesInstanceUIDs: ['s1', 's2', 's3'], instances: 2 });
    expect(snapshotStudySeries(undefined)).toEqual({ seriesInstanceUIDs: [], instances: 0 });
  });
});

describe('study growing store', () => {
  it('holds whether a study is still growing', () => {
    expect(isStudyGrowing('1.2.3')).toBe(false);
    publishStudyGrowing('1.2.3', true);
    expect(isStudyGrowing('1.2.3')).toBe(true);
    expect(isStudyGrowing('1.2.4')).toBe(false);
    publishStudyGrowing('1.2.3', false);
    expect(isStudyGrowing('1.2.3')).toBe(false);
    expect(isStudyGrowing(null)).toBe(false);
  });
});
