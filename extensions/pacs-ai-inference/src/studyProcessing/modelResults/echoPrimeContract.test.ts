import { parseEchoPrimeResultPayload } from './echoPrimeContract';
import { echoPrimeResultFixtures } from './echoPrimeFixtures';

describe('EchoPrime result contract', () => {
  test.each(['successfulV1', 'partialV1'] as const)('parses the %s fixture', fixture => {
    expect(parseEchoPrimeResultPayload(echoPrimeResultFixtures[fixture])).not.toBeNull();
  });

  test.each([null, 'scalar', [], { diagnosis: 'missing predictions' }])(
    'rejects an unusable payload %#',
    payload => {
      expect(parseEchoPrimeResultPayload(payload)).toBeNull();
    }
  );

  test('tolerates null optional fields and unknown prediction values', () => {
    expect(
      parseEchoPrimeResultPayload({
        diagnosis: null,
        predictions: { future: { nested: true }, absent: null },
        modelRecommendations: null,
      })
    ).toEqual({
      diagnosis: null,
      predictions: { future: { nested: true }, absent: null },
    });
  });
});
