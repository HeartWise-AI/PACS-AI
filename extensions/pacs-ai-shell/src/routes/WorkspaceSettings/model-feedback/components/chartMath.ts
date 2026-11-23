/** Small helpers for the plain-SVG feedback charts. */

export type Scale = (value: number) => number;

/** Maps [d0, d1] onto [r0, r1] linearly. */
export function linearScale([d0, d1]: [number, number], [r0, r1]: [number, number]): Scale {
  const span = d1 - d0 || 1;
  return value => r0 + ((value - d0) / span) * (r1 - r0);
}

/** The smallest 1, 2, 5 × 10^n step at or above value / count. */
export function niceStep(value: number, count = 5): number {
  const raw = Math.max(value, 1) / Math.max(count, 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/** value rounded up to a multiple of a nice step. */
export function niceCeil(value: number, count = 5): number {
  if (value <= 0) {
    return 0;
  }
  const step = niceStep(value, count);
  return Math.ceil(value / step) * step;
}

/** Multiples of step from min to max, inclusive. */
export function ticks(min: number, max: number, step: number): number[] {
  if (step <= 0 || max < min) {
    return [];
  }
  const values: number[] = [];
  const first = Math.ceil(min / step) * step;
  for (let value = first; value <= max + step * 1e-9; value += step) {
    values.push(Math.round(value * 1e6) / 1e6);
  }
  return values;
}

export interface Point {
  x: number;
  y: number | null;
}

/** A line through the points, broken where y is null. */
export function linePath(points: Point[]): string {
  let path = '';
  let drawing = false;
  points.forEach(point => {
    if (point.y === null || Number.isNaN(point.y)) {
      drawing = false;
      return;
    }
    path += `${drawing ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    drawing = true;
  });
  return path;
}

/** The area under each unbroken run of points, down to baseline. */
export function areaPath(points: Point[], baseline: number): string {
  const runs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  points.forEach(point => {
    if (point.y === null || Number.isNaN(point.y)) {
      if (run.length) {
        runs.push(run);
      }
      run = [];
      return;
    }
    run.push({ x: point.x, y: point.y });
  });
  if (run.length) {
    runs.push(run);
  }
  return runs
    .filter(segment => segment.length > 1)
    .map(segment => {
      const top = segment.map(
        (point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`
      );
      const last = segment[segment.length - 1];
      return `${top.join('')}L${last.x.toFixed(1)},${baseline.toFixed(1)}L${segment[0].x.toFixed(1)},${baseline.toFixed(1)}Z`;
    })
    .join('');
}

/** Points with a value whose neighbours are both missing, drawn as dots. */
export function isolatedIndexes(values: (number | null)[]): number[] {
  return values
    .map((value, index) =>
      value !== null && (values[index - 1] ?? null) === null && (values[index + 1] ?? null) === null
        ? index
        : -1
    )
    .filter(index => index >= 0);
}
