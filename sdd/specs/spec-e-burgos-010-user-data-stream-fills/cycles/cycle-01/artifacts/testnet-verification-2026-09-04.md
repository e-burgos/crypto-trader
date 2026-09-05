# TASK-013 — Corrida de verificación TESTNET (2026-09-04)

> Evidencia de la corrida real exigida por HU-07 CA-2/CA-3. **Resultado: BLOQUEADA por el exchange.**

## Comando

```bash
set -a && source .env && set +a && BINANCE_TESTNET_E2E=1 pnpm nx test data-fetcher --skip-nx-cache
```

## Resultado

```
FAIL  src/lib/binance/binance-user-data-stream.testnet.spec.ts
AxiosError: Request failed with status code 410
  ❯ BinanceRestClient.createListenKey src/lib/binance/binance-rest.client.ts:1219:22
Test Files  1 failed | 7 passed (8)
```

Las dos guardas de aborto pasaron antes de la primera llamada (`getBaseUrl()` REST =
`https://testnet.binance.vision`, WS = `wss://stream.testnet.binance.vision`) y `getTickerPrice`
respondió normal: **la credencial y la conectividad a TESTNET están sanas**. Lo que falla es el
endpoint.

## Verificación independiente del orquestador (sin credenciales)

```
POST https://testnet.binance.vision/api/v3/userDataStream   -> HTTP 410  (nginx "410 Gone", no JSON de Binance)
GET  https://testnet.binance.vision/api/v3/ping             -> HTTP 200
POST https://api.binance.com/api/v3/userDataStream          -> HTTP 410  (nginx "410 Gone")
```

El `410` lo devuelve nginx, no la capa de aplicación de Binance: el endpoint está retirado a nivel
de infraestructura, en TESTNET **y** en producción. No es un problema de firma, de key ni de IP —
una respuesta de autenticación habría sido `401`/`-2015` en JSON.

## Consecuencia para el ciclo

D-03 (`POST/PUT/DELETE /api/v3/userDataStream`) y D-04 (socket single-stream `/ws/<listenKey>`) se
apoyan enteramente en el ciclo de vida REST del `listenKey`. Sin `createListenKey` no hay key, y sin
key no hay socket: **el mecanismo de detección completo del ciclo no puede funcionar contra la
Binance de hoy**, aunque el código esté implementado y verificado unitariamente contra el contrato
del architect.

El interruptor se entrega apagado, así que el comportamiento observable en producción no cambia y no
hay regresión. Lo que no se cumple es el objetivo del ciclo.

## Peso del endpoint

No medible: `x-mbx-used-weight-1m` del `PUT` requiere un `listenKey` vivo. La entrada conservadora de
peso 2 en `ENDPOINT_WEIGHTS` queda sin medir (pregunta abierta 3 del architect, §14).

## Nota lateral

El barrido de `afterAll` encontró una orden `ent-e2e-*` remanente (`orderId 12349707`) previa a esta
corrida, dejada por el harness hermano `binance-rest.client.testnet.spec.ts`. No la generó esta
corrida — la corrida abortó antes de colocar ninguna orden.
