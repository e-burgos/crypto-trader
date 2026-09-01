# Corrida integrada contra Binance TESTNET — 2026-09-01

Spec gateado `apps/api/src/trading/entry-order.integration.testnet.spec.ts`, ejecutado con **Prisma real**
sobre la base local (migraciones de cycle-02 aplicadas), `LiveOrderExecutor` real contra
`https://testnet.binance.vision` y los servicios reales de `apps/api` construidos a mano
(`EntryOrderService`, `ReconciliationService`, `ActionGateService` con la coordinación apagada,
`NotificationsService`, `PositionActionService`). Sólo el gateway WS y `evaluateDailyLoss` son stubs.

```bash
BINANCE_TESTNET_E2E=1 npx jest --config apps/api/jest.testnet.config.js
```

Resultado: **4/4 en 19,9 s**. La corrida por defecto (`pnpm nx test api`) ignora `*.testnet.spec.ts`
por `testPathIgnorePatterns`, además del gate por variable de entorno.

| Escenario | Qué prueba de punta a punta |
| --- | --- |
| S1 `LIMIT_MAKER` | `placeResting` coloca en testnet y persiste `RESTING` **después** de la confirmación; la orden aparece en `openOrders` con prefijo `ent-`; `reconcile` la deja `RESTING` (0 settled / 0 expired / 0 huérfanas); `countResting` = 1; la cancelación por stop del bot pasa por `authorizeAndRun` con `kind: ENTRY_CANCEL` → `EXECUTED`, fila `CANCELLED`/`BOT_STOPPED` con `settledAt`, orden fuera del exchange, evento `entry-order:cancelled` |
| S2 `OCO` + `aboveTrailingDelta` | Dos piernas en testnet con `clientOrderId` `-l`/`-s`; `getEntryOrderStatus` sobre lista + piernas ⇒ `RESTING`; la primera reconciliación no vence; con `expiresAt` en el pasado la segunda reconciliación **cancela en el exchange antes** de marcar `EXPIRED`/`TTL_EXPIRED`; evento `entry-order:expired` |
| S3 cancelación ajena | Orden cancelada directamente en el exchange (el trader desde la app de Binance) ⇒ la reconciliación la deja `CANCELLED`/`VANISHED_ON_EXCHANGE`, la fila no se borra, `countResting` = 0 |
| S4 huérfana | Una orden `ent-*` colocada sin fila `RESTING` ⇒ `entryOrphansCancelled` = 1 y desaparece de `openOrders` |

`afterAll` afirma cero órdenes propias abiertas y borra el usuario de prueba (cascade sobre config,
entradas y notificaciones). Estado final del exchange y de la base: limpio.
