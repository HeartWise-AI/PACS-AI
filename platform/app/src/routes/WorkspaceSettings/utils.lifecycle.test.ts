import { InferenceModelLifecycle } from '../../api/inferenceDTO';
import { DEFAULT_CONTAINER_STATUS_COLORS } from './constants';
import { getLifecycleColor, resolveInferenceModelLifecycle } from './utils';

const container = {
  id: 'container-id',
  name: 'model',
  lifecycle: InferenceModelLifecycle.RUNNING,
  startedAt: 0,
  finishedAt: 0,
};

describe('inference model lifecycle compatibility', () => {
  it('keeps a valid normalized lifecycle', () => {
    expect(resolveInferenceModelLifecycle(container)).toBe(InferenceModelLifecycle.RUNNING);
  });

  it('normalizes a legacy Docker status during a rolling deployment', () => {
    const legacyContainer = { ...container, lifecycle: undefined, status: 'restarting' };

    expect(resolveInferenceModelLifecycle(legacyContainer)).toBe(InferenceModelLifecycle.STARTING);
  });

  it('uses unknown and default colors when neither contract supplies a known state', () => {
    const unavailableContainer = { ...container, lifecycle: undefined };

    expect(resolveInferenceModelLifecycle(unavailableContainer)).toBe(
      InferenceModelLifecycle.UNKNOWN
    );
    expect(getLifecycleColor(undefined)).toBe(DEFAULT_CONTAINER_STATUS_COLORS);
  });
});
