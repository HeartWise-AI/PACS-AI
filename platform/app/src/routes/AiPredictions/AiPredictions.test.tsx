import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AiPredictionsPage, type AiPredictionsDependencies } from './AiPredictions';
import type { PredictionsRepository } from './predictionsRepository';
import { exam, model, NOW } from './testSupport';
import type { PredictionsPage } from './types';
import type { StudyNotificationMetadataResolver } from '../../components/inference/studyNotificationMetadata';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      jest.requireActual('./testSupport').translate(key, options),
  }),
}));

jest.mock('../../components/TopNavigation', () => ({
  __esModule: true,
  default: () => null,
}));

const STUDY = '1.2.826.0.1.3680043.10.1';

function page(overrides: Partial<PredictionsPage> = {}): PredictionsPage {
  return {
    view: 'mine',
    exams: [
      exam({
        models: [
          model({ earlierRuns: 1 }),
          model({
            modelName: 'CathEF-CLIP',
            state: 'waiting',
            cancellable: true,
            runId: 'run-2',
            completedAt: null,
          }),
          model({
            modelName: 'DeepRV-CLIP',
            state: 'failed',
            errorMessage: 'Synthetic failure',
            completedAt: null,
          }),
        ],
      }),
    ],
    limit: 25,
    offset: 0,
    total: 1,
    hasMore: false,
    canViewAll: false,
    ...overrides,
  };
}

function resolver(): StudyNotificationMetadataResolver {
  const metadata = {
    studyInstanceUID: STUDY,
    patientName: 'SYNTHETIC^PATIENT',
    patientId: 'SYN-MRN-1',
    accessionNumber: 'SYN-ACC-1',
    modalitiesInStudy: 'XA',
    studyDescription: 'Synthetic angiography',
  };
  return {
    clear: jest.fn(),
    peek: jest.fn(() => null),
    resolve: jest.fn(async () => metadata),
  };
}

const JEPA_LATEST = {
  predictions: {
    segments: { prox_lad: { display_pct: 80, display_category: 'severe', significant: true } },
  },
};
const JEPA_EARLIER = {
  predictions: {
    segments: { prox_lad: { display_pct: 40, display_category: 'moderate', significant: false } },
  },
};

function setup(overrides: Partial<AiPredictionsDependencies> = {}, role = 'USER') {
  const repository: jest.Mocked<PredictionsRepository> = {
    listPredictions: jest.fn(async params =>
      page({ view: params.view as PredictionsPage['view'] })
    ),
    loadModelHistory: jest.fn(async () => ({
      studyInstanceUID: STUDY,
      modelName: 'DeepCORO-JEPA',
      hasMore: false,
      executions: [
        model({ earlierRuns: 1 }),
        model({
          executionId: 'execution-earlier',
          runId: 'run-0',
          completedAt: '2026-11-15T09:05:00Z',
        }),
      ],
    })),
    exportCSV: jest.fn(async () => ({
      text:
        '﻿Run time,Study Instance UID,Accession number,MRN,Patient name,Modality,Model,Model version,Trigger,Launched by,Status,Duration (s),Key result,Failure or skip reason,Run ID,Execution ID\r\n' +
        `2026-11-16T09:00:00Z,${STUDY},SYN-ACC-1,SYN-MRN-1,,XA,DeepCORO-JEPA,2.1.0,Automatic,Automatic,completed,240.0,,,run-1,execution-DeepCORO-JEPA\r\n`,
      fileName: 'ai-predictions-20261116-100000.csv',
      truncated: false,
    })),
  };
  const resultClient = {
    loadExecutionResult: jest.fn(
      async ({ runId, executionId }: { runId: string; executionId: string }) => ({
        runId,
        executionId,
        studyInstanceUID: STUDY,
        modelName: 'DeepCORO-JEPA',
        modelVersion: '2.1.0',
        status: 'completed' as const,
        completedAt: '2026-11-16T09:05:00Z',
        result: executionId === 'execution-earlier' ? JEPA_EARLIER : JEPA_LATEST,
      })
    ),
  };
  const dependencies: AiPredictionsDependencies = {
    repository,
    resolver: resolver(),
    resultClient,
    loadCurrentUser: async () => ({ id: 'user-a', role }),
    loadAvailableModels: async () => [{ modelName: 'DeepRV-CLIP', containerId: 'container-rv' }],
    loadUsers: async () => [{ id: 'user-b', name: 'Dr Synthetic' }],
    cancelRun: jest.fn(async () => undefined),
    runModel: jest.fn(async () => undefined),
    saveFile: jest.fn(),
    now: () => NOW,
    ...overrides,
  };
  render(
    <MemoryRouter>
      <AiPredictionsPage {...dependencies} />
    </MemoryRouter>
  );
  return { repository, dependencies, resultClient };
}

