/**
 * Minimal state container behind our OHIF services: a state object, a
 * change event and an OHIF-style `subscribe(event, callback)` returning
 * `{ unsubscribe }`. It does not extend @ohif/core's PubSubService so that
 * modules outside an OHIF app (ui-next components, unit tests) can import the
 * services without loading @ohif/core.
 */
export const STATE_CHANGED = 'event::pacsAi:stateChanged';

export interface Store<State> {
  getState(): State;
  setState(patch: Partial<State>): void;
  subscribe(
    eventName: typeof STATE_CHANGED,
    callback: (state: State) => void
  ): { unsubscribe: () => void };
}

export default function createStore<State extends object>(initialState: State): Store<State> {
  let state = initialState;
  const listeners = new Set<(state: State) => void>();

  return {
    getState: () => state,
    setState(patch) {
      const changed = Object.keys(patch).some(key => !Object.is(patch[key], state[key]));
      if (!changed) {
        return;
      }
      state = { ...state, ...patch };
      listeners.forEach(listener => listener(state));
    },
    subscribe(eventName, callback) {
      if (eventName !== STATE_CHANGED) {
        throw new Error(`Unknown event ${eventName}`);
      }
      listeners.add(callback);
      return { unsubscribe: () => listeners.delete(callback) };
    },
  };
}
