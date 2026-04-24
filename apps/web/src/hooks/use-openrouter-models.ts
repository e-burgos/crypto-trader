import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  contextLength: number;
  maxCompletionTokens: number | null;
  pricing: { prompt: number; completion: number };
  isFree: boolean;
  categories: string[];
  supportedParameters: string[];
  description?: string;
}

interface OpenRouterModelsResponse {
  data: OpenRouterModelInfo[];
  count: number;
}

export function useOpenRouterModels(filter?: {
  category?: string;
  freeOnly?: boolean;
}) {
  return useQuery<OpenRouterModelInfo[]>({
    queryKey: ['openrouter-models', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter?.category) params.set('category', filter.category);
      if (filter?.freeOnly) params.set('freeOnly', 'true');
      const response = await api.get<OpenRouterModelsResponse>(
        `/openrouter/models?${params.toString()}`,
      );
      return response.data;
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Returns the top curated model IDs (paid first, then free)
 * from the dynamically fetched OpenRouter models.
 */
export function useOpenRouterCuratedModels(limit = 8) {
  const { data: models, ...rest } = useOpenRouterModels();

  const curated: string[] = [];
  if (models) {
    // Top paid by price (most capable)
    const paid = models
      .filter((m) => !m.isFree)
      .sort((a, b) => b.pricing.completion - a.pricing.completion)
      .slice(0, 5);
    // Top free by context length
    const free = models
      .filter((m) => m.isFree)
      .sort((a, b) => b.contextLength - a.contextLength)
      .slice(0, limit - paid.length);

    curated.push(...paid.map((m) => m.id), ...free.map((m) => m.id));
  }

  return { data: curated, models, ...rest };
}
