# Constitución — libs/ui

> Versión 1.1 | Última actualización: cycle-02 | Fecha: 2026-09-04
> Fragmentos consolidados: spec-e-burgos-009 cycle-01 (2026-09-03) + spec-e-burgos-009 cycle-02 (2026-09-04)

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Design system React stateless (50+ componentes): primitives, composites, feedback, layout, theme, charts y componentes de dominio (market, agent, chat, help).

## 2. Stack tecnológico

- React 19, Tailwind, clsx + tailwind-merge, lucide-react, @radix-ui/*, gsap (peerDeps). Tests con Vitest + jsdom (target `test` desde spec-009 cycle-01).

## 3. Estructura y patrones

- Presenters puros: 1 concepto = 1 archivo. Consumida por `apps/web` vía path alias del workspace.
- Las extensiones que pide `apps/web` son **aditivas y opcionales**, nunca primitivas nuevas ni cambios de API: `ToggleSwitch` acepta `id`, `ariaLabel` y `describedById`; `SliderField` acepta `disabled`, `id`, `hint`, `tooltip` y `formatValue` (accesibilidad y estados deshabilitados con motivo, spec-009 cycle-01).
- `Card` (composite) propaga los atributos HTML restantes al div raíz (FIX-e-burgos-021): `data-testid`, `aria-*`, `id` llegan al DOM.
- `Badge` (primitiva) tiene la variante **`info`** (fondo `sky-500/10`, ícono `Clock` estático): tono informativo para un estado vigente que no es éxito, error ni advertencia (la pidió el badge `RESTING` de la vista de entradas). La alternativa era `loading`, que renderiza un spinner permanente por fila e ignora `prefers-reduced-motion`. `BadgeVariant` se exporta desde el barrel para que los consumidores deriven mapeos exhaustivos (`Record<EntryOrderStatusWire, BadgeVariant>` en `apps/web`). `badge.spec.tsx` cubre que `info` no anima y es distinta de `neutral` y `loading`.

## 4. Convenciones propias

- Sin hooks de datos: ningún componente importa useQuery/useMutation, Zustand, React Router ni useTranslation — toda data llega por props.
- i18n por prop `t: (key, opts?) => string`. Dependencias mínimas. Tests: `pnpm nx test ui`.
- Una variante nueva de una primitiva se agrega sólo si ninguna existente expresa el estado sin efectos colaterales (animación, semántica equivocada); se documenta el motivo y se cubre con un test propio.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
