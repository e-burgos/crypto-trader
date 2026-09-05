export function isUserDataStreamFillsEnabled(): boolean {
  const value = process.env.USER_DATA_STREAM_FILLS_ENABLED;
  return value === 'true' || value === '1';
}
