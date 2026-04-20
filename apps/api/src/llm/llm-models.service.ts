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

  private async fetchOpenRouter(apiKey: string): Promise<ProviderModel[]> {
    const { data } = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });

    const textModels = (data.data ?? []).filter(
      (m: any) =>
        m.id &&
        m.architecture?.modality === 'text->text' &&
        m.top_provider?.is_moderated !== undefined &&
        !m.expiration_date, // exclude deprecated/expiring models
    );

    // Sort by weekly usage (position in API response = popularity) and build models
    const models: ProviderModel[] = textModels.slice(0, 150).map((m: any) => {
      const inputPrice = m.pricing
        ? parseFloat(m.pricing.prompt) * 1_000_000
        : 0;
      const outputPrice = m.pricing
        ? parseFloat(m.pricing.completion) * 1_000_000
        : 0;
      const isFree = inputPrice === 0 && outputPrice === 0;
      const supportedParams: string[] = m.supported_parameters ?? [];
      const hasReasoning =
        supportedParams.includes('reasoning') ||
        supportedParams.includes('include_reasoning');
      const hasTools = supportedParams.includes('tools');
      const contextLen = m.context_length ?? 128_000;

      // Dynamic category classification
      const categories: string[] = [];
      if (isFree) categories.push('free');
      if (!isFree) categories.push('paid');
      if (hasReasoning) categories.push('reasoning');
      if (hasTools) categories.push('analytics');
      // "fast" heuristic: low price + high context or known fast providers
      if ((inputPrice < 1.0 && outputPrice < 5.0) || isFree) {
        categories.push('fast');
      }

      return {
        id: m.id,
        name: m.name ?? m.id,
        contextWindow: contextLen,
        pricing: { input: inputPrice, output: outputPrice },
        deprecated: false,
        recommended: MODEL_PRICING[m.id]?.recommended ?? false,
        categories,
      } as ProviderModel;
    });

    // Build top-paid: non-free sorted by output price desc (most capable first), limit 10
    const paidModels = models.filter((m) => m.categories?.includes('paid'));
    const topPaidIds = new Set(
      [...paidModels]
        .sort((a, b) => (b.pricing?.output ?? 0) - (a.pricing?.output ?? 0))
        .slice(0, 10)
        .map((m) => m.id),
    );

    // Tag top-paid
    for (const m of models) {
      if (topPaidIds.has(m.id)) {
        m.categories!.push('top-paid');
      }
    }

    return models;
  }
}
