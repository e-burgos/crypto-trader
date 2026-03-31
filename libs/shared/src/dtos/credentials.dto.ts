import { LLMProvider } from '../types/enums';

// ── Credential DTOs ──────────────────────────────────────
export interface SaveBinanceKeysDto {
  apiKey: string;
  apiSecret: string;
}

export interface BinanceKeysStatusDto {
  connected: boolean;
}

export interface SaveLLMKeyDto {
  provider: LLMProvider;
  apiKey: string;
  selectedModel: string;
}

export interface LLMKeyStatusDto {
  provider: LLMProvider;
  connected: boolean;
  selectedModel: string;
}

export interface LLMKeysStatusResponseDto {
  providers: LLMKeyStatusDto[];
}
