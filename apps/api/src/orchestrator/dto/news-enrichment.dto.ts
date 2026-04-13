export interface NewsEnrichment {
  /** 0.0–1.0 — relevancia técnica (indicadores, señal, timeframe) */
  technicalRelevance: number;
  /** Descripción del impacto en el ecosistema blockchain */
  ecosystemImpact: string;
  /** Tags orquestados: categoría, chains afectadas, indicadores */
  orchestratedTags: string[];
}
