const mockShepherd: { activeTour: { cancel: jest.Mock } | null; Tour: jest.Mock } = {
  activeTour: null,
  Tour: jest.fn().mockImplementation(function MockTour(options) {
    this.options = options;
  }),
};
jest.mock('shepherd.js', () => ({
  __esModule: true,
  // A getter: the factory runs when the import below is hoisted above mockShepherd.
  get default() {
    return mockShepherd;
  },
}));

import { createGuidedTour } from './guidedTour';

describe('createGuidedTour', () => {
  beforeEach(() => {
    mockShepherd.activeTour = null;
    mockShepherd.Tour.mockClear();
  });

  test('builds the tour with shepherd.js itself (no react-shepherd provider needed)', () => {
    const options = { useModalOverlay: true };
    const tour = createGuidedTour(options) as any;
    expect(mockShepherd.Tour).toHaveBeenCalledWith(options);
    expect(tour.options).toBe(options);
  });

  test('cancels the tour already on screen first', () => {
    const cancel = jest.fn();
    mockShepherd.activeTour = { cancel };
    createGuidedTour({});
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(
      mockShepherd.Tour.mock.invocationCallOrder[0]
    );
  });
});
