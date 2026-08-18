import axios from 'axios';
import { GroqProvider } from './groq.provider';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('GroqProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should use the max_tokens passed via call options over the constructor default', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: 'ok' } }], usage: {} },
    });

    const provider = new GroqProvider({ apiKey: 'sk', maxTokens: 1024 });
    await provider.complete('sys', 'usr', { maxTokens: 200 });

    const body = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
    expect(body.max_tokens).toBe(200);
  });

  it('should mark truncated=true when finish_reason is length', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [
          { message: { content: 'partial' }, finish_reason: 'length' },
        ],
        usage: {},
      },
    });

    const provider = new GroqProvider({ apiKey: 'sk' });
    const result = await provider.complete('sys', 'usr');

    expect(result.truncated).toBe(true);
  });

  it('should mark truncated=false when finish_reason is stop', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'done' }, finish_reason: 'stop' }],
        usage: {},
      },
    });

    const provider = new GroqProvider({ apiKey: 'sk' });
    const result = await provider.complete('sys', 'usr');

    expect(result.truncated).toBe(false);
  });
});
