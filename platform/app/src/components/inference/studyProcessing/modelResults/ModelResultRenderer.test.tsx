import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { modelExecutionResultFixtures } from '../executionResultFixtures';
import { cardioSyntaxResultFixtures } from './cardioSyntaxFixtures';
import { deepCoroClipResultFixtures } from './deepCoroClipFixtures';
import { echoPrimeResultFixtures } from './echoPrimeFixtures';
import { panEchoResultFixtures } from './panEchoFixtures';
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

  test('renders a valid DeepCORO-CLIP payload with the custom component', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelResultRenderer
          result={{
            ...modelExecutionResultFixtures.available,
            modelName: 'DeepCoro_CLIP_generic',
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
