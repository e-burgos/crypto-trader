# Context Prompt — libs/analysis

> Entry point para agentes que trabajen sobre `libs/analysis`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-01 | Fecha: 2026-08-17

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **1 ciclo SDD completado** (spec-e-burgos-001 cycle-01): poda de `src/lib/llm/llm-analyzer.ts` (`LLMAnalyzer`) junto con el tipo `LLMAnalyzerConfig`, sus exports en el barrel y su cobertura en `llm.spec.ts`. La capacidad expuesta para trabajar con LLMs **no se redujo**.
- Rol: Indicadores técnicos (RSI, MACD, Bollinger, EMA, volumen, soportes/resistencias) e integración con proveedores LLM para la decisión del agente.
- Testear: `pnpm nx test analysis`. Lint: `pnpm nx lint analysis`.
