import { withSeriesInstanceUIDs } from './withSeriesInstanceUIDs';

describe('withSeriesInstanceUIDs', () => {
  it('adds the SeriesInstanceUID of active display sets', () => {
    const result = withSeriesInstanceUIDs(
      [{ displaySetInstanceUID: 'a', modality: 'XA' }, { displaySetInstanceUID: 'b' }],
      [{ displaySetInstanceUID: 'a', SeriesInstanceUID: '1.2.3' }]
    );
    expect(result).toEqual([
      { displaySetInstanceUID: 'a', modality: 'XA', SeriesInstanceUID: '1.2.3' },
      { displaySetInstanceUID: 'b' },
    ]);
  });

  it('leaves the display sets alone when there are no active display sets', () => {
    const displaySets = [{ displaySetInstanceUID: 'a' }];
    expect(withSeriesInstanceUIDs(displaySets, undefined)).toBe(displaySets);
  });
});
