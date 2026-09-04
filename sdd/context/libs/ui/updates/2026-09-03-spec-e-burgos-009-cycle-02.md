# spec-e-burgos-009 cycle-02 — 2026-09-03

## Estructura

- `Badge` (primitiva) suma la variante **aditiva `info`** (fondo `sky-500/10`, ícono `Clock`
  estático): tono informativo para un estado vigente que no es éxito, error ni advertencia. La
  pidió el badge `RESTING` de la vista de entradas de `apps/web`; la única variante libre era
  `loading`, que renderiza un spinner permanente por fila e ignora `prefers-reduced-motion`.
  `BadgeVariant` se sigue exportando desde el barrel, así que los consumidores derivan de él sus
  mapeos exhaustivos (`Record<EntryOrderStatusWire, BadgeVariant>` en `apps/web`).
- `badge.spec.tsx` (nuevo, 2 tests): `info` renderiza su etiqueta sin ningún `.animate-spin` y es
  visualmente distinta de `neutral` y de `loading`. Las otras cinco variantes y la API del
  componente no cambian.
