import {
  countsLine,
  examChips,
  examInProgress,
  formatElapsed,
  launchedBySummary,
  noResultText,
  readablePersonName,
  shortModelLabel,
  skipReasonLabel,
  STATE_CLASSES,
  stateLabel,
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

  test('a stalled model is a grey "never ran" chip, announced as "did not run"', () => {
    const stalledExam = exam({
      active: false,
      models: [
        model(),
        model({ modelName: 'CathEF-CLIP', state: 'stalled', cancellable: true, completedAt: null }),
        model({
          modelName: 'DeepRV-CLIP',
          state: 'expired',
          completedAt: null,
          skipReason: { code: 'EXPIRED_NEVER_RAN', message: null },
        }),
      ],
    });
    const chips = examChips(stalledExam, NOW.getTime(), t);
    expect(chips.map(chip => [chip.state, chip.text, chip.label])).toEqual([
      ['completed', 'JEPA ✓', 'DeepCORO-JEPA: Completed'],
      ['stalled', 'CathEF never ran', 'CathEF-CLIP: did not run'],
      ['expired', 'DeepRV expired', 'DeepRV-CLIP: Expired'],
    ]);
    expect(STATE_CLASSES.stalled).toContain('text-[#D6DAD2]');
    expect(STATE_CLASSES.expired).toContain('text-[#BDBDBD]');
    expect(stateLabel('stalled', t)).toBe('Never ran');
    expect(countsLine(stalledExam.counts, t)).toBe('1 completed · 1 never ran · 1 expired');
    expect(noResultText(stalledExam.models[1], t)).toBe('No result. It never ran.');
    expect(noResultText(stalledExam.models[2], t)).toBe(
      'No result. Closed automatically because it did not complete in time'
    );
    expect(skipReasonLabel('EXPIRED_NEVER_RAN', t)).toBe(
      'Closed automatically because it did not complete in time'
    );
  });

  test('an exam whose only unfinished models are stalled is not in progress', () => {
    const stalled = model({ modelName: 'CathEF-CLIP', state: 'stalled', completedAt: null });
    expect(examInProgress(exam({ models: [model(), stalled] }))).toBe(false);
    // Even if a client trusted an older server that still counted it active.
    expect(examInProgress(exam({ active: true, models: [model(), stalled] }))).toBe(false);
    expect(
      examInProgress(exam({ models: [stalled, model({ modelName: 'PanEcho', state: 'running' })] }))
    ).toBe(true);
    expect(examInProgress(exam({ models: [model({ state: 'queued' })] }))).toBe(true);
  });
});
