# Constitución — libs/ui

> Versión 1.0 | Última actualización: cycle-0 (inicial)

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Design system React stateless (50+ componentes): primitives, composites, feedback, layout, theme, charts y componentes de dominio (market, agent, chat, help).

## 2. Stack tecnológico

- React 19, Tailwind, clsx + tailwind-merge, lucide-react, @radix-ui/*, gsap (peerDeps). Tests con Vitest.

## 3. Estructura y patrones

- Presenters puros: 1 concepto = 1 archivo. Consumida por `apps/web` vía path alias del workspace.

## 4. Convenciones propias

- Sin hooks de datos: ningún componente importa useQuery/useMutation, Zustand, React Router ni useTranslation — toda data llega por props.
- i18n por prop `t: (key, opts?) => string`. Dependencias mínimas. Tests: `pnpm nx test ui`.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