describe('AI Predictions page', () => {
  test('a user sees My runs and Automatic runs; switching view queries the server', async () => {
    const { repository } = setup();
    await screen.findByText('SYNTHETIC PATIENT');
    expect(repository.listPredictions).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'mine', limit: '25', offset: '0' })
    );
    const group = screen.getByRole('group', { name: 'Whose runs' });
    expect(
      within(group)
        .getAllByRole('button')
        .map(button => button.textContent)
    ).toEqual(['My runs', 'Automatic runs']);
    expect(
      within(group).getByRole('button', { name: 'My runs' }).getAttribute('aria-pressed')
    ).toBe('true');

    fireEvent.click(within(group).getByRole('button', { name: 'Automatic runs' }));
    await waitFor(() =>
      expect(repository.listPredictions).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: 'automatic' })
      )
    );
    expect(screen.queryByLabelText('Launched by')).toBeNull();
  });

  test('an administrator also gets All runs and the Launched by filter', async () => {
    const { repository } = setup({}, 'ADMIN');
    await screen.findByText('SYNTHETIC PATIENT');
    fireEvent.click(screen.getByRole('button', { name: /All runs/ }));
    const launchedBy = await screen.findByLabelText('Launched by');
    await screen.findByRole('option', { name: 'Dr Synthetic' });
    fireEvent.change(launchedBy, { target: { value: 'user:user-b' } });
    await waitFor(() =>
      expect(repository.listPredictions).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: 'all', launchedBy: 'user:user-b' })
      )
    );
  });

  test('filters become query parameters and return to the first page', async () => {
    const { repository } = setup();
    await screen.findByText('SYNTHETIC PATIENT');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'attention' } });
    fireEvent.change(screen.getByLabelText('Modality'), { target: { value: 'US' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: 'any' } });
    const search = screen.getByLabelText('Patient, MRN or accession');
    fireEvent.change(search, { target: { value: 'SYN-ACC' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    await waitFor(() =>
      expect(repository.listPredictions).toHaveBeenLastCalledWith({
        view: 'mine',
        status: 'attention',
        modality: 'US',
        q: 'SYN-ACC',
        limit: '25',
        offset: '0',
      })
    );
  });

  test('rows show the patient, one chip per model and the counts', async () => {
    setup();
    const row = (await screen.findByText('SYNTHETIC PATIENT')).closest('tr') as HTMLElement;
    expect(within(row).getByText('MRN SYN-MRN-1 · XA · Synthetic angiography')).toBeTruthy();
    const chips = within(row).getAllByTestId('ai-predictions-chip');
    expect(chips.map(chip => chip.getAttribute('data-state'))).toEqual([
      'completed',
      'waiting',
      'failed',
    ]);
    expect(chips.map(chip => chip.textContent)).toEqual([
      'JEPA ✓DeepCORO-JEPA: Completed',
      'CathEF waitingCathEF-CLIP: Waiting',
      'DeepRV failedDeepRV-CLIP: Failed',
    ]);
    expect(within(row).getByText('1 completed · 1 waiting · 1 failed')).toBeTruthy();
    expect(within(row).getByText('in progress')).toBeTruthy();
    expect(within(row).getByText('Automatic')).toBeTruthy();
    expect(within(row).getByRole('link', { name: 'Open exam' }).getAttribute('href')).toBe(
      `/viewer?StudyInstanceUIDs=${encodeURIComponent(STUDY)}`
    );
  });

  test('expanding an exam lists its models with key result, Why, Cancel and Run again', async () => {
    const { dependencies } = setup();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Expand exam of SYNTHETIC PATIENT' })
    );
    const jepa = screen.getByTestId('ai-predictions-model-DeepCORO-JEPA');
    await waitFor(() =>
      expect(within(jepa).getByTestId('ai-predictions-key-result').textContent).toBe(
        'Significant stenosis: Proximal LAD 80%'
      )
    );
    expect(within(jepa).getByRole('button', { name: 'Result' })).toBeTruthy();
    expect(within(jepa).getByRole('button', { name: 'Raw data' })).toBeTruthy();

    const cathEF = screen.getByTestId('ai-predictions-model-CathEF-CLIP');
    expect(within(cathEF).getByTestId('ai-predictions-key-result').textContent).toBe(
      'Exam still receiving images'
    );
    fireEvent.click(within(cathEF).getByRole('button', { name: 'Cancel' }));
    expect(
      within(cathEF).getByText(
        'This cancels every model of this run that has not started: CathEF-CLIP.'
      )
    ).toBeTruthy();
    fireEvent.click(within(cathEF).getByRole('button', { name: 'Cancel these models' }));
    await waitFor(() => expect(dependencies.cancelRun).toHaveBeenCalledWith('run-2'));

    const deepRV = screen.getByTestId('ai-predictions-model-DeepRV-CLIP');
    const why = within(deepRV).getByRole('button', { name: 'Why' });
    expect(why.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(why);
    expect(within(deepRV).getByText('Synthetic failure', { selector: 'p' })).toBeTruthy();
    fireEvent.click(within(deepRV).getByRole('button', { name: 'Run again' }));
    await waitFor(() => expect(dependencies.runModel).toHaveBeenCalledWith(STUDY, 'container-rv'));
    await screen.findByText('A new run was started.');
  });

  test('earlier runs fold out and compare with the latest', async () => {
    const { repository } = setup();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Expand exam of SYNTHETIC PATIENT' })
    );
    const jepa = screen.getByTestId('ai-predictions-model-DeepCORO-JEPA');
    const toggle = within(jepa).getByRole('button', { name: /1 earlier run/ });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const list = await within(jepa).findByRole('list', { name: 'Earlier runs of DeepCORO-JEPA' });
    expect(repository.loadModelHistory).toHaveBeenCalledWith(STUDY, 'DeepCORO-JEPA');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    await within(jepa).findByText('Differs from the previous run');

    fireEvent.click(within(list).getByRole('button', { name: 'Compare with latest' }));
    const dialog = await screen.findByRole('dialog', { name: 'Compare with latest' });
    // Nested results: two raw JSON panes.
    await within(dialog).findByRole('region', { name: 'Latest run' });
    expect(within(dialog).getByRole('region', { name: 'Earlier run' }).textContent).toContain(
      '"display_pct": 40'
    );
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('Export CSV respects the filters and fills patient names and key results', async () => {
    const { repository, dependencies } = setup();
    await screen.findByText('SYNTHETIC PATIENT');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV (one line per model run)' }));
    await waitFor(() => expect(dependencies.saveFile).toHaveBeenCalled());
    expect(repository.exportCSV).toHaveBeenCalledWith({
      view: 'mine',
      status: 'completed',
      from: new Date(NOW.getTime() - 7 * 24 * 3600 * 1000).toISOString(),
    });
    const [fileName, text] = (dependencies.saveFile as jest.Mock).mock.calls[0];
    expect(fileName).toBe('ai-predictions-20261116-100000.csv');
    expect(text).toContain('SYN-MRN-1,SYNTHETIC PATIENT,XA,DeepCORO-JEPA');
    expect(text).toContain('Significant stenosis: Proximal LAD 80%');
    expect(screen.getByText('Export saved.')).toBeTruthy();
  });

  test('empty state', async () => {
    const listPredictions = jest.fn(async () => page({ exams: [], total: 0 }));
    setup({ repository: { listPredictions, loadModelHistory: jest.fn(), exportCSV: jest.fn() } });
    expect((await screen.findByTestId('ai-predictions-empty')).textContent).toBe(
      'No exam with a run you launched matches these filters.'
    );
    expect(listPredictions).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Showing 0–0 of 0 exams')).toBeTruthy();
  });

  test('an invalid custom range is explained and not requested', async () => {
    const { repository } = setup();
    await screen.findByText('SYNTHETIC PATIENT');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-01' } });
    await waitFor(() =>
      expect(repository.listPredictions).toHaveBeenLastCalledWith(
        expect.objectContaining({ to: new Date(2026, 10, 2).toISOString() })
      )
    );
    const calls = repository.listPredictions.mock.calls.length;
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-10' } });
    expect(
      (
        await screen.findByText(
          'Choose a start or end date; the end date cannot be before the start date.'
        )
      ).getAttribute('role')
    ).toBe('alert');
    expect(screen.getByLabelText('To').getAttribute('aria-invalid')).toBe('true');
    expect(repository.listPredictions.mock.calls.length).toBe(calls);
    expect(
      (
        screen.getByRole('button', {
          name: 'Export CSV (one line per model run)',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  test('a failed load offers to try again', async () => {
    const listPredictions = jest
      .fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValue(page());
    setup({ repository: { listPredictions, loadModelHistory: jest.fn(), exportCSV: jest.fn() } });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('AI predictions could not be loaded.');
    await act(async () => {
      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    });
    await screen.findByText('SYNTHETIC PATIENT');
    expect(listPredictions).toHaveBeenCalledTimes(2);
  });

  test('pagination moves by one page', async () => {
    const listPredictions = jest.fn(async (params: Record<string, string>) =>
      page({ total: 60, hasMore: params.offset !== '50', offset: Number(params.offset) })
    );
    setup({ repository: { listPredictions, loadModelHistory: jest.fn(), exportCSV: jest.fn() } });
    await screen.findByText('Showing 1–1 of 60 exams');
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(listPredictions).toHaveBeenLastCalledWith(expect.objectContaining({ offset: '25' }))
    );
  });
});
