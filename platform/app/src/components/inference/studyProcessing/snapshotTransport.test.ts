import {
  createFixtureStudyProcessingSnapshotTransport,
  createRESTStudyProcessingSnapshotTransport,
} from './snapshotTransport';
import type { StudyProcessingRESTRepository } from './restRepository';
import { studyProcessingSummaryFixtures } from './fixtures';

describe('study processing snapshot transport', () => {
  test('loads one bounded REST snapshot for the visible studies', async () => {
    const loadWorklistStudyStatuses = jest.fn().mockResolvedValue({
      summaries: [studyProcessingSummaryFixtures.processing],
      limit: 2,
      offset: 0,
      hasMore: false,
    });
    const repository = {
      loadWorklistStudyStatuses,
    } as unknown as StudyProcessingRESTRepository;
    const transport = createRESTStudyProcessingSnapshotTransport(repository);

    const summaries = await transport.loadVisibleStudySnapshot(['1.2.3', '4.5.6']);

    expect(summaries).toEqual([studyProcessingSummaryFixtures.processing]);
    expect(loadWorklistStudyStatuses).toHaveBeenCalledWith({
      studyInstanceUIDs: ['1.2.3', '4.5.6'],
      limit: 2,
      offset: 0,
    });
  });

  test('does not make a full-tenant REST request when no studies are visible', async () => {
    const loadWorklistStudyStatuses = jest.fn();
    const repository = {
      loadWorklistStudyStatuses,
    } as unknown as StudyProcessingRESTRepository;
    const transport = createRESTStudyProcessingSnapshotTransport(repository);

    await expect(transport.loadVisibleStudySnapshot([])).resolves.toEqual([]);
    expect(loadWorklistStudyStatuses).not.toHaveBeenCalled();
  });

  test('keeps fixture snapshots behind the same transport contract', async () => {
    const transport = createFixtureStudyProcessingSnapshotTransport();

    const summaries = await transport.loadVisibleStudySnapshot(['fixture-study']);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].studyInstanceUID).toBe('fixture-study');
  });
});
