# Context Prompt — libs/openrouter

> Entry point para agentes que trabajen sobre `libs/openrouter`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD — sin ciclos SDD completados todavía.
- Rol: Catálogo dinámico de modelos OpenRouter: SDK + cache 15min; pricing, ranking y presets se construyen dinámicamente (nunca hardcodear modelos OpenRouter).
- Testear: `pnpm nx test openrouter`. Lint: `pnpm nx lint openrouter`.
