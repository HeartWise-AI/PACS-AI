describe('stopRouteErrorNotifications', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('stops window error and unhandled rejection events before later listeners', () => {
    const { stopRouteErrorNotifications } = require('./routeErrorNotifications');
    stopRouteErrorNotifications(window);
    const later = jest.fn();
    window.addEventListener('error', later);
    window.addEventListener('unhandledrejection', later);

    window.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));
    const rejection = new Event('unhandledrejection');
    window.dispatchEvent(rejection);

    expect(later).not.toHaveBeenCalled();
    window.removeEventListener('error', later);
    window.removeEventListener('unhandledrejection', later);
  });

  test('leaves load errors of elements alone', () => {
    const { stopRouteErrorNotifications } = require('./routeErrorNotifications');
    stopRouteErrorNotifications(window);
    const script = document.createElement('script');
    document.body.appendChild(script);
    const onElement = jest.fn();
    const onWindowCapture = jest.fn();
    script.addEventListener('error', onElement);
    window.addEventListener('error', onWindowCapture, true);

    script.dispatchEvent(new Event('error'));

    expect(onWindowCapture).toHaveBeenCalledTimes(1);
    expect(onElement).toHaveBeenCalledTimes(1);
    window.removeEventListener('error', onWindowCapture, true);
    script.remove();
  });

  test('installs its listeners once', () => {
    const { stopRouteErrorNotifications } = require('./routeErrorNotifications');
    const target = { addEventListener: jest.fn() } as unknown as Window;
    stopRouteErrorNotifications(target);
    stopRouteErrorNotifications(target);
    expect((target.addEventListener as jest.Mock).mock.calls.map(call => call[0])).toEqual([
      'error',
      'unhandledrejection',
    ]);
  });
});
