// Test helpers for the AI Predictions page. Synthetic values only.
import english from '@pacs-ai/extension-core/src/locales/en-US/AiPredictions.json';
import type { PredictionExam, PredictionModel } from './types';

const strings = english as Record<string, string>;

export function translate(key: string, options?: Record<string, unknown>): string {
  const template = strings[key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
    options && name in options ? String(options[name]) : `{{${name}}}`
  );
}

export const NOW = new Date('2026-11-16T10:00:00Z');

export function model(overrides: Partial<PredictionModel> = {}): PredictionModel {
  return {
    runId: 'run-1',
    executionId: `execution-${overrides.modelName ?? 'DeepCORO-JEPA'}`,
    runNumber: 1,
    trigger: 'AUTO',
    requestedByUserId: null,
    requestedByName: null,
    requestedByYou: false,
    modelName: 'DeepCORO-JEPA',
    modelVersion: '2.1.0',
    modality: 'XA',
    state: 'completed',
    status: 'completed',
    errorMessage: null,
    skipReason: null,
    cancellable: false,
    cancelledAt: null,
    runCreatedAt: '2026-11-16T09:00:00Z',
    createdAt: '2026-11-16T09:00:00Z',
    updatedAt: '2026-11-16T09:05:00Z',
    startedAt: '2026-11-16T09:01:00Z',
    completedAt: '2026-11-16T09:05:00Z',
    durationSeconds: 240,
    earlierRuns: 0,
    ...overrides,
  };
}

export function exam(overrides: Partial<PredictionExam> = {}): PredictionExam {
  const models = overrides.models ?? [model()];
  const counts = {
    total: models.length,
    waiting: 0,
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    cancelled: 0,
    stalled: 0,
    expired: 0,
  };
  models.forEach(item => {
    counts[item.state] += 1;
  });
  return {
    studyInstanceUID: '1.2.826.0.1.3680043.10.1',
    patientId: 'SYN-MRN-1',
    accessionNumber: 'SYN-ACC-1',
    modalitiesInStudy: 'XA',
    studyDate: '20261116',
    lastActivityAt: '2026-11-16T09:05:00Z',
    active: models.some(item => ['waiting', 'queued', 'running'].includes(item.state)),
    counts,
    models,
    launchers: [
      {
        kind: 'automatic',
        trigger: 'AUTO',
        userId: null,
        name: null,
        you: false,
        runs: 1,
        firstAt: '2026-11-16T09:00:00Z',
      },
    ],
    ...overrides,
  };
}
