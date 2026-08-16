# Context Prompt — libs/providers

> Entry point para agentes que trabajen sobre `libs/providers`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD — sin ciclos SDD completados todavía.
- Rol: Proveedores de datos de mercado externos bajo una interfaz común `data-source.interface.ts`: CoinGecko, DefiLlama, Messari, Finnhub, Coinalyze, Altfins, Alternative.me (Fear & Greed), Polymarket.
- Testear: `pnpm nx test providers`. Lint: `pnpm nx lint providers`.
