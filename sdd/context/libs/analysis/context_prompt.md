# Context Prompt — libs/analysis

> Entry point para agentes que trabajen sobre `libs/analysis`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-03 | Fecha: 2026-08-18

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **spec-e-burgos-001 cerrada (2 ciclos que tocaron esta lib)**:
  - **cycle-01** — poda de `src/lib/llm/llm-analyzer.ts` (`LLMAnalyzer`) junto con el tipo `LLMAnalyzerConfig`, sus exports en el barrel y su cobertura en `llm.spec.ts`. La capacidad expuesta para trabajar con LLMs **no se redujo**.
  - **cycle-03** (último de la spec) — gate determinista pre-LLM (`src/lib/gate/`) y soporte de prompt caching de proveedor (`src/lib/llm/prompt-cache.ts`), ver `constitution.md` §3.
- Rol: Indicadores técnicos (RSI, MACD, Bollinger, EMA, volumen, soportes/resistencias) e integración con proveedores LLM para la decisión del agente.
- Testear: `pnpm nx test analysis`. Lint: `pnpm nx lint analysis`.

## Qué sigue

- **El prompt caching es capacidad dormida, no un ahorro activo.** El mínimo cacheable es 1024 tokens de prefijo (2048 en Haiku) y los system prompts de `AgentDefinition` miden 650-830: `shouldMarkPromptForCache()` devuelve `false` siempre hoy. Se activa sola si los prompts crecen o se consolida un prefijo estático compartido.
- El gate consume `positionsFingerprint`/`newsFingerprint`/`macroFingerprint` calculados fuera de la lib (`libs/shared/utils/fingerprint.ts`): al agregar condiciones nuevas, mantener la huella del lado del llamador para que estas funciones sigan siendo puras y testeables sin mocks.
