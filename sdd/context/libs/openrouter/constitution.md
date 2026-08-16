# Constitución — libs/openrouter

> Versión 1.0 | Última actualización: cycle-0 (inicial)

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Catálogo dinámico de modelos OpenRouter: SDK + cache 15min; pricing, ranking y presets se construyen dinámicamente (nunca hardcodear modelos OpenRouter).

## 2. Stack tecnológico

- TypeScript, `@openrouter/sdk`.

## 3. Estructura y patrones

- Sin dependencias internas. Consumida por `apps/api` y (solo tipos) por `apps/web`.

## 4. Convenciones propias

- Tests: `pnpm nx test openrouter`.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
