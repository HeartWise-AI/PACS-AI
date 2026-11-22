import { addStepProgress, reportTourShown } from './reportTourShown';

const tour = {
  id: 'basicViewerTour',
  route: '/viewer',
  tourOptions: {
    useModalOverlay: true,
    defaultStepOptions: { buttons: [{ text: 'Skip all' }] },
  },
  steps: [{ id: 'scroll' }, { id: 'zoom', when: { hide: () => undefined } }],
};

function stepElement() {
  const element = document.createElement('div');
  const footer = document.createElement('div');
  footer.className = 'shepherd-footer';
  element.appendChild(footer);
  return { element, footer };
}

describe('reportTourShown', () => {
  test('reports the tour once, when a step is first shown', () => {
    const onShown = jest.fn();
    const reporting = reportTourShown(tour, onShown) as any;
    expect(onShown).not.toHaveBeenCalled();

    const show = reporting.tourOptions.defaultStepOptions.when.show;
    show.call({});
    show.call({});
    reporting.steps[1].when.show.call({});
    expect(onShown).toHaveBeenCalledTimes(1);
    expect(onShown).toHaveBeenCalledWith('basicViewerTour');
  });

  test('keeps the tour options, its own handlers and its steps', () => {
    const contexts: unknown[] = [];
    const ownShow = jest.fn(function (this: unknown) {
      contexts.push(this);
    });
    const withShow = {
      ...tour,
      tourOptions: { defaultStepOptions: { when: { show: ownShow, hide: jest.fn() } } },
    };
    const reporting = reportTourShown(withShow, jest.fn()) as any;
    const step = { id: 'x' };
    reporting.tourOptions.defaultStepOptions.when.show.call(step, 'arg');
    expect(ownShow).toHaveBeenCalledWith('arg');
    expect(contexts[0]).toBe(step);
    expect(reporting.tourOptions.defaultStepOptions.when.hide).toBe(
      withShow.tourOptions.defaultStepOptions.when.hide
    );

    const plain = reportTourShown(tour, jest.fn()) as any;
    expect(plain.tourOptions.useModalOverlay).toBe(true);
    expect(plain.tourOptions.defaultStepOptions.buttons).toEqual([{ text: 'Skip all' }]);
    expect(plain.steps[0]).toBe(tour.steps[0]);
    expect(plain.steps[1].when.hide).toBe(tour.steps[1].when.hide);
    expect(tour.tourOptions.defaultStepOptions).not.toHaveProperty('when');
  });

  test("adds Onboarding's step progress when the tour has no show handler", () => {
    const reporting = reportTourShown(tour, jest.fn()) as any;
    const { element, footer } = stepElement();
    const steps: any[] = [];
    const step = { tour: { steps }, getElement: () => element };
    steps.push({}, step, {});
    reporting.tourOptions.defaultStepOptions.when.show.call(step);
    const progress = footer.querySelector('.shepherd-progress') as HTMLElement;
    expect(progress.innerText).toBe('2/3');
  });

  test('a step with its own `when` but no show gets no progress indicator', () => {
    const reporting = reportTourShown(tour, jest.fn()) as any;
    const { element, footer } = stepElement();
    const step = { tour: { steps: [] }, getElement: () => element };
    reporting.steps[1].when.show.call(step);
    expect(footer.querySelector('.shepherd-progress')).toBeNull();
    expect(() => addStepProgress(undefined)).not.toThrow();
  });

  test('does not wrap a tour twice, and a failing recorder does not break the tour', () => {
    const onShown = jest.fn(() => {
      throw new Error('offline');
    });
    const once = reportTourShown(tour, onShown);
    expect(reportTourShown(once, jest.fn())).toBe(once);
    const rejecting = reportTourShown(tour, () => Promise.reject(new Error('offline'))) as any;
    expect(() => (once as any).tourOptions.defaultStepOptions.when.show.call({})).not.toThrow();
    expect(() => rejecting.tourOptions.defaultStepOptions.when.show.call({})).not.toThrow();
  });
});
