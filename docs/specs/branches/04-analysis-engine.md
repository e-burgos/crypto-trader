# Spec 04 — Analysis Engine (Indicadores + LLM)

## Objetivo

Implementar librería de análisis técnico y motor de integración multi-LLM (Claude, OpenAI, Groq).

## Alcance

- `libs/analysis/src/indicators/`: RSI, MACD, Bollinger, EMA, volumen, soporte/resistencia
- `libs/analysis/src/llm/`: LLMProvider, ClaudeProvider, OpenAIProvider, GroqProvider, LLMAnalyzer
- Prompting estructurado, validación Zod, retries
- Tests unitarios: inputs conocidos, parseo, errores, factory

## Criterios de aceptación

- Todos los indicadores pasan tests con datos de ejemplo
- LLMAnalyzer produce JSON válido y maneja errores
- Branch: `feature/analysis-engine`

---

**Depende de:** 01-foundation
**Siguiente:** 05-trading-engine
