# Plan — 20 Testnet Support

**Spec:** `docs/specs/branches/20-testnet-support.md`  
**Branch:** `feature/20-testnet-support`

## Tasks

- [ ] 1. Actualizar mock de Prisma — `apps/api/src/__mocks__/generated-prisma.ts`: agregar `TESTNET` al objeto `TradingMode`
- [ ] 2. Extender schema de Prisma — `apps/api/prisma/schema.prisma`: agregar `TESTNET` al enum `TradingMode`; agregar campo `isTestnet Boolean @default(false)` a `BinanceCredential`; cambiar `@unique` de `userId` a `@@unique([userId, isTestnet])`
- [ ] 3. Generar migración de Prisma — `apps/api/prisma/migrations/`: ejecutar `prisma migrate dev --name add_testnet_trading_mode` para crear la migración SQL que añade el valor al enum, el campo `isTestnet` a `binance_credentials` y reemplaza el índice único
- [ ] 4. Regenerar cliente Prisma — `apps/api/generated/`: `prisma generate` para que los tipos TypeScript reflejen el nuevo enum y el campo `isTestnet`
- [ ] 5. Crear DTO testnet keys — `apps/api/src/users/dto/set-testnet-binance-keys.dto.ts`: misma estructura que el DTO de producción (`apiKey: string`, `apiSecret: string`)
- [ ] 6. Agregar métodos de servicio para testnet keys — `apps/api/src/users/users.service.ts`: implementar `setTestnetBinanceKeys`, `deleteTestnetBinanceKeys`, `getTestnetBinanceKeyStatus`, `testTestnetBinanceConnection`; usar `isTestnet: true` como discriminador en todas las queries de Prisma; adaptar métodos existentes para usar `isTestnet: false` explícito
- [ ] 7. Exponer endpoints de testnet keys — `apps/api/src/users/users.controller.ts`: agregar `POST /users/me/binance-keys/testnet`, `DELETE /users/me/binance-keys/testnet`, `GET /users/me/binance-keys/testnet/status`, `GET /users/me/binance-keys/testnet/test`; decoradores Swagger correspondientes
- [ ] 8. Actualizar trading processor para modo TESTNET — `apps/api/src/trading/trading.processor.ts`: en la sección de resolución de credenciales, agregar rama `mode === TradingMode.TESTNET` que descifra las keys con `isTestnet: true` e instancia `BinanceRestClient({ apiKey, apiSecret, testnet: true })`; sacar el bloque de fetch de candles fuera del condicional LIVE para que también funcione en TESTNET; en `executeOrder`, saltar el path de `SandboxOrderExecutor` y usar el `LiveOrderExecutor` cuando el modo es `TESTNET`; agregar guard pre-ejecución que emite `AGENT_ERROR agentNoTestnetKeys` si el modo es `TESTNET` y no hay testnet keys
- [ ] 9. Implementar servicio de balance de Binance — `apps/api/src/trading/trading.service.ts`: agregar método `getLiveBinanceBalance(userId: string, isTestnet: boolean)` que descifra las claves correspondientes, instancia `BinanceRestClient({ testnet: isTestnet })`, llama a `getBalances()` y filtra retornando solo USDT y USDC
- [ ] 10. Exponer endpoint de balance de Binance — `apps/api/src/trading/trading.controller.ts`: agregar `GET /trading/balance?mode=LIVE|TESTNET`; validar que `mode` sea uno de los dos valores permitidos; delegar en el servicio del task 9; retornar 400 si el usuario no tiene keys para el modo solicitado
- [ ] 11. Actualizar contexto del chat service — `apps/api/src/chat/chat.service.ts`: actualizar descripción de modos para incluir TESTNET
- [ ] 12. Agregar hooks de testnet y balance en frontend — `apps/web/src/hooks/use-user.ts`: implementar `useTestnetBinanceKeyStatus`, `useSetTestnetBinanceKeys`, `useDeleteTestnetBinanceKeys`, `useTestTestnetBinanceConnection`; `apps/web/src/hooks/use-trading.ts`: agregar `useBinanceBalance(mode: 'LIVE' | 'TESTNET')` que llama a `GET /trading/balance?mode=<mode>` y retorna `{ currency: string; balance: number }[]`
- [ ] 13. Agregar i18n keys — `apps/web/src/locales/es.ts` y `apps/web/src/locales/en.ts`: añadir claves para `testnet` (label modo), `testnetTitle`, `testnetDesc`, `testnetRecommended`, `binanceTestnetKeys`, `binanceTestnetApiKey`, `binanceTestnetApiSecret`, `testnetWarning`, `balanceSource.sandbox`, `balanceSource.testnet`, `balanceSource.live`, etc.
- [ ] 14. Actualizar widget de balance en dashboard — componente que muestra el saldo en `apps/web/src/pages/dashboard/`: condicionar la fuente del balance según el modo activo del usuario (`SANDBOX` → `useSandboxWallet()`, `TESTNET`/`LIVE` → `useBinanceBalance(mode)`); mostrar label de fuente (`Sandbox virtual`, `Binance Testnet`, `Binance Live`); mostrar estado vacío con mensaje si no hay keys configuradas para el modo
- [ ] 15. Actualizar selector de modo en config — `apps/web/src/pages/dashboard/config.tsx`: extender el tipo local y el array de modos a `['SANDBOX', 'TESTNET', 'LIVE']`; agregar badge visual para TESTNET; mostrar alert/warning si se selecciona TESTNET sin testnet keys configuradas
- [ ] 16. Agregar sección testnet keys en settings — `apps/web/src/pages/settings.tsx` (o el componente binance-keys-section existente): añadir bloque "Claves API de Binance Testnet" con formulario de API Key + Secret, botón de test de conexión y botón de desconectar; usar hooks del task 12
- [ ] 17. Agregar tarjeta TESTNET en onboarding — `apps/web/src/pages/onboarding.tsx`: extender `type TradingMode` con `'TESTNET'`; agregar tarjeta TESTNET visible si el usuario completó testnet keys; mantener orden visual SANDBOX → TESTNET → LIVE

## Notas

- `BinanceRestClient` ya tiene soporte para `testnet: true` en la lib `data-fetcher` — no requiere cambios en ese nivel.
- El cambio en la constraint `@unique` de `BinanceCredential` (de `userId` a compuesto `[userId, isTestnet]`) rompe el índice existente; la migración debe dropear el índice viejo y crear el compuesto. Prestar atención en la migración generada.
- Los trades ejecutados en modo TESTNET se guardan con `mode: 'TESTNET'` en la tabla `trades` y `positions`. Las queries de analytics y posiciones deben considerar este valor como modo independiente (no mezclarlo con LIVE ni SANDBOX).
- El endpoint `GET /trading/balance` es distinto del `GET /trading/wallet`: el primero consulta Binance en tiempo real para LIVE/TESTNET; el segundo devuelve el sandbox wallet virtual de la DB. Ambos coexisten.
- Task 3 (migración) requiere la DB corriendo localmente con Docker Compose.
- Orden de dependencias: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 son secuenciales (backend core); 9 y 10 y 11 pueden hacerse en paralelo con 8; 12–17 dependen de que 4 esté lista (tipos Prisma generados) y pueden ejecutarse en paralelo entre sí.
