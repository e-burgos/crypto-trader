# Context Prompt — libs/analysis

> Entry point para agentes que trabajen sobre `libs/analysis`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-01 | Fecha: 2026-09-04
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-005 cycle-01 (2026-08-30) + FIX-e-burgos-031 (2026-09-04) + spec-e-burgos-010 cycle-01 (2026-09-04)

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD.
  - **spec-e-burgos-001 cerrada (2 ciclos que tocaron esta lib):** el **cycle-01** podó `src/lib/llm/llm-analyzer.ts` (`LLMAnalyzer`) junto con `LLMAnalyzerConfig`, sus exports y su cobertura — la capacidad expuesta para trabajar con LLMs **no se redujo**; el **cycle-03** sumó el gate determinista pre-LLM (`src/lib/gate/`) y el soporte de prompt caching de proveedor (`src/lib/llm/prompt-cache.ts`).
  - **spec-e-burgos-005 cycle-01** — carpeta `src/lib/reactive/`: qué cuenta como evento material y cuándo el stream está sano, como funciones puras. 158 tests en verde. Ver `constitution.md` §3.
  - **FIX-e-burgos-031** — se retiró `buildAnalysisPrompt`, código muerto sin consumidores propios. `parseLLMResponse` y los providers no cambiaron.
  - **spec-e-burgos-010 cycle-01, cerrado sin aprobar (DEC-001).** `resolveUserDataStreamHealth()` nuevo en `src/lib/reactive/`: función pura con tests verdes, hermana de `resolveStreamHealth` pero con contrato propio. Hoy sin llamador real: su único consumidor (`UserDataStreamService` de `apps/api`) es inerte porque Binance retiró el endpoint del `listenKey`. Ver `constitution.md` §3.
- Rol: Indicadores técnicos (RSI, MACD, Bollinger, EMA, volumen, soportes/resistencias) e integración con proveedores LLM para la decisión del agente.
- Testear: `pnpm nx test analysis`. Lint: `pnpm nx lint analysis`.

## Qué sigue

- **El prompt caching es capacidad dormida, no un ahorro activo.** El mínimo cacheable es 1024 tokens de prefijo (2048 en Haiku) y los system prompts de `AgentDefinition` miden 650-830: `shouldMarkPromptForCache()` devuelve `false` siempre hoy. Se activa sola si los prompts crecen o se consolida un prefijo estático compartido.
- El gate consume `positionsFingerprint`/`newsFingerprint`/`macroFingerprint` calculados fuera de la lib (`libs/shared/utils/fingerprint.ts`): al agregar condiciones nuevas, mantener la huella del lado del llamador para que estas funciones sigan siendo puras y testeables sin mocks.
- Los 12 escenarios congelados del harness de costo (`apps/api/src/orchestrator/cost-harness/`) **solo ejercitan `PRICE_MOVED`**: 11 tienen extremos de precio estables y el único que adelanta es `broken-price-spike`. `LEVEL_BREAK` y `VOLUME_SPIKE` están cubiertos por los tests unitarios de esta lib, no por el harness. Ampliar los escenarios impacta también al harness hermano de costo de LLM: es trabajo de un ciclo, no de una task suelta.
- `resolveUserDataStreamHealth()` (spec-e-burgos-010 cycle-01) no tiene llamador vivo mientras el transporte listenKey esté inerte. Si cycle-02 migra al user data stream de la WebSocket API de Binance (DEC-001), el modelo de salud se reusa tal cual.
