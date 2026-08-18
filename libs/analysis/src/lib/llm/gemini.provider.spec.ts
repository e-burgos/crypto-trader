import axios from 'axios';
import { GeminiProvider } from './gemini.provider';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('GeminiProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should use the max_tokens passed via call options over the constructor default', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] },
    });

    const provider = new GeminiProvider({ apiKey: 'sk', maxTokens: 1024 });
    await provider.complete('sys', 'usr', { maxTokens: 250 });

    const body = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
    expect(
      (body.generationConfig as Record<string, unknown>).maxOutputTokens,
    ).toBe(250);
  });

  it('should mark truncated=true when finishReason is MAX_TOKENS', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        candidates: [
          {
            content: { parts: [{ text: 'partial' }] },
            finishReason: 'MAX_TOKENS',
          },
        ],
      },
    });

    const provider = new GeminiProvider({ apiKey: 'sk' });
    const result = await provider.complete('sys', 'usr');

    expect(result.truncated).toBe(true);
  });

  it('should mark truncated=false when finishReason is STOP', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        candidates: [
          { content: { parts: [{ text: 'done' }] }, finishReason: 'STOP' },
        ],
      },
    });

    const provider = new GeminiProvider({ apiKey: 'sk' });
    const result = await provider.complete('sys', 'usr');

    expect(result.truncated).toBe(false);
  });
});
