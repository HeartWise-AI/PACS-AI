import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DeepCoroCtoResult } from './DeepCoroCtoResult';
import { deepCoroCtoResultFixtures } from './deepCoroCtoFixtures';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
    i18n: { language: 'en-US' },
  }),
}));

describe('DeepCoroCtoResult', () => {
  test('presents score, components, and per-artery results', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroCtoResult payload={deepCoroCtoResultFixtures.parsedV2} />
      );
    });
    expect(renderer!.root.findAllByProps({ 'data-testid': 'deepcoro-cto-result' })).toHaveLength(1);
    expect(renderer!.root.findAll(node => node.type === 'table')).toHaveLength(2);
    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain('RCA');
    expect(rendered).toContain('71.0%');
    expect(rendered).toContain('difficult');
  });

  test('uses fixed safety text instead of model-authored strings', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroCtoResult payload={deepCoroCtoResultFixtures.parsedV2} />
      );
    });
    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).not.toContain('Synthetic J-CTO result');
    expect(rendered).not.toContain('<strong>');
    expect(renderer!.root.findAllByProps({ role: 'note' })).toHaveLength(1);
  });

  test('shows a fixed caution for a selected LCx result', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroCtoResult
          payload={{
            ...deepCoroCtoResultFixtures.parsedV2,
            predictions: { ...deepCoroCtoResultFixtures.parsedV2.predictions, ctoArtery: 'LCx' },
          }}
        />
      );
    });
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'deepcoro-cto-lcx-warning' })
    ).toHaveLength(1);
  });
});
