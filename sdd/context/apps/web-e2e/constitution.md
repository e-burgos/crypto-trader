# Constitución — apps/web-e2e

> Versión 1.0 | Última actualización: cycle-0 (inicial)

## 1. Propósito

- **Tipo:** app
- **Rol en el sistema:** Suite E2E del frontend: valida flujos de usuario completos en navegador real.

## 2. Stack tecnológico

- **Playwright** (config en `apps/web-e2e/playwright.config.ts`). Existe además `e2e/` en la raíz para tests cross-app.

## 3. Estructura y patrones

- Specs en `apps/web-e2e/src/`.

## 4. Convenciones propias

- Ejecutar: `pnpm nx e2e web-e2e`. Usar selectores accesibles/`data-testid`, no clases de Tailwind.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
