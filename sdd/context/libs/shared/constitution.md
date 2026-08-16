# Constitución — libs/shared

> Versión 1.0 | Última actualización: cycle-0 (inicial)

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Types, DTOs, constantes y utilidades compartidas entre backend y frontend.

## 2. Stack tecnológico

- TypeScript puro, sin dependencias de framework.

## 3. Estructura y patrones

- Sin dependencias internas — es la base del grafo; todas las demás libs/apps pueden importarla.

## 4. Convenciones propias

- No introducir dependencias de React ni NestJS acá. Tests: `pnpm nx test shared`.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
