import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import ModelDeploymentProgressPanel from './ModelDeploymentProgressPanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ModelDeploymentProgressPanel', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    act(() => renderer?.unmount());
  });

  test('shows the current stage, status, elapsed time, and live transport', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelDeploymentProgressPanel
          deployment={{
            modelId: 'model-1',
            connectionMode: 'live',
            progress: {
              deploymentId: 'deployment-1',
              status: 'RUNNING',
              stage: 'pull',
              sequence: 4,
              timestamp: Date.now(),
              elapsedMilliseconds: 25_000,
              terminal: false,
            },
          }}
        />
      );
    });

    const rendered = JSON.stringify(renderer.toJSON());
    expect(rendered).toContain('Pulling image');
    expect(rendered).toContain('Running');
    expect(rendered).toContain('Elapsed');
    expect(rendered).toContain('Live updates');
  });

  test('renders rollback errors distinctly without reconnect status', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelDeploymentProgressPanel
          deployment={{
            modelId: 'model-1',
            connectionMode: 'polling',
            progress: {
              deploymentId: 'deployment-1',
              status: 'ROLLED_BACK',
              stage: 'activate_candidate',
              sequence: 8,
              timestamp: 2000,
              elapsedMilliseconds: 90_000,
              terminal: true,
              errorMessage: 'Activation failed.',
            },
          }}
        />
      );
    });

    const rendered = JSON.stringify(renderer.toJSON());
    expect(rendered).toContain('Rolled back');
    expect(rendered).toContain('Activation failed.');
    expect(rendered).not.toContain('Reconnecting');
  });
});
