import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PanEchoResult } from './PanEchoResult';
import { parsePanEchoResultPayload } from './panEchoContract';
import { panEchoResultFixtures } from './panEchoFixtures';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
  }),
}));

describe('PanEchoResult', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test.each(['successfulV1', 'partialV1'] as const)(
    'renders responsive structured output for the %s fixture',
    fixture => {
      const payload = parsePanEchoResultPayload(panEchoResultFixtures[fixture])!;
      act(() => {
        renderer = TestRenderer.create(
          <PanEchoResult
            payload={payload}
            modelName="PanEcho"
            modelVersion="1.0.0"
            status="completed"
          />
        );
      });

      expect(renderer!.root.findAllByProps({ 'data-testid': 'panecho-result' })).toHaveLength(1);
      expect(renderer!.root.findAllByType('dl').length).toBeGreaterThan(1);
      expect(JSON.stringify(renderer!.toJSON())).toContain('Completed');
    }
  );

  test('shows documented values, units, classifications, and unknown outputs', () => {
    const payload = parsePanEchoResultPayload(panEchoResultFixtures.partialV1)!;
    act(() => {
      renderer = TestRenderer.create(
        <PanEchoResult
          payload={payload}
          modelName="PanEcho"
          modelVersion="1.4.0"
          status="completed"
        />
      );
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain('37.6 %');
    expect(rendered).toContain('Moderately Abnormal');
    expect(rendered).toContain('Future echo measurement');
    expect(rendered).toContain('Future echo classification');
  });
});
