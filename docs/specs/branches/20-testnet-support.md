# Spec 20 — Soporte de Binance Testnet (modo TESTNET)

## Objetivo

Agregar un tercer modo de trading — **TESTNET** — que ejecuta órdenes reales contra la testnet oficial de Binance (`testnet.binance.vision`) usando claves API dedicadas de testnet. Esto permite probar el flujo de trading completo (LLM → decisión → orden real → posición) sin exponer dinero real, ofreciendo más fidelidad que el modo SANDBOX (que simula el balance internamente). El usuario podrá elegir entre tres modos: **SANDBOX** (simulación interna), **TESTNET** (testnet de Binance) y **LIVE** (producción real).

## Alcance

### Shared / Tipos

- `apps/api/src/__mocks__/generated-prisma.ts` — agregar `TESTNET` al mock del enum `TradingMode`

### Backend — Prisma & DB

- `apps/api/prisma/schema.prisma` — extender `enum TradingMode` con valor `TESTNET`; agregar campo `isTestnet Boolean @default(false)` a modelo `BinanceCredential`; cambiar la constraint `@unique` de `userId` a `@@unique([userId, isTestnet])` para permitir una credencial de producción y una de testnet por usuario
- `apps/api/prisma/migrations/` — nueva migración que aplica los cambios anteriores

### Backend — Módulo Users

- `apps/api/src/users/users.service.ts` — agregar métodos `setTestnetBinanceKeys`, `deleteTestnetBinanceKeys`, `getTestnetBinanceKeyStatus`, `testTestnetBinanceConnection`; adaptar `setBinanceKeys` / `deleteBinanceKeys` para que operen con `isTestnet: false` (mantener retrocompatibilidad)
- `apps/api/src/users/users.controller.ts` — exponer nuevos endpoints:
  - `POST /users/me/binance-keys/testnet`
  - `DELETE /users/me/binance-keys/testnet`
  - `GET /users/me/binance-keys/testnet/status`
  - `GET /users/me/binance-keys/testnet/test`
- `apps/api/src/users/dto/` — nuevo DTO `SetTestnetBinanceKeysDto` (igual estructura que el de producción)

### Backend — Trading Processor

- `apps/api/src/trading/trading.processor.ts` — en la lógica de ejecución de órdenes:
  - Si `config.mode === TradingMode.TESTNET`: descifrar claves testnet (`isTestnet: true`) e instanciar `BinanceRestClient({ apiKey, apiSecret, testnet: true })`; no usar el sandbox wallet virtual; ejecutar órdenes reales contra testnet
  - Si `config.mode === TradingMode.LIVE`: comportamiento actual sin cambios
  - Si `config.mode === TradingMode.SANDBOX`: comportamiento actual sin cambios
  - Ajustar guard de validación pre-ejecución: requerir testnet keys cuando `mode === TESTNET` (similar al guard de LIVE para producción)

### Backend — Endpoint de balance de Binance

- `apps/api/src/trading/trading.controller.ts` — agregar endpoint `GET /trading/balance?mode=LIVE|TESTNET` que devuelve el saldo real de USDT y USDC de la cuenta Binance del usuario; usa las credenciales de producción (`isTestnet: false`) para `LIVE` y las de testnet (`isTestnet: true`) para `TESTNET`; retorna 400 si el modo no tiene claves configuradas
- `apps/api/src/trading/trading.service.ts` — implementar método `getLiveBinanceBalance(userId, isTestnet: boolean)` que descifra las claves correspondientes e instancia `BinanceRestClient` con el flag correcto, luego llama a `getBalances()` y filtra solo USDT y USDC

### Backend — Chat Service

- `apps/api/src/chat/chat.service.ts` — actualizar el contexto del sistema para que el LLM conozca el modo TESTNET y pueda explicárselo al usuario

### Frontend — Tipos

- `apps/web/src/pages/onboarding.tsx` — extender `type TradingMode` local para incluir `'TESTNET'`; agregar tarjeta de selección TESTNET (visible solo si el usuario tiene testnet keys guardadas); agregar paso/modal de configuración de testnet keys similar al de LIVE

### Frontend — Configuración de Trading

- `apps/web/src/pages/dashboard/config.tsx` — agregar `'TESTNET'` al array de modos `['SANDBOX', 'TESTNET', 'LIVE']`; mostrar badge/aviso contextual cuando se selecciona TESTNET; mostrar warning si se selecciona TESTNET pero no hay testnet keys configuradas

