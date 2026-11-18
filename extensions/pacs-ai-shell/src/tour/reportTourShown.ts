import type { TourDefinition } from './viewerTours';

type StepLike = {
  tour?: { steps?: unknown[] };
  getElement?: () => HTMLElement | null | undefined;
};

type ShowHandler = (this: StepLike, ...args: unknown[]) => unknown;

/** Marks a tour already returned by reportTourShown (a remount wraps nothing twice). */
const REPORTING = Symbol.for('pacsAi.tourReportsShown');

/**
 * The "n/m" progress indicator @ohif/ui-next's Onboarding adds to each step
 * when a tour brings no `show` handler of its own (its defaultShowHandler,
 * not exported). Same element and classes.
 */
export function addStepProgress(step?: StepLike): void {
  const steps = step?.tour?.steps;
  const footer = step?.getElement?.()?.querySelector('.shepherd-footer');
  if (!steps || !footer) {
    return;
  }
  const progress = document.createElement('span');
  progress.className = 'shepherd-progress text-lg text-primary-light';
  progress.innerText = `${steps.indexOf(step) + 1}/${steps.length}`;
  progress.style.position = 'absolute';
  progress.style.left = '13px';
  progress.style.bottom = '20px';
  progress.style.zIndex = '1';
  footer.appendChild(progress);
}

/**
 * Returns the tour with a Shepherd `show` handler that calls onShown(tour.id)
 * the first time one of its steps is shown, i.e. once the tour has really
 * started on screen, then does what the step would have done: its own or the
 * tour's `show` handler, else, for the tour default, Onboarding's progress
 * indicator.
 *
 * OHIF's Onboarding starts the tour and records it only in local storage;
 * this is how the server learns about it without changing Onboarding
 * (Shepherd binds `when` handlers with the step as `this`; a step's own
 * `when` replaces the tour's default one, so those are wrapped as well).
 */
export function reportTourShown<T extends TourDefinition>(
  tour: T,
  onShown: (tourId: string) => unknown
): T {
  if ((tour as any)?.[REPORTING]) {
    return tour;
  }
  let reported = false;
  const report = () => {
    if (reported) {
      return;
    }
    reported = true;
    try {
      Promise.resolve(onShown(tour.id)).catch(() => undefined);
    } catch (error) {
      // recording must never break the tour
    }
  };
  const wrap = (own?: ShowHandler, fallback?: (step: StepLike) => void): ShowHandler =>
    function show(this: StepLike, ...args: unknown[]) {
      report();
      if (own) {
        return own.apply(this, args);
      }
      return fallback?.(this);
    };

  const tourOptions = (tour.tourOptions || {}) as any;
  const defaultStepOptions = tourOptions.defaultStepOptions || {};
  const steps = Array.isArray(tour.steps) ? (tour.steps as any[]) : [];

  return {
    ...tour,
    [REPORTING]: true,
    tourOptions: {
      ...tourOptions,
      defaultStepOptions: {
        ...defaultStepOptions,
        when: {
          ...defaultStepOptions.when,
          show: wrap(defaultStepOptions.when?.show, addStepProgress),
        },
      },
    },
    steps: steps.map(step =>
      step?.when ? { ...step, when: { ...step.when, show: wrap(step.when.show) } } : step
    ),
  };
}
