import {
  cineFrameRate,
  frameRateFromFrameTimeVector,
  resolveFrameRate,
  roundFrameRate,
} from './cineFrameRate';

/** Shimadzu XA as stored on MHI: no Cine Rate, no Frame Time. */
const SHIMADZU_FTV = ['0.00', '133.00', '136.00', '131.00', '133.00', '152.00', '115.00', '133.00'];
const shimadzuXA = {
  FrameTimeVector: SHIMADZU_FTV,
  RecommendedDisplayFrameRate: 7,
};
/** One Shimadzu series has no Frame Time Vector. */
const shimadzuXAWithoutVector = { RecommendedDisplayFrameRate: 7 };
/** Siemens Artis XA: Cine Rate and Frame Time agree (15 fps). */
const siemensXA = { CineRate: 15, FrameTime: 66.66667, RecommendedDisplayFrameRate: 15 };
/** Philips Allura XA: Frame Time only (7.5 fps). */
const philipsXA = { FrameTime: '133.33' };
/** Philips I2 IVUS: Cine Rate 29. */
const philipsIVUS = { CineRate: '29', FrameTime: 34.48 };
/** GE Vivid echo: Frame Time only. */
const geEcho = { FrameTime: 19.5 };

describe('resolveFrameRate', () => {
  test('Cine Rate comes first', () => {
    expect(resolveFrameRate(siemensXA)).toEqual({ fps: 15, source: 'CineRate' });
    expect(resolveFrameRate(philipsIVUS)).toEqual({ fps: 29, source: 'CineRate' });
    expect(resolveFrameRate({ CineRate: 30, FrameTimeVector: [0, 133, 133] })?.source).toBe(
      'CineRate'
    );
  });

  test('then 1000 / Frame Time', () => {
    const resolved = resolveFrameRate({ FrameTime: 40, FrameTimeVector: [0, 133, 133] });
    expect(resolved).toEqual({ fps: 25, source: 'FrameTime' });
    expect(resolveFrameRate(philipsXA)?.source).toBe('FrameTime');
    expect(resolveFrameRate(geEcho)?.fps).toBeCloseTo(51.28, 2);
  });

  test('then 1000 / median Frame Time Vector, skipping the leading 0', () => {
    const resolved = resolveFrameRate(shimadzuXA);
    expect(resolved?.source).toBe('FrameTimeVector');
    expect(resolved?.fps).toBeCloseTo(1000 / 133, 6);
  });

  test('then Recommended Display Frame Rate', () => {
    expect(resolveFrameRate(shimadzuXAWithoutVector)).toEqual({
      fps: 7,
      source: 'RecommendedDisplayFrameRate',
    });
    expect(resolveFrameRate({ RecommendedDisplayFrameRate: ['12'] })?.fps).toBe(12);
  });

  test('falls through bad values to the next tag, and to undefined', () => {
    expect(resolveFrameRate({ CineRate: 0, FrameTime: 100 })).toEqual({
      fps: 10,
      source: 'FrameTime',
    });
    expect(
      resolveFrameRate({ CineRate: '', FrameTime: 0, RecommendedDisplayFrameRate: 7 })
    ).toEqual({ fps: 7, source: 'RecommendedDisplayFrameRate' });
    expect(
      resolveFrameRate({ FrameTimeVector: [0, 0, 0], RecommendedDisplayFrameRate: 7 })?.source
    ).toBe('RecommendedDisplayFrameRate');
    expect(resolveFrameRate({ CineRate: 'abc', RecommendedDisplayFrameRate: 0 })).toBeUndefined();
    expect(resolveFrameRate({})).toBeUndefined();
    expect(resolveFrameRate(undefined)).toBeUndefined();
    expect(resolveFrameRate(null)).toBeUndefined();
  });
});

describe('frameRateFromFrameTimeVector', () => {
  test('accepts arrays of strings or numbers and backslash strings', () => {
    expect(frameRateFromFrameTimeVector([0, 133, 133, 134])).toBeCloseTo(1000 / 133, 6);
    expect(frameRateFromFrameTimeVector('0.00\\133.00\\133.00\\134.00')).toBeCloseTo(1000 / 133, 6);
  });

  test('ignores zero and absurd intervals and uses the median', () => {
    // a dropped frame (400 ms) and a 0 / 0.1 ms glitch do not move the median
    expect(frameRateFromFrameTimeVector([0, 133, 0, 400, 133, 0.1, 134, 99999])).toBeCloseTo(
      1000 / 133.5,
      6
    );
    // even count: mean of the two middle values
    expect(frameRateFromFrameTimeVector([0, 100, 200])).toBeCloseTo(1000 / 150, 6);
  });

  test('needs at least one interval after the first entry', () => {
    expect(frameRateFromFrameTimeVector([0])).toBeUndefined();
    expect(frameRateFromFrameTimeVector(133)).toBeUndefined();
    expect(frameRateFromFrameTimeVector([])).toBeUndefined();
    expect(frameRateFromFrameTimeVector(undefined)).toBeUndefined();
    expect(frameRateFromFrameTimeVector(['0', 'x', ''])).toBeUndefined();
  });
});

describe('roundFrameRate / cineFrameRate', () => {
  test('one decimal under 10 fps, whole numbers above', () => {
    expect(roundFrameRate(1000 / 133)).toBe(7.5);
    expect(roundFrameRate(1000 / 133.33)).toBe(7.5);
    expect(roundFrameRate(1000 / 66.67)).toBe(15);
    expect(roundFrameRate(1000 / 33.3)).toBe(30);
    expect(roundFrameRate(29)).toBe(29);
  });

  test('fixtures play at their acquisition rate', () => {
    expect(cineFrameRate(shimadzuXA)).toBe(7.5);
    expect(cineFrameRate(shimadzuXAWithoutVector)).toBe(7);
    expect(cineFrameRate(siemensXA)).toBe(15);
    expect(cineFrameRate(philipsXA)).toBe(7.5);
    expect(cineFrameRate(philipsIVUS)).toBe(29);
    expect(cineFrameRate(geEcho)).toBe(51);
    expect(cineFrameRate({})).toBeUndefined();
  });
});