### Frontend — Ajustes / Claves API

- `apps/web/src/pages/settings.tsx` (o el componente que maneja las Binance keys en settings) — agregar sección "Claves API de Binance Testnet" similar a la sección de producción; usar nuevos hooks `useSetTestnetBinanceKeys`, `useDeleteTestnetBinanceKeys`, `useTestnetBinanceKeyStatus`, `useTestTestnetBinanceConnection`

### Frontend — Hooks

- `apps/web/src/hooks/use-user.ts` — agregar hooks:
  - `useTestnetBinanceKeyStatus()`
  - `useSetTestnetBinanceKeys()`
  - `useDeleteTestnetBinanceKeys()`
  - `useTestTestnetBinanceConnection()`
- `apps/web/src/hooks/use-trading.ts` — agregar hook `useBinanceBalance(mode: 'LIVE' | 'TESTNET')` que llama a `GET /trading/balance?mode=<mode>` y devuelve `{ currency: string; balance: number }[]`; solo se activa si el usuario tiene keys del modo correspondiente; el hook existente `useSandboxWallet()` no se modifica

### Frontend — Dashboard (widget de balance)

- `apps/web/src/pages/dashboard/` (componente o sección que muestra el balance actual) — mostrar el balance de USDT y USDC según el modo activo del usuario:
  - `SANDBOX` → usa `useSandboxWallet()` (comportamiento actual, sin cambios)
  - `TESTNET` → usa `useBinanceBalance('TESTNET')` mostrando los fondos reales de la cuenta testnet de Binance
  - `LIVE` → usa `useBinanceBalance('LIVE')` mostrando los fondos reales de la cuenta de producción de Binance
- Incluir badge/label visual que indique la fuente del balance (`Sandbox virtual`, `Binance Testnet`, `Binance Live`) para que el usuario siempre sepa qué balance está viendo

### Frontend — i18n

- `apps/web/src/locales/es.ts` — agregar claves para modo TESTNET, labels de botones, descripciones, warnings y textos de onboarding
- `apps/web/src/locales/en.ts` — ídem en inglés

## Criterios de aceptación

- El enum `TradingMode` en Prisma contiene `LIVE`, `SANDBOX` y `TESTNET`
- Un usuario puede guardar claves API de testnet (`isTestnet: true`) independientemente de sus claves de producción; ambas pueden coexistir
- Al seleccionar modo `TESTNET` en la configuración de trading, el agente usa `BinanceRestClient({ testnet: true })` con las claves testnet descifradas — nunca las claves de producción
- Al seleccionar modo `TESTNET`, el sistema NO usa el sandbox wallet virtual (no debita de `sandboxWallets`); las órdenes se registran en `trades` y `positions` con `mode: TESTNET`
- Si el usuario selecciona modo `TESTNET` sin tener testnet keys guardadas, el agente no inicia y se genera una notificación de error `AGENT_ERROR` con clave `agentNoTestnetKeys`
- El selector de modo en `config.tsx` muestra las tres opciones: **Sandbox**, **Testnet** y **En Vivo**
- En onboarding, la tarjeta TESTNET es visible y seleccionable solo si el usuario completó el paso de testnet keys
- Las testnet keys se cifran con AES-256 igual que las claves de producción
- Los endpoints de testnet keys están protegidos con JWT guard y solo opera el usuario dueño del recurso
- El LLM chat sabe describir los tres modos correctamente
- La migración de Prisma es reversible (down migration compatible)
- El mock `__mocks__/generated-prisma.ts` incluye `TESTNET` en el enum
- El endpoint `GET /trading/balance?mode=LIVE` retorna el balance real de USDT y USDC de la cuenta Binance de producción del usuario
- El endpoint `GET /trading/balance?mode=TESTNET` retorna el balance real de USDT y USDC de la cuenta Binance testnet del usuario usando `BinanceRestClient({ testnet: true })`
- En el dashboard, cuando el modo activo es `LIVE` o `TESTNET`, el widget de balance muestra los fondos de Binance (no el sandbox wallet virtual); el label de fuente es visible en todo momento
- Si el usuario no tiene keys del modo solicitado, el widget muestra un estado vacío con mensaje explicativo en vez de un error
- **Branch:** `feature/20-testnet-support`

---

**Depende de:** 15 (Backend Completion), 16 (Frontend Completion)  
**Siguiente:** Sin spec asignada aún
