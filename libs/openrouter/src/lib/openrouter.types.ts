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

export interface OpenRouterModelsFilter {
  category?: string;
  freeOnly?: boolean;
  textOnly?: boolean;
}
