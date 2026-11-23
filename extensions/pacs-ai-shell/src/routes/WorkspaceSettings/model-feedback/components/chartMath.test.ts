import { areaPath, isolatedIndexes, linePath, linearScale, niceCeil, ticks } from './chartMath';

describe('chartMath', () => {
  test('linearScale maps the domain onto the range', () => {
    const scale = linearScale([0, 100], [200, 0]);
    expect(scale(0)).toBe(200);
    expect(scale(50)).toBe(100);
    expect(scale(100)).toBe(0);
  });

  test('niceCeil rounds up to a 1-2-5 step', () => {
    expect(niceCeil(61, 7)).toBe(70);
    expect(niceCeil(61)).toBe(80);
    expect(niceCeil(8)).toBe(8);
    expect(niceCeil(13)).toBe(15);
    expect(niceCeil(0)).toBe(0);
  });

  test('ticks are inclusive multiples of the step', () => {
    expect(ticks(-20, 70, 10)).toEqual([-20, -10, 0, 10, 20, 30, 40, 50, 60, 70]);
    expect(ticks(55, 100, 10)).toEqual([60, 70, 80, 90, 100]);
  });

  test('linePath breaks on null', () => {
    expect(
      linePath([
        { x: 0, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: null },
        { x: 3, y: 4 },
      ])
    ).toBe('M0.0,1.0L1.0,2.0M3.0,4.0');
  });

  test('areaPath closes each run of two or more points to the baseline', () => {
    expect(
      areaPath(
        [
          { x: 0, y: 1 },
          { x: 1, y: 2 },
          { x: 2, y: null },
          { x: 3, y: 4 },
        ],
        10
      )
    ).toBe('M0.0,1.0L1.0,2.0L1.0,10.0L0.0,10.0Z');
  });

  test('isolatedIndexes finds points with no neighbours', () => {
    expect(isolatedIndexes([null, 1, null, 2, 3, null])).toEqual([1]);
  });
});
