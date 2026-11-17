/**
 * OHIF's ErrorBoundary (platform/ui-next/.../Errorboundary/ErrorBoundary.tsx)
 * listens to window `error` and `unhandledrejection` events and shows a red
 * "Something went wrong" notification for each one, from the boundary that
 * platform/app/src/routes wraps around every route. PACS-AI has never shown
 * those (the fork disabled the notification on that boundary): a failed
 * background request is reported by the page that made it, through our
 * alerts.
 *
 * Window listeners run in the order they were added, so a listener added
 * before React mounts the routes can stop the event from reaching the
 * boundaries' listeners. Only events dispatched at the window itself are
 * stopped (script errors and unhandled rejections); resource load errors,
 * which are dispatched at the element, are untouched. The browser still logs
 * the error in the console.
 */
let installed = false;

function stopAtWindow(event: Event): void {
  if (event.target === window || event.target == null) {
    event.stopImmediatePropagation();
  }
}

export function stopRouteErrorNotifications(target: Window = window): void {
  if (installed || typeof target?.addEventListener !== 'function') {
    return;
  }
  installed = true;
  target.addEventListener('error', stopAtWindow);
  target.addEventListener('unhandledrejection', stopAtWindow);
}
