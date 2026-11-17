import {
  countsLine,
  examChips,
  formatElapsed,
  launchedBySummary,
  noResultText,
  readablePersonName,
  shortModelLabel,
} from './presentation';
import { exam, model, NOW, translate as t } from './testSupport';

describe('AI predictions presentation', () => {
  test('short model labels', () => {
    expect(
      [
        'DeepCORO-JEPA',
        'DeepCORO-SYNTAX',
        'DeepCORO_MACE',
        'CathEF-CLIP',
        'DeepRV-CLIP',
        'PanEcho',
        'DeepCORO-SCAD',
      ].map(shortModelLabel)
    ).toEqual(['JEPA', 'SYNTAX', 'MACE', 'CathEF', 'DeepRV', 'PanEcho', 'SCAD']);
  });

  test('one chip per model with its latest state written out', () => {
    const chips = examChips(
      exam({
        models: [
          model(),
          model({ modelName: 'CathEF-CLIP', state: 'waiting' }),
          model({ modelName: 'PanEcho', state: 'running', startedAt: '2026-11-16T09:59:42Z' }),
          model({ modelName: 'DeepRV-CLIP', state: 'failed' }),
          model({ modelName: 'DeepCORO-SYNTAX', state: 'skipped' }),
          model({ modelName: 'DeepCORO-CTO', state: 'cancelled' }),
        ],
      }),
      NOW.getTime(),
      t
    );
    expect(chips.map(chip => chip.text)).toEqual([
      'JEPA ✓',
      'CathEF waiting',
      'PanEcho running 0:18',
      'DeepRV failed',
      'SYNTAX skipped',
      'CTO cancelled',
    ]);
    expect(chips.map(chip => chip.state)).toEqual([
      'completed',
      'waiting',
      'running',
      'failed',
      'skipped',
      'cancelled',
    ]);
    expect(chips[3].label).toBe('DeepRV-CLIP: Failed');
  });

  test('a fully completed exam collapses into one chip', () => {
    const chips = examChips(
      exam({ models: ['A', 'B', 'C'].map(name => model({ modelName: name })) }),
      NOW.getTime(),
      t
    );
    expect(chips).toHaveLength(1);
    expect(chips[0].text).toBe('3 of 3 ✓');
  });

  test('counts line and elapsed time', () => {
    expect(
      countsLine(
        {
          total: 6,
          completed: 4,
          waiting: 1,
          queued: 0,
          running: 0,
          failed: 1,
          skipped: 0,
          cancelled: 0,
        },
        t
      )
    ).toBe('4 completed · 1 waiting · 1 failed');
    expect(formatElapsed('2026-11-16T08:58:05Z', NOW.getTime())).toBe('1:01:55');
    expect(formatElapsed(null, NOW.getTime())).toBeNull();
  });

  test('launched by: automatic with a rerun, a single user, unknown users', () => {
    expect(
      launchedBySummary(
        [
          {
            kind: 'automatic',
            trigger: 'AUTO',
            userId: null,
            name: null,
            you: false,
            runs: 1,
            firstAt: '',
          },
          {
            kind: 'user',
            trigger: 'VIEWER_REQUEST',
            userId: 'u-2',
            name: 'Dr Synthetic',
            you: false,
            runs: 1,
            firstAt: '',
          },
        ],
        t
      )
    ).toEqual({ primary: 'Automatic', detail: '+ Dr Synthetic (1 rerun)' });
    expect(
      launchedBySummary(
        [
          {
            kind: 'user',
            trigger: 'VIEWER_REQUEST',
            userId: 'u-1',
            name: 'Me',
            you: true,
            runs: 2,
            firstAt: '',
          },
        ],
        t
      )
    ).toEqual({ primary: 'You', detail: 'from the viewer' });
    expect(
      launchedBySummary(
        [
          {
            kind: 'automatic',
            trigger: 'AUTO',
            userId: null,
            name: null,
            you: false,
            runs: 1,
            firstAt: '',
          },
          {
            kind: 'user',
            trigger: 'MANUAL_REPROCESS',
            userId: 'u-2',
            name: null,
            you: false,
            runs: 2,
            firstAt: '',
          },
          {
            kind: 'user',
            trigger: 'VIEWER_REQUEST',
            userId: 'u-3',
            name: 'Dr B',
            you: false,
            runs: 1,
            firstAt: '',
          },
        ],
        t
      ).detail
    ).toBe('+ 2 others (3 reruns)');
    expect(launchedBySummary([], t).primary).toBe('—');
  });

  test('no-result text explains the state', () => {
    expect(noResultText(model({ state: 'waiting' }), t)).toBe('Exam still receiving images');
    expect(
      noResultText(
        model({ state: 'skipped', skipReason: { code: 'REQUIRED_SERIES_MISSING', message: null } }),
        t
      )
    ).toBe('No result. The images this model needs are missing');
    expect(noResultText(model({ state: 'failed', errorMessage: 'Container exited' }), t)).toBe(
      'No result. Container exited'
    );
  });

  test('DICOM person names are readable', () => {
    expect(readablePersonName('SYNTHETIC^PATIENT^^')).toBe('SYNTHETIC PATIENT');
    expect(readablePersonName(null)).toBeNull();
  });
});
