# Crypto Trader — Branch Plan (SDD Modular)

## Estructura de branches y specs

| #   | Branch                             | Spec file                     | Depende de |
| --- | ---------------------------------- | ----------------------------- | ---------- |
| 01  | feature/foundation                 | 01-foundation.md              | —          |
| 02  | feature/auth-users                 | 02-auth-users.md              | 01         |
| 03  | feature/data-layer                 | 03-data-layer.md              | 01         |
| 04  | feature/analysis-engine            | 04-analysis-engine.md         | 01         |
| 05  | feature/trading-engine             | 05-trading-engine.md          | 02,03,04   |
| 06  | feature/backend-support            | 06-backend-support.md         | 05         |
| 07  | feature/frontend-foundation        | 07-frontend-foundation.md     | 01         |
| 08  | feature/frontend-auth              | 08-frontend-auth.md           | 02,07      |
| 09  | feature/frontend-dashboard         | 09-frontend-dashboard.md      | 07         |
| 10  | feature/frontend-features          | 10-frontend-features.md       | 09         |
| 11  | feature/frontend-integration       | 11-frontend-integration.md    | 10,06      |
| 12  | feature/devops                     | 12-devops.md                  | 11         |
| 13  | feature/e2e-tests                  | 13-e2e-tests.md               | 12         |
| 28  | feature/multi-agent-chat-rag       | 28-multi-agent-chat-rag.md    | 17         |
| 29  | feature/adaptive-agents            | 29-adaptive-agents.md         | 28         |
| 30  | feature/multi-agent-e2e-qa         | 30-multi-agent-e2e-qa.md      | 28         |
| 31  | feature/llm-provider-dashboard     | 31-llm-provider-dashboard.md  | 23,17      |
| 32  | feature/32-operation-mode-selector | 32-operation-mode-selector.md | 20,02,09   |
| 33  | feature/33-bugfix-batch-ux-data    | 33-bugfix-batch-ux-data.md    | 31,32,28   |

## Flujo recomendado

1. Merge de `feature/foundation` a `main` (ya implementado)
2. Trabajar secuencialmente: `feature/auth-users` → `feature/data-layer` → ...
3. Cada branch tiene su propia spec y criterios de aceptación
4. PRs pequeños, revisables, y mergeables por bloque funcional

## Notas

- Si se requiere paralelismo, branches 02, 03, 04 y 07 pueden avanzar en paralelo tras foundation
- Cada branch debe actualizar el plan y specs si hay cambios de alcance
- El spec general se mantiene solo como referencia histórica
