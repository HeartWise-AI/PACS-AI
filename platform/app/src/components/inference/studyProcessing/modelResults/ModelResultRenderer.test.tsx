import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { modelExecutionResultFixtures } from '../executionResultFixtures';
import { cardioSyntaxResultFixtures } from './cardioSyntaxFixtures';
import { cathEfClipResultFixtures } from './cathEfClipFixtures';
import { cathEfResultFixtures } from './cathEfFixtures';
import { deepCoroClipResultFixtures } from './deepCoroClipFixtures';
import { deepCoroCtoResultFixtures } from './deepCoroCtoFixtures';
import { deepCoroMaceResultFixtures } from './deepCoroMaceFixtures';
import { deepCoroSyntaxResultFixtures } from './deepCoroSyntaxFixtures';
import { deepRVClipResultFixtures } from './deepRVClipFixtures';
import { deepRVResultFixtures } from './deepRVFixtures';
import { echoPrimeResultFixtures } from './echoPrimeFixtures';
import { panEchoResultFixtures } from './panEchoFixtures';
import { readableResultFixtures } from '../readableResultFixtures';
import { ModelResultRenderer, ModelResultRendererBoundary } from './ModelResultRenderer';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
  }),
}));

function ThrowingRenderer(): React.ReactElement {
  throw new Error('synthetic renderer failure');
}

