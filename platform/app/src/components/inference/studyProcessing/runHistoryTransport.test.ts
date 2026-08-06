import { studyProcessingRunHistoryFixture } from './fixtures';
import {
  createRESTRunHistoryTransport,
  DEFAULT_RUN_HISTORY_PAGE_SIZE,
  RunHistoryUnavailableError,
} from './runHistoryTransport';
import { StudyProcessingRESTError, type StudyProcessingRESTRepository } from './restRepository';

describe('REST run history transport', () => {
  test('loads one bounded history page with its included model executions', async () => {
    const loadStudyProcessingRunHistory = jest.fn().mockResolvedValue({
      history: studyProcessingRunHistoryFixture,
      limit: DEFAULT_RUN_HISTORY_PAGE_SIZE,
      offset: 0,
      hasMore: true,
    });
    const loadProcessingRunDetail = jest.fn();
    const repository = {
      loadStudyProcessingRunHistory,
      loadProcessingRunDetail,
    } as unknown as StudyProcessingRESTRepository;
    const transport = createRESTRunHistoryTransport(repository);

    const result = await transport.loadRunHistory(
      studyProcessingRunHistoryFixture.studyInstanceUID
    );

    expect(result).toEqual({
      history: studyProcessingRunHistoryFixture,
      partial: true,
    });
    expect(loadStudyProcessingRunHistory).toHaveBeenCalledWith({
      studyInstanceUID: studyProcessingRunHistoryFixture.studyInstanceUID,
      limit: DEFAULT_RUN_HISTORY_PAGE_SIZE,
      offset: 0,
    });
    expect(loadProcessingRunDetail).not.toHaveBeenCalled();
  });

  test.each([403, 404, 503])('maps HTTP %i to unavailable history', async status => {
    const repository = {
      loadStudyProcessingRunHistory: jest
        .fn()
        .mockRejectedValue(new StudyProcessingRESTError('History unavailable.', status)),
    } as unknown as StudyProcessingRESTRepository;
    const transport = createRESTRunHistoryTransport(repository);

    await expect(transport.loadRunHistory('1.2.3')).rejects.toEqual(
      new RunHistoryUnavailableError('History unavailable.')
    );
  });

  test('preserves retryable server failures as ordinary load errors', async () => {
    const error = new StudyProcessingRESTError('Service error.', 500);
    const repository = {
      loadStudyProcessingRunHistory: jest.fn().mockRejectedValue(error),
    } as unknown as StudyProcessingRESTRepository;
    const transport = createRESTRunHistoryTransport(repository);

    await expect(transport.loadRunHistory('1.2.3')).rejects.toBe(error);
  });
});
