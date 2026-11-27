export function useTranslation() {
  return {
    t: (key, options = {}) => (options.defaultValue == null ? key : String(options.defaultValue)),
  };
}
