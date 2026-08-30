export interface MaterialEventThresholds {
  /** Se inyecta desde TradingConfig.gatePriceChangePct; no tiene default propio en runtime. */
  priceChangePct: number;
  /** Distancia mínima a un nivel para CONFIRMAR de qué lado está el precio (histéresis, RN-6). */
  levelConfirmDistancePct: number;
  /** Ratio volumen observado / volumen esperado a esta altura de la vela. */
  volumeSpikeRatio: number;
  /** Piso de la fracción transcurrida de la vela, para no dividir por ~0 al abrirla. */
  volumeMinElapsedFraction: number;
  /** Throttle de evaluación del detector por símbolo. */
  minEvaluationIntervalMs: number;
}

export const DEFAULT_MATERIAL_EVENT_THRESHOLDS: MaterialEventThresholds = {
  priceChangePct: 0.005,
  levelConfirmDistancePct: 0.002,
  volumeSpikeRatio: 2.5,
  volumeMinElapsedFraction: 0.1,
  minEvaluationIntervalMs: 250,
};
