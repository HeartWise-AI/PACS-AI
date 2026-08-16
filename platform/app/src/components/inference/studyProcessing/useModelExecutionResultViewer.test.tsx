import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import type { ModelExecutionResultClient } from './executionResultClient';
import { modelExecutionResultFixtures } from './executionResultFixtures';
import {
  ModelExecutionResultQueryCoordinator,
  type ModelExecutionResultSelection,
} from './executionResultQuery';
import {
  useModelExecutionResultViewer,
  type ModelExecutionResultViewerController,
} from './useModelExecutionResultViewer';

const selection: ModelExecutionResultSelection = {
  studyInstanceUID: modelExecutionResultFixtures.available.studyInstanceUID,
  runId: modelExecutionResultFixtures.available.runId,
  executionId: modelExecutionResultFixtures.available.executionId,
  modelName: modelExecutionResultFixtures.available.modelName,
  modelVersion: modelExecutionResultFixtures.available.modelVersion,
  status: 'completed',
};

let controller: ModelExecutionResultViewerController;

function Harness({
  coordinator,
  resetKey,
}: {
  coordinator: ModelExecutionResultQueryCoordinator;
  resetKey: string | null;
}) {
  controller = useModelExecutionResultViewer(resetKey, coordinator);
  return null;
}

describe('useModelExecutionResultViewer', () => {
  let renderer: ReactTestRenderer | null = null;
  let trigger: HTMLButtonElement | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    trigger?.remove();
    trigger = null;
  });

  test('requests only after selection, clears on close, and restores trigger focus', async () => {
    const loadExecutionResult = jest.fn().mockResolvedValue(modelExecutionResultFixtures.available);
    const coordinator = new ModelExecutionResultQueryCoordinator({
      loadExecutionResult,
    } as ModelExecutionResultClient);
    trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    act(() => {
      renderer = TestRenderer.create(
        <Harness
          coordinator={coordinator}
          resetKey="tenant-a"
        />
      );
    });
    expect(loadExecutionResult).not.toHaveBeenCalled();

    await act(async () => {
      controller.open(selection, trigger);
      await Promise.resolve();
    });

    expect(loadExecutionResult).toHaveBeenCalledTimes(1);
    expect(controller.state).toMatchObject({
      status: 'ready',
      result: modelExecutionResultFixtures.available,
    });

    act(() => controller.close());

    expect(controller.state.status).toBe('idle');
    expect(document.activeElement).toBe(trigger);
  });

  test('clears selected result state when the authenticated identity changes', async () => {
    const loadExecutionResult = jest.fn().mockResolvedValue(modelExecutionResultFixtures.available);
    const coordinator = new ModelExecutionResultQueryCoordinator({
      loadExecutionResult,
    } as ModelExecutionResultClient);

    act(() => {
      renderer = TestRenderer.create(
        <Harness
          coordinator={coordinator}
          resetKey="tenant-a"
        />
      );
    });
    await act(async () => {
      controller.open(selection);
      await Promise.resolve();
    });
    expect(controller.state.status).toBe('ready');

    act(() => {
      renderer!.update(
        <Harness
          coordinator={coordinator}
          resetKey="tenant-b"
        />
      );
    });

    expect(controller.state.status).toBe('idle');
    expect(controller.state.result).toBeNull();
  });
});
