# FIX-e-burgos-021 — Card de libs/ui descarta props desconocidas: data-testid nunca llega al DOM

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-021                                   |
| **Tipo**      | BUGFIX                                  |
| **Severidad** | low                                   |
| **Keyword**   | [BUGFIX]                                |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | validated                               |
| **Spec**      | N/A (repo-level)                        |

## Problema

libs/ui/src/lib/composites/card.tsx desestructura sus props y no hace spread del resto, asi que <Card data-testid=...> no emite el atributo. Evidencia en /admin/data-sources: [data-testid="data-source-card"] -> 0 elementos, .ds-card -> 8. Los E2E usan .ds-card mientras tanto.

## Justificación del bypass

Bug real destapado al actualizar la suite E2E (FIX-e-burgos-020). Se registra para no perderlo; no
está implementado todavía.

### Archivos a modificar

- `libs/ui/src/lib/composites/card.tsx`

### Test de validación

- **Referencia:** pendiente, test unitario del componente o servicio afectado al implementar.

### Decisión del Reviewer

> Revisado por sdd-reviewer el **2026-09-03** — evidencia ejecutada, no leída.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia:** `pnpm nx test ui --skip-nx-cache` (2026-09-03) en verde: `src/lib/composites/card.spec.tsx` 2 tests passed — `data-testid` y los atributos HTML restantes llegan al div raíz.
>
> **Seguimiento:** Desvío menor de la regla ✍️ a limpiar en el próximo trabajo sobre E2E: el commit `8129518c` dejó un comentario narrativo de dos líneas con referencia al fix en `e2e/data-sources-admin.spec.ts:7-8`, fuera de las excepciones permitidas. No afecta el comportamiento.