describe('ModelResultRenderer', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    jest.restoreAllMocks();
  });

  test('renders a valid CardioSyntax payload with the custom component', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            result: cardioSyntaxResultFixtures.validV1,
          }}
        />
      );
    });

    expect(renderer!.root.findAllByProps({ 'data-testid': 'cardiosyntax-result' })).toHaveLength(1);
  });

  test('renders a valid CathEF payload with the custom component', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'CathEF',
            modelVersion: '1.6.0',
            result: cathEfResultFixtures.withLvefV1,
          }}
        />
      );
    });

    expect(renderer!.root.findAllByProps({ 'data-testid': 'cathef-result' })).toHaveLength(1);
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'generic-model-result-collection' })
    ).toHaveLength(0);
  });

  test('renders a valid CathEF-CLIP payload with the custom component', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'CathEF-CLIP',
            modelVersion: '1.0.0',
            result: cathEfClipResultFixtures.reducedV1,
          }}
        />
      );
    });

    expect(renderer!.root.findAllByProps({ 'data-testid': 'cathef-clip-result' })).toHaveLength(1);
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'generic-model-result-collection' })
    ).toHaveLength(0);
  });

  test('renders a valid DeepCORO-CLIP payload with the custom component', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'DeepCORO-CLIP',
            modelVersion: '1.0.0',
            result: deepCoroClipResultFixtures.validV1,
          }}
        />
      );
    });

    expect(renderer!.root.findAllByProps({ 'data-testid': 'deepcoro-clip-result' })).toHaveLength(
      1
    );
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'generic-model-result-collection' })
    ).toHaveLength(0);
  });

  test('renders a valid DeepRV payload with the custom component', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'DeepRV',
            modelVersion: '1.0.0',
            result: deepRVResultFixtures.validV1,
          }}
        />
      );
    });

    expect(renderer!.root.findAllByProps({ 'data-testid': 'deeprv-result' })).toHaveLength(1);
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'generic-model-result-collection' })
    ).toHaveLength(0);
  });

  test('renders a valid DeepRV-CLIP payload with the custom component', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'DeepRV-CLIP',
            modelVersion: '1.0.0',
            result: deepRVClipResultFixtures.validV1,
          }}
        />
      );
    });

    expect(renderer!.root.findAllByProps({ 'data-testid': 'deeprv-clip-result' })).toHaveLength(1);
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'generic-model-result-collection' })
    ).toHaveLength(0);
  });

  test('renders a valid DeepCORO-MACE payload with the custom component', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'DeepCORO-MACE',
            modelVersion: '1.0.0',
            result: deepCoroMaceResultFixtures.validV1,
          }}
        />
      );
    });

    expect(renderer!.root.findAllByProps({ 'data-testid': 'deepcoro-mace-result' })).toHaveLength(
      1
    );
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'generic-model-result-collection' })
    ).toHaveLength(0);
  });

  test('renders a valid DeepCORO-CTO payload with the custom component', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'DeepCORO-CTO',
            modelVersion: '2.0.0',
            result: deepCoroCtoResultFixtures.validV2,
          }}
        />
      );
    });
    expect(renderer!.root.findAllByProps({ 'data-testid': 'deepcoro-cto-result' })).toHaveLength(1);
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'generic-model-result-collection' })
    ).toHaveLength(0);
  });

  test('renders a valid DeepCORO-SYNTAX payload with the custom component', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'DeepCORO-SYNTAX',
            modelVersion: '5.0.0',
            result: deepCoroSyntaxResultFixtures.validV5,
          }}
        />
      );
    });
    expect(renderer!.root.findAllByProps({ 'data-testid': 'deepcoro-syntax-result' })).toHaveLength(
      1
    );
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'generic-model-result-collection' })
    ).toHaveLength(0);
  });

  test.each([
    ['PanEcho', '1.0.0', panEchoResultFixtures.successfulV1, 'panecho-result'],
    ['EchoPrime', '1.2.0', echoPrimeResultFixtures.successfulV1, 'echoprime-result'],
  ])(
    'renders a valid %s payload with its custom component',
    (modelName, modelVersion, payload, id) => {
      act(() => {
        renderer = TestRenderer.create(
          <ModelResultRenderer
            result={{
              ...modelExecutionResultFixtures.available,
              modelName,
              modelVersion,
              result: payload,
            }}
          />
        );
      });

      expect(renderer!.root.findAllByProps({ 'data-testid': id })).toHaveLength(1);
    }
  );

  test.each([
    ['PanEcho', '9.0.0', panEchoResultFixtures.successfulV1],
    ['EchoPrime', '1.2.0', 'malformed scalar payload'],
  ])(
    'shows raw troubleshooting access for unsupported %s output',
    (modelName, modelVersion, payload) => {
      act(() => {
        renderer = TestRenderer.create(
          <ModelResultRenderer
            result={{
              ...modelExecutionResultFixtures.available,
              modelName,
              modelVersion,
              result: payload,
            }}
          />
        );
      });

      expect(
        renderer!.root.findAllByProps({ 'data-testid': 'unsupported-model-result' })
      ).toHaveLength(1);
      expect(
        renderer!.root.findAllByProps({ 'data-testid': 'unsupported-model-result-raw' })
      ).toHaveLength(1);
      expect(JSON.stringify(renderer!.toJSON())).toContain('View raw result');
    }
  );

  test('renders a serialised interpretation of a version without a template as a readable table', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'PanEcho',
            modelVersion: '1.0.3',
            result: readableResultFixtures.serialisedDiagnosis,
          }}
        />
      );
    });

    const root = renderer!.root;
    expect(root.findAllByProps({ 'data-testid': 'panecho-result' })).toHaveLength(0);
    expect(root.findAllByProps({ 'data-testid': 'readable-model-result' })).toHaveLength(1);
    expect(root.findAllByProps({ 'data-testid': 'readable-model-result-row' })).toHaveLength(16);
    // No alarm for a result that can be read; the raw result stays one click away.
    expect(root.findAllByProps({ role: 'alert' })).toHaveLength(0);
    expect(root.findAllByProps({ 'data-testid': 'unsupported-model-result-raw' })).toHaveLength(1);
    expect(
      root.findAllByProps({ 'data-testid': 'generic-model-result-collection' }).length
    ).toBeGreaterThan(0);
  });

  test('renders a flat result of a model without a template as a readable table', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'Synthetic model',
            modelVersion: '0.1.0',
            result: readableResultFixtures.serialisedDiagnosis,
          }}
        />
      );
    });

    const root = renderer!.root;
    expect(root.findAllByProps({ 'data-testid': 'readable-model-result' })).toHaveLength(1);
    expect(root.findAllByProps({ 'data-testid': 'readable-model-result-raw' })).toHaveLength(1);
  });

  test('keeps the alert for an unsupported result that cannot be tabulated', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'PanEcho',
            modelVersion: '1.0.3',
            result: { predictions: { 'LV size': [0.9, 0.1] } },
          }}
        />
      );
    });

    const root = renderer!.root;
    expect(root.findAllByProps({ role: 'alert' })).toHaveLength(1);
    expect(root.findAllByProps({ 'data-testid': 'readable-model-result' })).toHaveLength(0);
    expect(root.findAllByProps({ 'data-testid': 'unsupported-model-result-raw' })).toHaveLength(1);
  });

  test('renders unsupported and malformed payload content as generic text', () => {
    const payload = {
      diagnosis: '<img src=x onerror=alert(1)>',
      predictions: {},
    };

    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{ ...modelExecutionResultFixtures.available, result: payload }}
        />
      );
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(renderer!.root.findAllByProps({ 'data-testid': 'cardiosyntax-result' })).toHaveLength(0);
    expect(rendered).toContain('<img src=x onerror=alert(1)>');
    expect(renderer!.root.findAllByType('img')).toHaveLength(0);
  });

  test('replaces a crashing custom renderer with the generic fallback', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRendererBoundary
          fallback={<p data-testid="safe-generic-fallback">Safe fallback</p>}
          resetKey="execution-1"
        >
          <ThrowingRenderer />
        </ModelResultRendererBoundary>
      );
    });

    expect(renderer!.root.findAllByProps({ 'data-testid': 'safe-generic-fallback' })).toHaveLength(
      1
    );
  });

  test('resets a prior renderer failure when a different execution is selected', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRendererBoundary
          fallback={<p data-testid="safe-generic-fallback">Safe fallback</p>}
          resetKey="execution-1"
        >
          <ThrowingRenderer />
        </ModelResultRendererBoundary>
      );
    });

    act(() => {
      renderer!.update(
        <ModelResultRendererBoundary
          fallback={<p data-testid="safe-generic-fallback">Safe fallback</p>}
          resetKey="execution-2"
        >
          <p data-testid="next-renderer">Next renderer</p>
        </ModelResultRendererBoundary>
      );
    });

    expect(renderer!.root.findAllByProps({ 'data-testid': 'safe-generic-fallback' })).toHaveLength(
      0
    );
    expect(renderer!.root.findAllByProps({ 'data-testid': 'next-renderer' })).toHaveLength(1);
  });
});
