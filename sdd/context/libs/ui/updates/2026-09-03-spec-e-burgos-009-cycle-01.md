# spec-e-burgos-009 cycle-01 — 2026-09-03

## Estructura

- Extensiones **aditivas**, todas opcionales, sin primitivas nuevas: `ToggleSwitch` acepta `id`,
  `ariaLabel` y `describedById`; `SliderField` acepta `disabled`, `id`, `hint`, `tooltip` y
  `formatValue`. Las agregó la configuración avanzada de `apps/web` para accesibilidad y estados
  deshabilitados con motivo.
- `Card` (composite) propaga los atributos HTML restantes al div raíz (FIX-e-burgos-021): `data-testid`,
  `aria-*`, `id` llegan al DOM. `libs/ui` tiene ahora target `test` (Vitest + jsdom).
