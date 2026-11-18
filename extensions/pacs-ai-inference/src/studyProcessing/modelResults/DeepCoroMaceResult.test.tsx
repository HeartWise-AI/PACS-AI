import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS,
  DEEP_CORO_MACE_PRIMARY_ENDPOINTS,
} from './deepCoroMaceContract';
import { deepCoroMaceResultFixtures } from './deepCoroMaceFixtures';
import { DeepCoroMaceResult } from './DeepCoroMaceResult';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
    i18n: { language: 'en-US' },
  }),
}));

// Rendered text plus every attribute value (what the serialized render tree exposed).
function renderedContent(container: HTMLElement): string {
  const attributeValues = Array.from(container.querySelectorAll('*')).flatMap(element =>
    Array.from(element.attributes, attribute => attribute.value)
  );
  return [container.textContent ?? '', ...attributeValues].join('\n');
}

describe('DeepCoroMaceResult', () => {
  test('presents every documented endpoint in primary and exploratory tables', () => {
    const { container } = render(
      <DeepCoroMaceResult payload={deepCoroMaceResultFixtures.parsedV1} />
    );

    expect(container.querySelectorAll('table')).toHaveLength(2);
    for (const key of [
      ...DEEP_CORO_MACE_PRIMARY_ENDPOINTS,
      ...DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS,
    ]) {
      expect(
        container.querySelectorAll(`[data-testid="deepcoro-mace-endpoint-${key}"]`)
      ).toHaveLength(1);
    }
  });

  test('formats scores, thresholds, and threshold states', () => {
    render(<DeepCoroMaceResult payload={deepCoroMaceResultFixtures.parsedV1} />);

    const composite = screen.getByTestId('deepcoro-mace-endpoint-compositeMace').textContent;
    expect(composite).toContain('62.4%');
    expect(composite).toContain('50.0%');
    expect(composite).toContain('At or above threshold');

    const revascularization = screen.getByTestId(
      'deepcoro-mace-endpoint-urgentRevascularization'
    ).textContent;
    expect(revascularization).toContain('38.2%');
    expect(revascularization).toContain('Below threshold');
  });

  test('uses fixed cautions instead of model-authored strings or markup', () => {
    const { container } = render(
      <DeepCoroMaceResult payload={deepCoroMaceResultFixtures.parsedV1} />
    );

    const rendered = renderedContent(container);
    expect(rendered).toContain('Research use only');
    expect(rendered).toContain('very few cardiovascular deaths');
    expect(rendered).not.toContain(deepCoroMaceResultFixtures.parsedV1.diagnosis);
    expect(rendered).not.toContain(deepCoroMaceResultFixtures.parsedV1.predictions.thresholdNote);
    expect(rendered).not.toContain(deepCoroMaceResultFixtures.parsedV1.modelRecommendations.en);
    expect(container.querySelectorAll('strong')).toHaveLength(0);
  });

  test('uses table semantics and exposes the research caution as a note', () => {
    const { container } = render(
      <DeepCoroMaceResult payload={deepCoroMaceResultFixtures.parsedV1} />
    );

    expect(container.querySelectorAll('caption')).toHaveLength(2);
    expect(container.querySelectorAll('[scope="row"]')).toHaveLength(9);
    expect(screen.getByTestId('deepcoro-mace-research-note').getAttribute('role')).toBe('note');
  });
});
