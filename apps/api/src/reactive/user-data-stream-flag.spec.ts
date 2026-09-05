import { isUserDataStreamFillsEnabled } from './user-data-stream-flag';

describe('isUserDataStreamFillsEnabled', () => {
  const originalFlag = process.env.USER_DATA_STREAM_FILLS_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.USER_DATA_STREAM_FILLS_ENABLED;
    } else {
      process.env.USER_DATA_STREAM_FILLS_ENABLED = originalFlag;
    }
  });

  it('defaults to false when the variable is unset', () => {
    delete process.env.USER_DATA_STREAM_FILLS_ENABLED;
    expect(isUserDataStreamFillsEnabled()).toBe(false);
  });

  it('is true only for the exact string "true"', () => {
    process.env.USER_DATA_STREAM_FILLS_ENABLED = 'true';
    expect(isUserDataStreamFillsEnabled()).toBe(true);
  });

  it('is false for "1", the value cycle-01 mistakenly accepted', () => {
    process.env.USER_DATA_STREAM_FILLS_ENABLED = '1';
    expect(isUserDataStreamFillsEnabled()).toBe(false);
  });

  it('is false for a differently-cased match', () => {
    process.env.USER_DATA_STREAM_FILLS_ENABLED = 'TRUE';
    expect(isUserDataStreamFillsEnabled()).toBe(false);
  });

  it('is false for other truthy-looking or empty values', () => {
    process.env.USER_DATA_STREAM_FILLS_ENABLED = 'yes';
    expect(isUserDataStreamFillsEnabled()).toBe(false);

    process.env.USER_DATA_STREAM_FILLS_ENABLED = 'false';
    expect(isUserDataStreamFillsEnabled()).toBe(false);

    process.env.USER_DATA_STREAM_FILLS_ENABLED = '';
    expect(isUserDataStreamFillsEnabled()).toBe(false);
  });
});
