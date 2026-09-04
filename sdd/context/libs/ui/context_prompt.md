# Context Prompt — libs/ui

> Entry point para agentes que trabajen sobre `libs/ui`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-02 | Fecha: 2026-09-04
> Fragmentos consolidados: spec-e-burgos-009 cycle-01 (2026-09-03) + spec-e-burgos-009 cycle-02 (2026-09-04)

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **2 ciclos SDD la tocaron**, ambos aditivos:
  - **spec-e-burgos-009 cycle-01** — props opcionales en `ToggleSwitch` y `SliderField`, `Card` propaga atributos HTML (FIX-e-burgos-021), target `test` (Vitest + jsdom). Ver `constitution.md` §3.
  - **spec-e-burgos-009 cycle-02** — variante `info` del `Badge` con test propio. Ver `constitution.md` §3.
- Rol: Design system React stateless (50+ componentes): primitives, composites, feedback, layout, theme, charts y componentes de dominio (market, agent, chat, help).
- Testear: `pnpm nx test ui`. Lint: `pnpm nx lint ui`.

## Qué sigue

- Sin pendientes propios: los consumidores derivan sus mapeos de `BadgeVariant`; cualquier variante nueva sigue la convención de `constitution.md` §4.
