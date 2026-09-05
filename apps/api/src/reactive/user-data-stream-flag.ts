export function isUserDataStreamFillsEnabled(): boolean {
  return process.env.USER_DATA_STREAM_FILLS_ENABLED === 'true';
}
