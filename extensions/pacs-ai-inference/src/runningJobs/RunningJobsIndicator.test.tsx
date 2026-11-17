import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import english from '@pacs-ai/extension-core/src/locales/en-US/AIModelButton.json';
import french from '@pacs-ai/extension-core/src/locales/fr/AIModelButton.json';
import { RunningJobsIndicator, type RunningJobsIndicatorProps } from './RunningJobsIndicator';
import { jobRow, translate, viewerResult } from './testSupport';
import type { RunningJobRow } from './types';

let mockStrings: Record<string, string> = english;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      jest.requireActual('./testSupport').translate(mockStrings, key, options),
  }),
}));

const NOW = 1_065_000;

function text(node: { children: unknown[] }): string {
  return node.children
    .map(child =>
      typeof child === 'string' ? child : text(child as unknown as { children: unknown[] })
    )
    .join('');
}

describe('RunningJobsIndicator', () => {
  let renderer: ReactTestRenderer | null = null;
  const onToggleCollapsed = jest.fn();
  const onClose = jest.fn();
  const onOpenResult = jest.fn();

  function render(rows: RunningJobRow[], props: Partial<RunningJobsIndicatorProps> = {}) {
    act(() => {
      renderer = TestRenderer.create(
        <RunningJobsIndicator
          rows={rows}
          now={NOW}
          collapsed={false}
          onToggleCollapsed={onToggleCollapsed}
          onClose={onClose}
          onOpenResult={onOpenResult}
          {...props}
        />
      );
    });
    return renderer!.root;
  }

  const byTestId = (id: string) => renderer!.root.findAllByProps({ 'data-testid': id });

  beforeEach(() => {
    mockStrings = english;
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test('renders nothing without rows', () => {
    render([]);
    expect(renderer!.toJSON()).toBeNull();
  });

  test('shows a running model with its elapsed time and an indeterminate bar', () => {
    const root = render([jobRow()]);
    const card = root.findByProps({ 'data-testid': 'running-jobs-indicator' });

    expect(card.props.role).toBe('status');
    expect(card.props['aria-live']).toBe('polite');
    expect(card.props.className).toContain('w-[280px]');
    expect(card.props.className).toContain('z-30');
    expect(card.props.className).toContain('bottom-4 right-4');

    const cardText = text(card);
    expect(cardText).toContain('AI analysis');
    expect(cardText).toContain('1 running');
    expect(cardText).toContain('DeepCORO');
    expect(cardText).toContain('Running');
    expect(cardText).toContain('01:05');

    const [timer] = byTestId('running-jobs-elapsed');
    expect(timer.props.role).toBe('timer');
    expect(timer.props['aria-label']).toBe('Elapsed time 01:05');
    expect(byTestId('running-jobs-progress-indeterminate')).toHaveLength(1);
    expect(byTestId('running-jobs-progress')).toHaveLength(0);
    expect(byTestId('running-jobs-count')).toHaveLength(0);
    // Header and row spinners, stopped for users who prefer reduced motion.
    const spinners = byTestId('running-jobs-spinner');
    expect(spinners).toHaveLength(2);
    expect(spinners[0].props.className).toContain('animate-spin');
    expect(spinners[0].props.className).toContain('motion-reduce:animate-none');
    expect(byTestId('running-jobs-open-result')).toHaveLength(0);
  });

  test('shows mixed runs: counts for a processing run, states per row', () => {
    render([
      jobRow({ id: 'a', state: 'queued', startedAt: NOW - 2000 }),
      jobRow({
        id: 'b',
        kind: 'processing',
        modelName: null,
        trigger: 'AUTO',
        progress: { done: 2, total: 7 },
        runningModelNames: ['Model A', 'Model C'],
      }),
      jobRow({
        id: 'c',
        modelName: 'CathEF',
        state: 'failed',
        active: false,
        endedAt: NOW - 1000,
      }),
      jobRow({
        id: 'd',
        kind: 'processing',
        modelName: null,
        trigger: 'MANUAL_REPROCESS',
        state: 'finishing',
        progress: { done: 3, total: 3 },
      }),
    ]);

    const rows = byTestId('running-jobs-row');
    expect(rows.map(row => row.props['data-state'])).toEqual([
      'queued',
      'running',
      'failed',
      'finishing',
    ]);
    expect(text(rows[0])).toContain('Queued');
    expect(text(rows[0])).toContain('00:02');
    expect(text(rows[1])).toContain('Automatic analysis');
    expect(text(rows[1])).toContain('2 of 7 models');
    expect(text(rows[1])).toContain('Model A, Model C');
    expect(text(rows[2])).toContain('Failed');
    expect(text(rows[2])).toContain('01:04');
    expect(text(rows[3])).toContain('Reprocessing');
    expect(text(rows[3])).toContain('Finishing…');

    const bars = byTestId('running-jobs-progress');
    expect(bars).toHaveLength(2);
    expect(bars[0].props['aria-valuenow']).toBe(2);
    expect(bars[0].props['aria-valuemax']).toBe(7);
    expect(bars[0].children[0]).toMatchObject({ props: { style: { width: `${(2 / 7) * 100}%` } } });
    // Three active rows; the failed one has neither spinner nor bar.
    expect(text(renderer!.root.findByProps({ 'data-testid': 'running-jobs-indicator' }))).toContain(
      '3 running'
    );
    expect(byTestId('running-jobs-spinner')).toHaveLength(4);
    expect(byTestId('running-jobs-progress-indeterminate')).toHaveLength(1);
  });

  test('a finished row opens its result; other finished rows are not clickable', () => {
    const done = jobRow({
      id: 'a',
      state: 'done',
      active: false,
      endedAt: NOW,
      result: viewerResult(),
    });
    render([
      done,
      jobRow({ id: 'b', modelName: 'EchoPrime', state: 'skipped', active: false, endedAt: NOW }),
      jobRow({ id: 'c', kind: 'processing', modelName: null, state: 'done', active: false }),
    ]);

    const card = renderer!.root.findByProps({ 'data-testid': 'running-jobs-indicator' });
    expect(text(card)).toContain('Finished');
    expect(text(card)).toContain('Skipped');
    expect(text(card)).toContain('Study processing');
    expect(byTestId('running-jobs-spinner')).toHaveLength(0);
    expect(byTestId('running-jobs-progress')).toHaveLength(0);
    expect(byTestId('running-jobs-progress-indeterminate')).toHaveLength(0);

    const buttons = byTestId('running-jobs-open-result');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props['aria-label']).toBe('DeepCORO: View result');
    act(() => buttons[0].props.onClick());
    expect(onOpenResult).toHaveBeenCalledWith(done);
  });

  test('collapses to a pill with the count, and has labelled buttons', () => {
    render([jobRow(), jobRow({ id: 'b' })]);
    const [collapse] = byTestId('running-jobs-collapse');
    const [close] = byTestId('running-jobs-close');
    expect(collapse.props['aria-label']).toBe('Collapse');
    expect(close.props['aria-label']).toBe('Hide until a new run starts');
    act(() => collapse.props.onClick());
    act(() => close.props.onClick());
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    render([jobRow(), jobRow({ id: 'b' })], { collapsed: true });
    const [pill] = byTestId('running-jobs-pill');
    expect(text(pill)).toBe('2 running');
    expect(pill.props['aria-label']).toBe('Show AI analysis status (2 running)');
    expect(pill.props['aria-expanded']).toBe(false);
    expect(byTestId('running-jobs-row')).toHaveLength(0);
    expect(byTestId('running-jobs-indicator')[0].props.role).toBe('status');
    act(() => pill.props.onClick());
    expect(onToggleCollapsed).toHaveBeenCalledTimes(2);
  });

  test('moves aside while the result-ready notice uses the corner', () => {
    const root = render([jobRow()], { besideReadyNotice: true });
    const card = root.findByProps({ 'data-testid': 'running-jobs-indicator' });
    expect(card.props.className).toContain('sm:right-[21.5rem]');
  });

  test('renders in French', () => {
    mockStrings = french;
    render([
      jobRow({ state: 'queued' }),
      jobRow({
        id: 'b',
        kind: 'processing',
        modelName: null,
        trigger: 'AUTO',
        progress: { done: 2, total: 7 },
      }),
    ]);

    const cardText = text(renderer!.root.findByProps({ 'data-testid': 'running-jobs-indicator' }));
    expect(cardText).toContain('Analyse IA');
    expect(cardText).toContain('2 en cours');
    expect(cardText).toContain("En file d'attente");
    expect(cardText).toContain('Analyse automatique');
    expect(cardText).toContain('2 sur 7 modèles');
    expect(byTestId('running-jobs-collapse')[0].props['aria-label']).toBe('Réduire');
  });
});

describe('running jobs translations', () => {
  const keys = Object.keys(english).filter(key => key.startsWith('RunningJobs'));

  test('English and French define every string, with the same placeholders', () => {
    expect(keys.length).toBeGreaterThanOrEqual(18);
    const placeholders = (value: string) => (value.match(/{{\w+}}/g) ?? []).sort();
    keys.forEach(key => {
      const frenchValue = (french as Record<string, string>)[key];
      const englishValue = (english as Record<string, string>)[key];
      expect(frenchValue).toBeTruthy();
      expect(placeholders(frenchValue)).toEqual(placeholders(englishValue));
    });
    expect(translate(french, 'RunningJobsStateFinishing')).toBe('Finalisation…');
    expect(translate(french, 'RunningJobsStateFailed')).toBe('Échec');
  });

  test('every key the component uses exists', () => {
    const source = jest
      .requireActual('fs')
      .readFileSync(require.resolve('./RunningJobsIndicator.tsx'), 'utf8') as string;
    const used = [...new Set(source.match(/RunningJobs[A-Z]\w+/g) ?? [])].filter(
      key => !key.startsWith('RunningJobsIndicator')
    );
    expect(used.length).toBeGreaterThan(10);
    used.forEach(key => expect(keys).toContain(key));
    keys.forEach(key => expect(used).toContain(key));
  });
});
