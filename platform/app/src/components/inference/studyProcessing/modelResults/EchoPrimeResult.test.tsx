import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { parseEchoPrimeResultPayload } from './echoPrimeContract';
import { echoPrimeResultFixtures } from './echoPrimeFixtures';
import { EchoPrimeResult } from './EchoPrimeResult';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
  }),
}));

describe('EchoPrimeResult', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test.each(['successfulV1', 'partialV1'] as const)(
    'renders responsive structured output for the %s fixture',
    fixture => {
      const payload = parseEchoPrimeResultPayload(echoPrimeResultFixtures[fixture])!;
      act(() => {
        renderer = TestRenderer.create(
          <EchoPrimeResult
            payload={payload}
            modelName="EchoPrime"
            modelVersion="1.2.0"
            status="completed"
          />
        );
      });

      expect(renderer!.root.findAllByProps({ 'data-testid': 'echoprime-result' })).toHaveLength(1);
      expect(renderer!.root.findAllByType('dl').length).toBeGreaterThan(0);
      expect(JSON.stringify(renderer!.toJSON())).toContain('Completed');
    }
  );

  test('shows report sections, units, threshold classifications, and null-safe values', () => {
    const payload = parseEchoPrimeResultPayload(echoPrimeResultFixtures.successfulV1)!;
    act(() => {
      renderer = TestRenderer.create(
        <EchoPrimeResult
          payload={payload}
          modelName="EchoPrime"
          modelVersion="1.2.0"
          status="completed"
        />
      );
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain('Left Ventricle');
    expect(rendered).toContain('59.0 %');
    expect(rendered).toContain('22.5 mmHg');
    expect(rendered).toContain('Detected');
    expect(rendered).toContain('Not detected');
  });

  test('renders unknown and nested partial fields without throwing', () => {
    const payload = parseEchoPrimeResultPayload(echoPrimeResultFixtures.partialV1)!;
    act(() => {
      renderer = TestRenderer.create(
        <EchoPrimeResult
          payload={payload}
          modelName="EchoPrime"
          modelVersion="1.2.0"
          status="completed"
        />
      );
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain('Future echo metric');
    expect(rendered).toContain('44.0%');
    expect(rendered).toContain('Unknown nested value');
  });
});
