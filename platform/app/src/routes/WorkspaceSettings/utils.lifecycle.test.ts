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

  it('uses unknown when lifecycle is missing', () => {
    const unavailableContainer = { ...container, lifecycle: undefined };

    expect(resolveInferenceModelLifecycle(unavailableContainer)).toBe(
      InferenceModelLifecycle.UNKNOWN
    );
  });

  it('uses unknown and default colors for an invalid lifecycle', () => {
    const invalidContainer = { ...container, lifecycle: 'invalid' };

    expect(resolveInferenceModelLifecycle(invalidContainer)).toBe(InferenceModelLifecycle.UNKNOWN);
    expect(getLifecycleColor(undefined)).toBe(DEFAULT_CONTAINER_STATUS_COLORS);
  });
});
