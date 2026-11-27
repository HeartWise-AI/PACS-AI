export function useModelExecutionResultViewer() {
  return {
    state: { key: null, selection: null, status: 'idle', result: null, failure: null },
    open() {},
    close() {},
    retry() {},
  };
}
