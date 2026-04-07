# Plan — 18 Help Page Redesign

**Spec:** `docs/specs/branches/18-help-page-redesign.md`
**Branch:** `feature/help-page-redesign`

## Tasks

- [ ] 1. Extraer `DecisionFlowDiagram` de `config.tsx` → `components/agent/decision-flow-diagram.tsx`
- [ ] 2. Extraer `StrategyPresets` + constante `PRESETS` → `components/agent/strategy-presets.tsx` (prop `onApply` opcional)
- [ ] 3. Extraer `ParameterCards` → `components/agent/parameter-cards.tsx`
- [ ] 4. Extraer `ExplainPanel` → `components/agent/explain-panel.tsx` (agregar prop `conceptId?` para filtrar por concepto individual)
- [x] 5. Actualizar `config.tsx`: importar desde `components/agent/`, eliminar tabs Guide/Concepts y estado `activeTab`, agregar callout con links a `/help`
- [x] 6. Agregar claves de locale en `en.ts` y `es.ts`: callout de config + labels del sidebar de help
- [x] 7. Crear `components/help/help-sidebar.tsx` con grupos, links y estado activo
- [x] 8. Reescribir `pages/help.tsx`: layout dos columnas, `IntersectionObserver`, importar componentes de agente, secciones con `id` y `data-section`, botón mobile flotante
- [ ] 9. Verificación visual en desktop y mobile + build verde

## Notas

- Los componentes extraídos en tasks 1–4 son un **move** directo, no una reescritura — copiar el JSX existente verbatim y exportarlo.
- `StrategyPresets` en `/help` se usa sin `onApply` → solo informativo, sin interacción de formulario.
- `ExplainPanel` con `conceptId` renderiza un solo concepto por sección; sin prop renderiza todos (compatibilidad con uso actual si fuera necesario).
- Task 5 depende de tasks 1–4. Task 8 depende de tasks 4, 6 y 7.
