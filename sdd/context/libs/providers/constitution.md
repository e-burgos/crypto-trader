# Constitución — libs/providers

> Versión 1.0 | Última actualización: cycle-0 (inicial)

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Proveedores de datos de mercado externos bajo una interfaz común `data-source.interface.ts`: CoinGecko, DefiLlama, Messari, Finnhub, Coinalyze, Altfins, Alternative.me (Fear & Greed), Polymarket.

## 2. Stack tecnológico

- TypeScript (Vitest). Validación de respuestas con schemas en `src/lib/schemas/`.

## 3. Estructura y patrones

- Un provider = un archivo `*.provider.ts` + su `*.provider.spec.ts`, implementando la interfaz común.

## 4. Convenciones propias

- Tests: `pnpm nx test providers`. Al agregar un provider nuevo, implementar la interfaz y agregar su spec.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
