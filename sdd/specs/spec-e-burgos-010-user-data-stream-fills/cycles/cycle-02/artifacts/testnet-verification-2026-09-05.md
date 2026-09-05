# TASK-026 — Verificación contra Binance TESTNET (2026-09-05)

> Evidencia de la corrida real contra el exchange. **Resultado: la mitad sin credencial CORRE Y
> PASA; la mitad autenticada queda BLOQUEADA por una clave que el dev todavía no creó.**
> Es lo contrario del bloqueo de cycle-01: allá el endpoint estaba muerto, acá el transporte
> responde y lo único que falta es material del dueño de la cuenta.

## 0. Sonda previa del orquestador (sin credenciales, antes de diseñar nada)

Antes de que el arquitecto escribiera una línea, se abrió el socket a mano desde node (`ws@8.20.0`)
contra `wss://ws-api.testnet.binance.vision/ws-api/v3`:

| Request                                                            | Respuesta                                                                                             |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `{"id":"probe-ping","method":"ping","params":{}}`                  | `status 200`, `result {}`, `rateLimits REQUEST_WEIGHT limit 6000 count 3`                             |
| `{"id":"probe-time","method":"time","params":{}}`                  | `status 200`, `result.serverTime = 1788574991966`                                                     |
| `{"id":"probe-subscribe","method":"userDataStream.subscribe",…}`   | `status 400`, `code -1193`, _"WebSocket session not authenticated. Recommendation: use session.logon"_ |
| `{"id":"probe-logon-noparams","method":"session.logon","params":{}}` | `status 400`, `code -1102`, _"Mandatory parameter 'apiKey' was not sent, was empty/null, or malformed"_ |

Los dos métodos que el ciclo necesita **existen** y fallan por falta de autenticación o de
parámetro, no por endpoint retirado. Contraste frontal con el `410 Gone` de nginx que mató al
`listenKey` en cycle-01. Registrado también en `brief.yaml → transport_probe` y en DEC-001 de la spec.

## 1. Corrida del harness

```bash
set -a && source .env && set +a && BINANCE_TESTNET_E2E=1 pnpm nx test data-fetcher --skip-nx-cache
```

```
✓ data-fetcher src/lib/binance/binance-ws-api.testnet.spec.ts (4 tests | 1 skipped) 2658ms
   ✓ answers ping with status 200 328ms
   ✓ answers time with status 200 and a serverTime 327ms
   ✓ rejects an unauthenticated userDataStream.subscribe with -1193 390ms

Test Files  10 passed (10)
     Tests  200 passed | 1 skipped (201)
```

Las dos guardas de aborto pasaron antes del primer frame: el cliente se construye con
`{ testnet: true }` y el harness falla si `getBaseUrl()` no es `BINANCE_WS_API_TESTNET_URL`.
**No se tocó LIVE en ningún momento**: ni URL, ni clave, ni orden.

### Qué se ejercitó de verdad contra el exchange

- `ping` → `status 200`.
- `time` → `status 200` con `serverTime` numérico (el insumo de la corrección de reloj de la firma).
- `userDataStream.subscribe` sin sesión → rechazado con `BinanceWsApiError { status: 400, code: -1193 }`,
  idéntico a la sonda del orquestador.

Eso confirma contra el exchange real, y no contra un doble: el socket abre, la envoltura de
respuesta es `{ id, status, result | error, rateLimits }`, y `userDataStream.subscribe` sigue vivo
detrás de la autenticación de sesión.

## 2. Lo que quedó BLOQUEADO, y por qué

El bloque autenticado del harness —`session.logon`, `userDataStream.subscribe` con sesión, un
`executionReport` real de un fill IOC, la renovación de sesión a mitad de camino y la reconexión—
queda `skipped`. El título del bloque lo dice en la propia salida de la corrida:

> _Blocked by absence of the Ed25519 TESTNET credential, not by a transport defect. Set
> `BINANCE_API_TESTNET_ED25519_KEY` and one of `BINANCE_API_TESTNET_ED25519_PRIVATE_KEY` /
> `BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH` in `.env` (architect.md §1.2) to unblock this half
> of the harness._

**No se inventó evidencia y no se simuló nada.** Esa mitad no corrió porque no puede correr todavía.

## 3. Lo que tiene que hacer el dev para desbloquearla

Instructivo completo en `architect.md` §1.2. En corto:

1. Generar el par de claves **localmente** (la privada nunca sale de la máquina):

   ```bash
   mkdir -p ~/.binance-keys && chmod 700 ~/.binance-keys
   openssl genpkey -algorithm ed25519 -out ~/.binance-keys/testnet-ed25519-private.pem
   chmod 600 ~/.binance-keys/testnet-ed25519-private.pem
   openssl pkey -in ~/.binance-keys/testnet-ed25519-private.pem -pubout \
     -out ~/.binance-keys/testnet-ed25519-public.pem
   ```

2. En <https://testnet.binance.vision/>, con la misma cuenta de `BINANCE_API_TESTNET_KEY`, crear una
   API key de tipo **Ed25519** (no HMAC) y pegar el contenido completo del `.pem` **público**,
   incluidas las líneas `-----BEGIN/END PUBLIC KEY-----`.

3. Cargar en `.env`:

   ```dotenv
   BINANCE_API_TESTNET_ED25519_KEY=<la API Key que devuelve Binance>
   BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH=/Users/<usuario>/.binance-keys/testnet-ed25519-private.pem
   ```

   `_PRIVATE_KEY_PATH` tiene precedencia sobre `_PRIVATE_KEY` (PEM en línea). El passphrase solo hace
   falta si el PEM está cifrado, y el paso 1 lo genera sin cifrar.

4. Volver a correr el comando de §1. La mitad autenticada deja de skipearse y coloca fills IOC reales
   etiquetados `ent-e2e-uds-*`, que el `afterAll` barre.

**La clave Ed25519 es distinta de la HMAC.** `BINANCE_API_TESTNET_KEY`/`SECRET` siguen siendo las que
firman el REST y las que el harness usa para colocar las órdenes; la Ed25519 existe solo porque
`session.logon` de la WebSocket API no acepta HMAC.

## 4. Estado del criterio

`HU-07 CA-2/CA-3` queda **parcialmente cumplido**: la mitad prohibitiva (nunca LIVE, aborto si la URL
no es de testnet) se cumple y está verificada; la mitad afirmativa (un `executionReport` real de
punta a punta) no se pudo obtener y **no está simulada**. El desbloqueo no depende del código: depende
de que el dueño de la cuenta cree la clave.
