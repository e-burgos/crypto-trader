# Constitución — apps/api-e2e

> Versión 1.0 | Última actualización: cycle-0 (inicial)

## 1. Propósito

- **Tipo:** app
- **Rol en el sistema:** Suite de tests de integración del backend: valida endpoints del API real levantado contra base de datos de prueba.

## 2. Stack tecnológico

- **Jest** + **Supertest** sobre el API NestJS.

## 3. Estructura y patrones

- Specs en `apps/api-e2e/src/api/`; setup compartido en `apps/api-e2e/src/support/`.

## 4. Convenciones propias

- Ejecutar: `pnpm nx e2e api-e2e`. Los tests no deben depender de datos productivos ni claves reales.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
