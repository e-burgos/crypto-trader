import {
  Injectable,
  Logger,
  NotFoundException,
  BadGatewayException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { LLMProvider } from '../../generated/prisma/enums';
import { decrypt } from '../users/utils/encryption.util';
import { MODEL_PRICING } from './model-pricing';
import { OpenRouterModelsService } from '@crypto-trader/openrouter';

interface ProviderModel {
  id: string;
  name: string;
  contextWindow: number;
  maxOutput?: number;
  pricing?: { input: number; output: number };
  deprecated?: boolean;
  recommended?: boolean;
  categories?: string[];
}

interface ProviderModelsResponse {
  provider: string;
  models: ProviderModel[];
  fetchedAt: string;
}

@Injectable()
export class LLMModelsService {
  private readonly logger = new Logger(LLMModelsService.name);
  private cache = new Map<
    string,
    { data: ProviderModel[]; fetchedAt: number }
  >();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly openRouterModels = new OpenRouterModelsService();

  constructor(private readonly prisma: PrismaService) {}

  async getModels(
    userId: string,
    provider: LLMProvider,
  ): Promise<ProviderModelsResponse> {
    const cacheKey = `${userId}:${provider}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL) {
      return {
        provider,
        models: cached.data,
        fetchedAt: new Date(cached.fetchedAt).toISOString(),
      };
    }

    const cred = await this.prisma.lLMCredential.findFirst({
      where: { userId, provider, isActive: true },
    });
    if (!cred) {
      throw new NotFoundException(`No active API key for provider ${provider}`);
    }

    const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);

    try {
      const models = await this.fetchModels(provider, apiKey);
      this.cache.set(cacheKey, { data: models, fetchedAt: Date.now() });
      return {
        provider,
        models,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadGatewayException
      )
        throw err;
      this.logger.warn(
        `Failed to fetch models for ${provider}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadGatewayException(`Failed to fetch models from ${provider}`);
    }
  }

  private async fetchModels(
    provider: LLMProvider,
    apiKey: string,
  ): Promise<ProviderModel[]> {
    switch (provider) {
      case LLMProvider.CLAUDE:
        return this.fetchAnthropic(apiKey);
      case LLMProvider.OPENAI:
        return this.fetchOpenAI(apiKey);
      case LLMProvider.GROQ:
        return this.fetchGroq(apiKey);
      case LLMProvider.GEMINI:
        return this.fetchGemini(apiKey);
      case LLMProvider.MISTRAL:
        return this.fetchMistral(apiKey);
      case LLMProvider.TOGETHER:
        return this.fetchTogether(apiKey);
      case LLMProvider.OPENROUTER:
        return this.fetchOpenRouter(apiKey);
      default:
        throw new BadGatewayException(`Unsupported provider: ${provider}`);
    }
  }

  private enrichModel(model: {
    id: string;
    name: string;
    contextWindow: number;
    maxOutput?: number;
  }): ProviderModel {
    const pricing = MODEL_PRICING[model.id];
    return {
      ...model,
      pricing: pricing
        ? { input: pricing.input, output: pricing.output }
        : undefined,
      deprecated: pricing?.deprecated,
      recommended: pricing?.recommended ?? false,
    };
  }

  private async fetchAnthropic(apiKey: string): Promise<ProviderModel[]> {
    const { data } = await axios.get('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      timeout: 15000,
    });

    return (data.data ?? [])
      .filter(
        (m: any) =>
          m.type === 'model' && m.id && String(m.id).includes('claude'),
      )
      .map((m: any) =>
        this.enrichModel({
          id: m.id,
          name: m.display_name ?? m.id,
          contextWindow: m.context_window ?? 200_000,
          maxOutput: m.max_output,
        }),
      );
  }

  private async fetchOpenAI(apiKey: string): Promise<ProviderModel[]> {
    const { data } = await axios.get('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });

    const excluded = [
      'whisper',
      'dall-e',
      'tts-',
      'babbage',
      'davinci',
      'text-',
      'embedding',
    ];
    return (data.data ?? [])
      .filter(
        (m: any) =>
          m.id &&
          String(m.id).startsWith('gpt') &&
          !excluded.some((e) => String(m.id).includes(e)),
      )
      .map((m: any) =>
        this.enrichModel({
          id: m.id,
          name: MODEL_PRICING[m.id]?.label ?? m.id,
          contextWindow: MODEL_PRICING[m.id]?.contextWindow ?? 128_000,
        }),
      );
  }

  private async fetchGroq(apiKey: string): Promise<ProviderModel[]> {
    const { data } = await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });

    return (data.data ?? [])
      .filter(
        (m: any) =>
          m.context_window &&
          m.context_window > 0 &&
          !String(m.id).includes('whisper'),
      )
      .map((m: any) =>
        this.enrichModel({
          id: m.id,
          name: MODEL_PRICING[m.id]?.label ?? m.id,
          contextWindow: m.context_window ?? 131_072,
        }),
      );
  }

  private async fetchGemini(apiKey: string): Promise<ProviderModel[]> {
    const { data } = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { timeout: 15000 },
    );

    const excluded = ['embedding', 'aqa', 'imagen', 'veo', 'lyria', 'tts'];
    return (data.models ?? [])
      .filter((m: any) => {
        const methods: string[] = m.supportedGenerationMethods ?? [];
        const name = String(m.name ?? '');
        return (
          methods.includes('generateContent') &&
          !excluded.some((e) => name.includes(e))
        );
      })
      .map((m: any) => {
        const id = String(m.name ?? '').replace('models/', '');
        return this.enrichModel({
          id,
          name: m.displayName ?? id,
          contextWindow: m.inputTokenLimit ?? 1_000_000,
          maxOutput: m.outputTokenLimit,
        });
      });
  }

  private async fetchMistral(apiKey: string): Promise<ProviderModel[]> {
    const { data } = await axios.get('https://api.mistral.ai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });

    const excluded = ['embed', 'moderation', 'tts', 'transcribe'];
    return (data.data ?? [])
      .filter(
        (m: any) =>
          m.capabilities?.completion_chat === true &&
          !excluded.some((e) => String(m.id).includes(e)),
      )
      .map((m: any) =>
        this.enrichModel({
          id: m.id,
          name: MODEL_PRICING[m.id]?.label ?? m.id,
          contextWindow: m.max_context_length ?? 131_072,
          maxOutput: m.max_output,
        }),
      );
  }

  private async fetchTogether(apiKey: string): Promise<ProviderModel[]> {
    const { data } = await axios.get('https://api.together.xyz/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });

    const excluded = ['embed', 'rerank', 'moderation', 'vision'];
    return (data ?? [])
      .filter(
        (m: any) =>
          m.type === 'chat' && !excluded.some((e) => String(m.id).includes(e)),
      )
      .map((m: any) =>
        this.enrichModel({
          id: m.id,
          name: MODEL_PRICING[m.id]?.label ?? m.id,
          contextWindow: m.context_length ?? 131_072,
        }),
      );
  }

  private async fetchOpenRouter(_apiKey: string): Promise<ProviderModel[]> {
    const models = await this.openRouterModels.listModels({ textOnly: true });

    // Build top-paid: non-free sorted by output price desc, limit 10
    const paidModels = models.filter((m) => !m.isFree);
    const topPaidIds = new Set(
      [...paidModels]
        .sort((a, b) => b.pricing.completion - a.pricing.completion)
        .slice(0, 10)
        .map((m) => m.id),
    );

    return models.slice(0, 150).map((m) => {
      const categories: string[] = [...m.categories];
      if (topPaidIds.has(m.id)) categories.push('top-paid');

      return {
        id: m.id,
        name: m.name,
        contextWindow: m.contextLength,
        pricing: { input: m.pricing.prompt, output: m.pricing.completion },
        deprecated: false,
        recommended: false,
        categories,
      } as ProviderModel;
    });
  }
}
