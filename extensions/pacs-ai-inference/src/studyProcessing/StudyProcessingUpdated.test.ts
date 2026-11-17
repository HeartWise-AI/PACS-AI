import {
  formatStudyProcessingRelativeTime,
  formatStudyProcessingTimestamp,
  resolveStudyProcessingLocale,
} from './StudyProcessingUpdated';

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

  it('falls back to the default locale for an invalid language tag', () => {
    const defaultLocale = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
      -4,
      'minute'
    );
    expect(formatStudyProcessingRelativeTime('2026-08-04T15:56:00.000Z', 'en-US@POSIX', now)).toBe(
      defaultLocale
    );
  });
});

describe('formatStudyProcessingTimestamp', () => {
  it('formats with a valid locale', () => {
    const updatedAt = '2026-08-04T15:56:00.000Z';
    expect(formatStudyProcessingTimestamp(updatedAt, 'fr')).toBe(
      new Date(updatedAt).toLocaleString('fr')
    );
  });

  it('falls back to the default locale instead of throwing on an invalid language tag', () => {
    const updatedAt = '2026-08-04T15:56:00.000Z';
    expect(() => new Date(updatedAt).toLocaleString('en-US@POSIX')).toThrow(RangeError);
    expect(formatStudyProcessingTimestamp(updatedAt, 'en-US@POSIX')).toBe(
      new Date(updatedAt).toLocaleString()
    );
  });
});

describe('resolveStudyProcessingLocale', () => {
  it('keeps valid tags and drops invalid or missing ones', () => {
    expect(resolveStudyProcessingLocale('fr-CA')).toBe('fr-CA');
    expect(resolveStudyProcessingLocale('en-US@POSIX')).toBeUndefined();
    expect(resolveStudyProcessingLocale(undefined)).toBeUndefined();
  });
});
