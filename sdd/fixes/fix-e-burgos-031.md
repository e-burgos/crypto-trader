# FIX-e-burgos-031 — Retirar TradingConfigData de libs/shared junto con su única cadena consumidora, que era código muerto

| Campo         | Valor                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **ID**        | FIX-e-burgos-031                                                      |
| **Tipo**      | IMPROVEMENT                                                           |
| **Severidad** | low                                                                   |
| **Keyword**   | [IMPROVEMENT]                                                         |
| **Fecha**     | 2026-09-04                                                            |
| **Autor**     | e-burgos                                                              |
| **Estado**    | validated                                                             |
| **Spec**      | spec-e-burgos-009-agent-advanced-config-ui (seguimiento del reviewer, cycle-02) |

## Problema

`TradingConfigData` (14 campos) convivía con `TradingConfigWire` como segundo wire de configuración
del bot en `libs/shared`. Ningún proyecto la importaba por nombre, pero era el tipo de
`LLMAnalysisInput.userConfig`, consumido únicamente por `buildAnalysisPrompt` en `libs/analysis`:
una función exportada por el barrel que nadie usaba fuera de su propio test (`apps/api` arma el
prompt por otro camino).

## Justificación del bypass

Seguimiento declarado por el reviewer de spec-009 cycle-02: era la única ambigüedad sobre cuál es el
wire de configuración. Código muerto sin cambio de comportamiento; no amerita ciclo.

## Solución aplicada

Se retiran `TradingConfigData` y `LLMAnalysisInput` de `libs/shared`, y `buildAnalysisPrompt` de
`libs/analysis` junto con su `describe` y su export del barrel. `parseLLMResponse` y `LLMDecision`
no cambian. `RecentDecisionRecord` queda exportado aunque ya no lo referencie ningún tipo.

### Archivos modificados

- `libs/shared/src/types/interfaces.ts` — sin `TradingConfigData` ni `LLMAnalysisInput`
- `libs/analysis/src/lib/llm/llm-types.ts` — sin `buildAnalysisPrompt`
- `libs/analysis/src/lib/llm/llm.spec.ts` — sin el `describe('buildAnalysisPrompt')` ni sus imports
- `libs/analysis/src/lib/llm/index.ts` — el barrel sólo exporta `parseLLMResponse`

### Test de validación

- **Referencia:** grep repo-wide sin ocurrencias de los tres símbolos;
  `pnpm nx run-many -t typecheck --projects=shared,analysis,api,web` en verde;
  `pnpm nx run-many -t test lint --projects=shared,analysis`: 20 + 160 tests, 0 errores de lint.

### Decisión del Reviewer

> Validado el 2026-09-04 en el main loop con la evidencia de arriba, previo a abrir el siguiente ciclo.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX

---
