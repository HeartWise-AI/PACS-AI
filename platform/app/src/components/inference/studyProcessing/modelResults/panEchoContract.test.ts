import { panEchoResultFixtures } from './panEchoFixtures';
import { parsePanEchoResultPayload } from './panEchoContract';

describe('PanEcho result contract', () => {
  test.each(['successfulV1', 'partialV1'] as const)('parses the %s fixture', fixture => {
    expect(parsePanEchoResultPayload(panEchoResultFixtures[fixture])).not.toBeNull();
  });

  test('parses the serialized diagnosis map and preserves partial predictions', () => {
    const parsed = parsePanEchoResultPayload(panEchoResultFixtures.partialV1);

    expect(parsed?.diagnoses['Left ventricular (LV) ejection fraction']).toContain(
      'Moderately Abnormal'
    );
    expect(parsed?.predictions['Future echo measurement']).toBe(12.25);
  });

  test.each([null, 'scalar', [], { diagnosis: 'missing predictions' }])(
    'rejects an unusable payload %#',
    payload => {
      expect(parsePanEchoResultPayload(payload)).toBeNull();
    }
  );

  test('tolerates malformed and missing optional diagnosis data', () => {
    expect(parsePanEchoResultPayload({ diagnosis: '{bad json', predictions: {} })).toEqual({
      diagnosis: '{bad json',
      diagnoses: {},
      predictions: {},
    });
    expect(parsePanEchoResultPayload({ predictions: { value: null } })).toEqual({
      diagnosis: null,
      diagnoses: {},
      predictions: { value: null },
    });
  });
});
