import { formatStudyProcessingRelativeTime } from './StudyProcessingUpdated';

describe('formatStudyProcessingRelativeTime', () => {
  const now = Date.parse('2026-08-04T16:00:00.000Z');

  it('formats a current update as now', () => {
    expect(formatStudyProcessingRelativeTime('2026-08-04T16:00:00.000Z', 'en', now)).toBe('now');
  });

  it('formats a recent update in minutes', () => {
    expect(formatStudyProcessingRelativeTime('2026-08-04T15:56:00.000Z', 'en', now)).toBe(
      '4 minutes ago'
    );
  });

  it('returns an em dash for an invalid timestamp', () => {
    expect(formatStudyProcessingRelativeTime('invalid', 'en', now)).toBe('—');
  });
});
