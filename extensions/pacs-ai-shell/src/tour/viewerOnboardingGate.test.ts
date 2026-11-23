import { holdViewerOnboarding, whenViewerOnboardingIdle } from './viewerOnboardingGate';

describe('viewer onboarding gate', () => {
  it('is free when nothing holds it', async () => {
    await expect(whenViewerOnboardingIdle()).resolves.toBe(true);
  });

  it('waits until every hold is released, each release counting once', async () => {
    const releaseA = holdViewerOnboarding();
    const releaseB = holdViewerOnboarding();
    let idle: boolean | undefined;
    whenViewerOnboardingIdle().then(value => (idle = value));

    releaseA();
    releaseA();
    await Promise.resolve();
    expect(idle).toBeUndefined();

    releaseB();
    await Promise.resolve();
    expect(idle).toBe(true);
  });

  it('gives up when the signal aborts', async () => {
    const release = holdViewerOnboarding();
    const controller = new AbortController();
    const waiting = whenViewerOnboardingIdle(controller.signal);
    controller.abort();
    await expect(waiting).resolves.toBe(false);
    release();
    await expect(whenViewerOnboardingIdle(controller.signal)).resolves.toBe(false);
  });
});
