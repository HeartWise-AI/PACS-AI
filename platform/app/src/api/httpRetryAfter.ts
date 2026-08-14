export const parseRetryAfterSeconds = (
  value: unknown,
  nowMilliseconds = Date.now()
): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.ceil(value);
  }
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const deltaSeconds = Number(value);
  if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
    return Math.ceil(deltaSeconds);
  }

  const retryDate = Date.parse(value);
  if (Number.isNaN(retryDate) || retryDate <= nowMilliseconds) {
    return undefined;
  }
  return Math.ceil((retryDate - nowMilliseconds) / 1000);
};
