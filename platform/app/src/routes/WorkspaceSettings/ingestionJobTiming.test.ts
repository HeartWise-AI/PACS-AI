import { getIngestionJobTimingMinutes } from './ingestionJobTiming';

describe('ingestion job timing returned by the backend', () => {
  it('preserves a configured stability period when the legacy field is absent', () => {
    expect(getIngestionJobTimingMinutes({ stabilityMinutes: 15 })).toBe(15);
    expect(getIngestionJobTimingMinutes({ stabilityMinutes: 5 })).toBe(5);
  });

  it('supports older servers without overriding the modern value', () => {
    expect(getIngestionJobTimingMinutes({ intervalInMinutes: 10 })).toBe(10);
    expect(getIngestionJobTimingMinutes({ stabilityMinutes: 15, intervalInMinutes: 5 })).toBe(15);
  });

  it('does not invent a value for missing or invalid configuration', () => {
    expect(getIngestionJobTimingMinutes({})).toBeUndefined();
    expect(getIngestionJobTimingMinutes({ stabilityMinutes: NaN })).toBeUndefined();
    expect(getIngestionJobTimingMinutes({ stabilityMinutes: -1 })).toBeUndefined();
    expect(getIngestionJobTimingMinutes({ stabilityMinutes: 0 })).toBeUndefined();
    expect(getIngestionJobTimingMinutes({ intervalInMinutes: 4 })).toBeUndefined();
  });
});
