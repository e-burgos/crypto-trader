# Architect — Cycle 2: Migración del transporte del user data stream a la WebSocket API

> **Input:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-02/brief.yaml + functional.md
> **Input principal:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-01/architect.md
> **Output:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-02/architect.md
> **Generado por:** sdd-architect (claude/opus, effort high)

---

## 0. Resumen ejecutivo — el ciclo en una frase

Se reemplaza el **riel** por el que llega el `executionReport` —`listenKey` REST (410 Gone) + socket
`/ws/<listenKey>`— por la **WebSocket API de Binance**: un socket único
`wss://ws-api(.testnet)…/ws-api/v3` sobre el que se autentica la sesión con `session.logon` firmado
con **Ed25519** y se suscribe con `userDataStream.subscribe`. **Todo lo demás de cycle-01 se
conserva**: el lease por `(userId, env)`, la correlación con `entry_orders`, `toEntryFillStatus`, el
dedupe, el modelo de salud, el interruptor apagado y el composition root. Además, el ciclo cierra los
ocho defectos que el reviewer de cycle-01 dejó anotados y uno más que aparece al leer el código con
la credencial Ed25519 en la mano (§4.5).

**El hecho medido que habilita el diseño** (sonda del orquestador, 2026-09-04, sin credenciales,
contra `wss://ws-api.testnet.binance.vision/ws-api/v3`):

| Request | Respuesta |
| --- | --- |
| `{"id":"probe-ping","method":"ping","params":{}}` | `status 200`, `result {}`, `rateLimits REQUEST_WEIGHT limit 6000` |
| `{"id":"probe-time","method":"time","params":{}}` | `status 200`, `result.serverTime = 1788574991966` |
| `{"id":"probe-subscribe","method":"userDataStream.subscribe","params":{}}` | `status 400`, `code -1193`, *"WebSocket session not authenticated…"* |
| `{"id":"probe-logon-noparams","method":"session.logon","params":{}}` | `status 400`, `code -1102`, *"Mandatory parameter 'apiKey' …"* |

De ahí salen **tres hechos duros** sobre los que se construye todo:

1. La envoltura de respuesta es `{ id, status, result | error, rateLimits }` — el diseño de
   correlación request/response se apoya en esto y no en documentación.
2. Los dos métodos que el ciclo necesita **existen** y fallan por falta de autenticación / de
   parámetro, no por endpoint retirado. Contraste frontal con el `410 Gone` de nginx que mató al
   `listenKey`.
3. `ping` y `time` responden **sin credenciales** — son la base del heartbeat aplicativo y de la
   corrección de reloj (D-11), y se pueden ejercitar en el harness aunque la clave todavía no exista.

**Lo que NO se pudo medir, y por lo tanto no se supone**: la forma exacta del `result` de
`session.logon`, la envoltura exacta del evento empujado, y si la autorización de sesión vence sola.
Cada uno de esos tres tiene una decisión explícita que **acepta las dos formas plausibles** o fija un
invariante conservador propio: D-13 (logon), D-14 (envoltura), D-12 (vencimiento). Ninguno bloquea el
ciclo y los tres están marcados como no medidos en §13.

---

## 1. LA CREDENCIAL Ed25519 — variables de entorno, literales

> **Esta sección es el instructivo que sigue el dev.** La clave Ed25519 **no existe todavía**: hay
> que crearla en la cuenta de Binance TESTNET y cargarla en `.env` antes de que la task de
> verificación pueda correr. **El diseño no asume que existe** (§1.4).

### 1.1 Variables — nombres exactos, tal como van en `.env`

Convención respetada: el prefijo `BINANCE_API_` con el infijo `TESTNET` para el ambiente de pruebas,
igual que las cuatro variables HMAC que ya viven en `.env`
(`BINANCE_API_TESTNET_KEY` / `BINANCE_API_TESTNET_SECRET` / `BINANCE_API_KEY` /
`BINANCE_API_SECRET`). Se suma el infijo `ED25519` porque son una **credencial distinta** de la
HMAC, no un reemplazo: las dos conviven y se usan para cosas distintas (§1.5).

```dotenv
# ── Binance TESTNET — credencial Ed25519 para el user data stream (WebSocket API) ──
BINANCE_API_TESTNET_ED25519_KEY=
BINANCE_API_TESTNET_ED25519_PRIVATE_KEY=
BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH=
BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PASSPHRASE=

# ── Binance LIVE — mismas variables, ambiente real. ESTE CICLO NO LAS USA ──
BINANCE_API_ED25519_KEY=
BINANCE_API_ED25519_PRIVATE_KEY=
BINANCE_API_ED25519_PRIVATE_KEY_PATH=
BINANCE_API_ED25519_PRIVATE_KEY_PASSPHRASE=

# ── Alcance opcional de la credencial por usuario (§1.6 / D-12) ──
USER_DATA_STREAM_ED25519_USER_IDS=

# ── Interruptor de la capacidad (ya existe; se entrega apagado) ──
USER_DATA_STREAM_FILLS_ENABLED=

# ── Habilitador del harness TESTNET (ya existe) ──
BINANCE_TESTNET_E2E=
```

| Variable | Qué valor lleva | Obligatoria |
| --- | --- | --- |
| `BINANCE_API_TESTNET_ED25519_KEY` | La **API Key** (el identificador público, no secreto en el sentido de firma pero igual sensible) que Binance devuelve al crear la clave Ed25519 en TESTNET. Es la que viaja como `params.apiKey` de `session.logon`. **No** es `BINANCE_API_TESTNET_KEY`: son dos claves distintas de la misma cuenta. | Sí, para abrir stream en testnet |
| `BINANCE_API_TESTNET_ED25519_PRIVATE_KEY` | La **clave privada Ed25519 en PEM**, en línea. Ver §1.3 para el escapado. | Una de las dos (`_PRIVATE_KEY` o `_PRIVATE_KEY_PATH`) |
| `BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH` | **Ruta** a un archivo PEM en disco (absoluta, o relativa al cwd del proceso). Es la forma recomendada. | Una de las dos |
| `BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PASSPHRASE` | Passphrase, **solo** si el PEM está cifrado. El instructivo de §1.2 genera una clave sin cifrar, así que normalmente queda vacía. | No |
| `BINANCE_API_ED25519_*` | Idénticas, para LIVE. **Este ciclo no las lee jamás** salvo que alguien ponga un bot en modo LIVE con el interruptor encendido: el diseño las soporta por simetría, la restricción de no tocar LIVE se sostiene por no crear la clave. | No |
| `USER_DATA_STREAM_ED25519_USER_IDS` | Lista de `userId` separados por coma. Ausente ⇒ la credencial de entorno aplica a **todos** los usuarios de ese ambiente (§1.6). | No |

**Se admiten las dos formas de la clave privada: ruta a un PEM y PEM en línea.** `_PATH` tiene
precedencia sobre `_PRIVATE_KEY` si las dos están cargadas — así el dev puede dejar el inline como
respaldo comentado sin que se pisen en silencio.

### 1.2 Paso a paso en Binance TESTNET (lo que hace el dev)

1. **Generar el par de claves localmente.** Binance **no** genera la privada por vos para Ed25519:
   la privada nunca sale de tu máquina.

   ```bash
   mkdir -p ~/.binance-keys && chmod 700 ~/.binance-keys
   openssl genpkey -algorithm ed25519 -out ~/.binance-keys/testnet-ed25519-private.pem
   chmod 600 ~/.binance-keys/testnet-ed25519-private.pem
   openssl pkey -in ~/.binance-keys/testnet-ed25519-private.pem -pubout \
     -out ~/.binance-keys/testnet-ed25519-public.pem
   cat ~/.binance-keys/testnet-ed25519-public.pem
   ```

   El privado empieza con `-----BEGIN PRIVATE KEY-----`; el público con
   `-----BEGIN PUBLIC KEY-----`. **La privada no se sube a ningún lado, ni al repo, ni a Binance.**

2. **Registrar la clave pública en TESTNET.** Entrar a <https://testnet.binance.vision/> con la
   misma cuenta con la que se generaron `BINANCE_API_TESTNET_KEY`/`SECRET`, ir a la generación de
   API keys y elegir el tipo **Ed25519** (no HMAC). Pegar el contenido **completo** del archivo
   `testnet-ed25519-public.pem`, incluidas las líneas `-----BEGIN/END PUBLIC KEY-----`.

3. **Guardar lo que devuelve Binance.** Devuelve una **API Key** (cadena larga). Esa cadena va a
   `BINANCE_API_TESTNET_ED25519_KEY`. No devuelve ningún "secret": en Ed25519 el secreto es la
   privada que quedó en tu disco.

4. **Cargar el `.env` del repo.**

   ```dotenv
   BINANCE_API_TESTNET_ED25519_KEY=<la API Key que devolvió testnet.binance.vision>
   BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH=/Users/<vos>/.binance-keys/testnet-ed25519-private.pem
   ```

   Con `_PATH` cargada, `_PRIVATE_KEY` se deja vacía. **`.env` ya está gitignoreado**; el PEM vive
   fuera del repo por diseño.

5. **Verificar antes de correr el harness** (no toca Binance, solo prueba que la clave se lee y firma):

   ```bash
   node -e "const c=require('node:crypto'),fs=require('node:fs');
   const k=c.createPrivateKey({key:fs.readFileSync(process.argv[1])});
   console.log('type:',k.asymmetricKeyType);
   console.log('sig len:',c.sign(null,Buffer.from('apiKey=x&timestamp=1'),k).toString('base64').length);" \
   ~/.binance-keys/testnet-ed25519-private.pem
   ```

   Tiene que imprimir `type: ed25519` y `sig len: 88`. Si imprime otro `asymmetricKeyType`, la clave
   no es Ed25519 y `session.logon` va a fallar con `-1022`.

6. **Recién ahí** correr la task de verificación (§11.4).

### 1.3 PEM multilínea dentro de un `.env` — la trampa concreta

Un PEM son varias líneas. Este repo carga variables de dos maneras distintas y **no se comportan
igual**:

- `dotenv` (el harness de `libs/data-fetcher` lo usa): expande `\n` dentro de valores entre comillas
  dobles y acepta valores multilínea entre comillas dobles.
- `set -a && source .env && set +a` (el flujo documentado en la constitución de `data-fetcher`): es
  **bash**, así que acepta multilínea entre comillas dobles pero **no** expande `\n` — lo deja como
  los dos caracteres `\` y `n`.

**Regla de diseño que elimina la divergencia:** el normalizador de PEM del resolver (D-12) acepta las
tres formas y las convierte a un PEM válido antes de `createPrivateKey`:

1. saltos de línea reales,
2. la secuencia literal `\n` de dos caracteres (se reemplaza por salto de línea),
3. la mezcla de las dos.

Con eso, las tres escrituras siguientes funcionan con los dos cargadores:

```dotenv
# (a) RECOMENDADA — ruta al archivo. Nada que escapar, nada que romper.
BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH=/Users/vos/.binance-keys/testnet-ed25519-private.pem

# (b) Inline con \n escapado, en UNA línea, entre comillas dobles.
BINANCE_API_TESTNET_ED25519_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEI...\n-----END PRIVATE KEY-----\n"

# (c) Inline multilínea entre comillas dobles.
BINANCE_API_TESTNET_ED25519_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEI...
-----END PRIVATE KEY-----"
```

Comando para producir la forma (b) sin errores de tipeo:

```bash
awk 'BEGIN{printf "BINANCE_API_TESTNET_ED25519_PRIVATE_KEY=\""} {printf "%s\\n",$0} END{print "\""}' \
  ~/.binance-keys/testnet-ed25519-private.pem
```

**Prohibido**: PEM inline sin comillas (bash corta en el primer espacio y dotenv corta en el primer
salto), y PEM con comillas simples en la forma (b) (dotenv no expande `\n` entre comillas simples).

### 1.4 Qué pasa cuando cada variable falta — el contrato de HU-08

| Situación | Comportamiento exigido |
| --- | --- |
| `USER_DATA_STREAM_FILLS_ENABLED` ausente o ≠ `'true'` | `UserDataStreamService` **no se instancia** (D-08). No se lee ninguna variable Ed25519, no se abre socket, no se emite `session.logon`. Idéntico a cycle-01. |
| Interruptor encendido y `*_ED25519_KEY` ausente | El resolver devuelve `ABSENT`. **No se toma el lease**, no se abre socket. Se loguea **una sola vez por `credentialKey`**, a nivel `warn`, con recooldown de `userStreamMissingCredentialLogIntervalMs` (1 h). El detector sigue siendo la sonda por tick. Arranque normal, ninguna excepción. |
| Interruptor encendido, `*_ED25519_KEY` presente y las dos formas de la privada ausentes | Idéntico a la fila anterior: `ABSENT`. |
| `_PATH` cargada pero el archivo no existe o no se puede leer | `INVALID` con razón `UNREADABLE_KEY_FILE`. Mismo tratamiento que una autenticación rechazada: un `warn` por credencial con cooldown de `userStreamAuthRejectedCooldownMs` (1 h), sin lease, sin socket, sin excepción (HU-08 CE-1). |
| PEM corrupto, o clave que no es Ed25519 | `INVALID` con razón `MALFORMED_PEM` / `NOT_ED25519`. Mismo tratamiento. |
| Una credencial tiene su Ed25519 y otra no | La que la tiene **abre su sesión con normalidad**. La ausencia es **por credencial**, nunca un apagado global (HU-08 CA-4, RN-11). |

**Invariante duro y verificable:** con el interruptor encendido y **cero** variables Ed25519
cargadas, la API arranca, ningún módulo se bloquea, y en un minuto de reloj falso no hay más de un
log por credencial. **Nada de "un error por segundo".**

### 1.5 Las dos credenciales conviven — cuál se usa para qué

Este es el punto que más confusión puede generar en implementación:

| Credencial | De dónde sale | Para qué se usa en este ciclo |
| --- | --- | --- |
| HMAC (`apiKey` + `apiSecret`) del usuario | **De la base**, tabla `binance_credentials`, cifrada, vía `decrypt` | **Solo** para construir el `LiveOrderExecutor` que `settleFill` necesita para `placeInitialProtection`. Sin cambios respecto de cycle-01 y de `EntryFillWatchService`. |
| Ed25519 (`apiKey` + clave privada PEM) | **Del entorno**, variables de §1.1 | **Solo** para firmar `session.logon` y abrir la sesión de la WebSocket API. Nunca toca Prisma, nunca se persiste, nunca se cifra en base. |

Persistir la Ed25519 por usuario, con su UI y su cifrado, es **ciclo aparte** (fuera de alcance por
brief). El puerto de D-12 existe precisamente para que ese ciclo futuro cambie una implementación y
no el servicio.

### 1.6 Alcance de la credencial de entorno

La credencial Ed25519 de entorno pertenece al **dueño de la cuenta de TESTNET** (el dev), no a un
usuario de la plataforma. Regla de matcheo del resolver por entorno, en orden:

1. Se elige el par de variables por `env` (`testnet` → `BINANCE_API_TESTNET_ED25519_*`,
   `live` → `BINANCE_API_ED25519_*`).
2. Si `USER_DATA_STREAM_ED25519_USER_IDS` está cargada y el `userId` **no** está en la lista ⇒
   `ABSENT` (esa credencial no abre stream, la sonda cubre).
3. Si no está cargada ⇒ la credencial aplica a **todos** los usuarios de ese ambiente.

**Por qué el default (3) es seguro y no un atajo:** un `executionReport` que llega por una sesión
autenticada contra una cuenta de Binance que no es la del usuario **no puede** producir un settle
equivocado, porque D-05 exige ahora que la fila `entry_orders` correlacionada sea **del mismo
`userId`** que el dueño de la sesión (§4.5). El peor caso posible es un stream que nunca correlaciona
nada — indistinguible, en efecto observable, de no tener stream. En un despliegue con varios traders
reales en testnet, la lista de (2) es el control fino.

---

## 2. Las cuatro preguntas abiertas del brief — resueltas

| # | Pregunta | Resolución | Dónde se desarrolla |
| --- | --- | --- | --- |
| 1 | Envoltura del evento empujado tras `userDataStream.subscribe` | **Se aceptan las dos formas**: `{ event: { e: 'executionReport', … } }` y el payload desnudo `{ e: 'executionReport', … }`. Un único extractor decide por estructura, no por configuración, y su tabla de tests cubre las dos formas más el ruido. | **D-14** + §11 (T-14) |
| 2 | Vencimiento de la sesión / invariante temporal equivalente | La WebSocket API no tiene el keepalive de 60 min del `listenKey`. Se fija un **techo autoimpuesto** `userStreamSessionMaxAgeMs` (1 h, conservador contra el límite documentado de conexión de 24 h) y un **relogon periódico** con el invariante `relogonIntervalMs + relogonGraceMs < sessionMaxAgeMs`, homólogo exacto del de cycle-01. **Re-logon + re-subscribe obligatorios después de CADA reconexión**, sin excepción (RN-10). | **D-12**, **D-13**, §5 |
| 3 | Ámbito de la credencial Ed25519 vs. el lease por `(userId, env)` | El **lease no cambia**: sigue siendo por `(userId, env)` sobre `ReactiveCoordinationPort`, con las mismas claves `rx:v1:uds:*`. La credencial Ed25519 se resuelve por un **puerto nuevo** `UserStreamAuthCredentialPort` con una implementación por entorno; devuelve un resultado de **tres estados** (`RESOLVED` / `ABSENT` / `INVALID`) y el servicio **no toma el lease** cuando no es `RESOLVED`. La correlación se endurece con guarda de `userId`. | **D-12**, §1.5, §1.6, §4.5 |
| 4 | Qué se borra de cycle-01 y qué se conserva, archivo por archivo | Tabla completa. | **§9** |

---

## 3. Decisiones heredadas de cycle-01 — vigentes, con su ajuste

### D-01 — Lease por credencial `(userId, env)` — **SIN CAMBIOS**

Unidad de exclusión `(userId, env)`, `env ∈ {'live','testnet'}` derivado de
`config.mode === TradingMode.TESTNET`. Claves intactas:

| Clave | Contenido | TTL |
| --- | --- | --- |
| `rx:v1:uds:owner:{userId}:{env}` | `instanceId` del dueño (lease CAS) | `userStreamOwnerLeaseTtlMs` |
| `rx:v1:uds:health:{userId}:{env}` | `UserDataStreamHealthRecord` (sin secretos) | `userStreamHealthTtlMs` |

Primitivas `tryAcquire`/`renew`/`release`, sweep cada `userStreamSweepIntervalMs`, Redis caído ⇒
nunca dueño ⇒ ningún socket ⇒ cobertura enteramente en la sonda (D-07). Todo eso sigue igual y el
ciclo lo protege de regresión.

**Un peligro de cycle-01 desaparece con el transporte nuevo, y conviene decirlo.** Con `listenKey`, un
`DELETE` emitido sin lease **mataba el stream del nuevo dueño**: era la falla más cara del ciclo. En
la WebSocket API la sesión es **por conexión**: `session.logout` y el cierre del socket solo afectan a
la conexión propia. La regla "no emitir `DELETE` sin lease" pierde su razón de ser, y en su lugar
queda la regla trivial "al perder el lease, desconectá tu propio socket". El lease sigue siendo
obligatorio por RN-06 (una sola escucha por dueño y ambiente) y para no multiplicar conexiones contra
el límite de conexiones por IP del exchange — no por riesgo de sabotaje cruzado.

### D-02 — El material sensible vive **solo en la memoria de la réplica dueña** — **REENCUADRADA**

El sujeto de la regla cambia: ya no es el `listenKey`, son **tres piezas** — la clave privada
Ed25519, la firma que se computa con ella, y la `apiKey` que la acompaña. La regla y su
justificación no cambian: **nada de eso va a Postgres ni a Redis**, ni siquiera con TTL, porque
Redis en este despliegue corre con AOF y `noeviction` (constitución de `apps/api` §3.5) y un `SET`
con TTL deja el valor en el append-only file hasta la próxima reescritura.

Lo que **sí** va a Redis sigue siendo `instanceId` (no es secreto) y `UserDataStreamHealthRecord`,
con lista de campos congelada por typecheck y **cero campos derivados** de la clave, la firma o la
apiKey (§6).

Detalle nuevo y estructural: la clave privada **no se guarda como string**. Se convierte a un
`crypto.KeyObject` en el resolver y solo el `KeyObject` viaja (D-11). `JSON.stringify(keyObject)`
devuelve `{}` y `util.inspect` muestra `KeyObject { type: 'private', asymmetricKeyType: 'ed25519' }`:
el material no es serializable ni por accidente. Eso convierte a HU-06 en una propiedad de
construcción, no de disciplina.

### D-05 — Correlación `executionReport` → fila `entry_orders` RESTING — **ENDURECIDA**

Se conserva íntegra la lógica de cycle-01 (clave primaria
`normalizeEntryClientOrderId(report.clientOrderId)` contra `entry_orders.clientOrderId` por
`findUnique`; respaldo por `orderId` / `limitLegOrderId` / `stopLegOrderId` / `orderListId` sobre el
índice `[userId, status]`; guardas `side === 'BUY'`, símbolo igual y `status === 'RESTING'`;
descarte silencioso a nivel `debug` con contador cuando no correlaciona).

**Se agrega una guarda: `row.userId === state.userId`.** Ver §4.5 — es un defecto propio de cycle-01
que el cambio de transporte vuelve materialmente más probable.

### D-06 — Qué dispara un settle y con qué payload — **SIN CAMBIOS**

`toEntryFillStatus(report)` en `apps/api/src/reactive/execution-report-fill.ts` no se toca ni una
línea: mismo predicado (`side === 'BUY' && orderStatus === 'FILLED' && cumulativeFilledQuantity > 0`),
misma paridad campo por campo con `BinanceRestClient.toEntryOrderStatus`, mismo `partial: false`
siempre, misma decisión de **no liquidar parciales**. El evento que lo alimenta es el mismo
`ExecutionReportEvent`; lo único que cambió es el caño por el que entró.

### D-07 — La sonda por tick y la reconciliación **no se gatean** — **SIN CAMBIOS**

Siguen corriendo sin condición, incluso con el stream sano. No existe ninguna variable que apague la
sonda. Fail-open sobre fail-closed: un falso `HEALTHY` no puede apagar los dos detectores a la vez.
Este ciclo **agrega el test de comportamiento** que cycle-01 dejó pendiente (issue-5, §11 T-05b).

### D-08 — Interruptor a nivel plataforma — **REVISITADA, contrato estricto**

`USER_DATA_STREAM_FILLS_ENABLED === 'true'`, **y nada más**. Se elimina la aceptación de `'1'`
(issue-7): el código y el contrato dicen lo mismo, con el precedente literal de `SignalCacheService`.
Se entrega apagado. Se lee **exactamente una vez, en el composition root**; apagado ⇒ el servicio no
se instancia ⇒ sin `onModuleInit`, sin timers, sin `tryAcquire`, sin socket y **sin leer una sola
variable Ed25519** (HU-03 CA-1, §1.4 fila 1).

```ts
export function isUserDataStreamFillsEnabled(): boolean {
  return process.env.USER_DATA_STREAM_FILLS_ENABLED === 'true';
}
```

Sigue sin columna en `TradingConfig`, sin migración, sin cambio en `trading-config-wire.ts` ni en la
SPA.

---

## 4. Decisiones nuevas de cycle-02

### D-09 — Se retira el ciclo de vida REST del `listenKey` (reemplaza a D-03)

`BinanceRestClient` pierde, **borradas**, `createListenKey`, `keepAliveListenKey`, `closeListenKey`,
el privado `keyedRequest` y las tres entradas de `ENDPOINT_WEIGHTS` para `/api/v3/userDataStream`.
Motivo: el endpoint devuelve `410 Gone` a nivel de infraestructura en TESTNET y en producción
(evidencia en `cycle-01/artifacts/testnet-verification-2026-09-04.md`) y el transporte nuevo no
necesita **ninguna** llamada REST para abrir, mantener ni cerrar la sesión.

Consecuencias que el implementador no puede saltear:

- `keyedRequest` no tiene otro usuario: se borra completo. `signedRequest` **no se toca**.
- El puerto `UserStreamRestClient` y el símbolo `USER_STREAM_REST_FACTORY` de `apps/api` se borran
  (§9). El servicio deja de tener un cliente REST propio.
- `BinanceRestClient` **sigue existiendo y sigue siendo central**: el `LiveOrderExecutor` que
  `settleFill` necesita lo construye igual que hoy, con la credencial HMAC de la base (§1.5).
- Ninguna llamada REST del ciclo ⇒ **desaparece la vía de fuga #1 de cycle-01** (el `listenKey` en
  `error.config.url` de axios). La nueva superficie de fuga es distinta y está tratada en §6.

### D-10 — Cliente de transporte nuevo: `BinanceWsApiClient` (reemplaza a D-04)

**Archivo:** `libs/data-fetcher/src/lib/binance/binance-ws-api.client.ts`, exportado por el barrel.
El cliente single-stream de cycle-01 se **borra** (§9): su URL, su envoltura y su modelo de
`listenKey` no tienen nada en común con el transporte nuevo, y ensancharlo con condicionales
produciría una clase que es dos protocolos a la vez.

`BinanceWsClient` (el riel de mercado) **tampoco se extiende ni se toca**, salvo el listener de
`'error'` en su consumidor (D-18).

```ts
export const BINANCE_WS_API_URL = 'wss://ws-api.binance.com/ws-api/v3';
export const BINANCE_WS_API_TESTNET_URL = 'wss://ws-api.testnet.binance.vision/ws-api/v3';

export interface BinanceWsApiConfig {
  testnet?: boolean;                       // elige la base URL; NUNCA se hardcodea en el call site
  baseUrl?: string;                        // override explícito — SOLO tests
  autoReconnect?: boolean;                 // default true
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  reconnectAttemptsBeforeExhaustion?: number;
  wsPingIntervalMs?: number;
  wsPongTimeoutMs?: number;
  requestTimeoutMs?: number;
  connectTimeoutMs?: number;
}

export class BinanceWsApiClient extends EventEmitter {
  constructor(config?: BinanceWsApiConfig);

  connect(): Promise<void>;                // resuelve en el primer 'open'; rechaza por connectTimeoutMs
  disconnect(): void;
  isConnected(): boolean;
  getBaseUrl(): string;

  time(): Promise<number>;                                     // serverTime en ms
  ping(): Promise<void>;
  logon(auth: { apiKey: string; signer: Ed25519Signer }): Promise<void>;
  logout(): Promise<void>;
  subscribeUserDataStream(): Promise<void>;
  unsubscribeUserDataStream(): Promise<void>;
}
```

**Correlación request/response.** Cada request lleva `id` propio
(`${instancePrefix}-${counter++}`, prefijo aleatorio por instancia para que dos clientes en el mismo
proceso no colisionen en un doble compartido). Un `Map<string, PendingRequest>` guarda
`{ resolve, reject, timer, method }`. Al llegar un frame con `id` presente en el mapa:

- `status === 200` ⇒ `resolve(frame.result)`;
- cualquier otro `status` ⇒ `reject(new BinanceWsApiError(status, code, msg, method))`;
- `requestTimeoutMs` sin respuesta ⇒ `reject` con `code: null`, `status: null` y se borra la entrada.

Al cerrarse el socket, **todas** las pendientes se rechazan (`WS_API_DISCONNECTED`) — jamás quedan
promesas colgadas que retengan al servicio.

```ts
export class BinanceWsApiError extends Error {
  readonly status: number | null;
  readonly code: number | null;
  readonly method: string;
}
```

`BinanceWsApiError.message` se construye **solo** con `status`, `code`, `msg` y `method`: nunca con
el request que falló (§6).

**Enrutamiento de frames**, en este orden estricto:

1. `id` presente **y** con entrada en el mapa de pendientes ⇒ es respuesta: se resuelve o rechaza.
2. Si no, se pasa por el extractor de evento de usuario (D-14). Si sale un `executionReport`, se
   emite `execution-report`.
3. Cualquier otra cosa (otros tipos de evento, frames con `id` desconocido, ruido) se **ignora en
   silencio** y se cuenta en un contador en memoria. Precedente literal del `catch {}` de
   `BinanceWsClient.handleMessage`. Un mensaje que no parsea como JSON se descarta sin lanzar.

El orden importa: un push nunca trae `id`, pero un frame con `id` desconocido (respuesta tardía a un
request ya vencido) **no debe** tapar la ruta de eventos.

**Eventos emitidos** (kebab-case, precedente de cycle-01):

| Evento | Payload | Cuándo |
| --- | --- | --- |
| `connected` | `{ at: number }` | cada `open` del socket — **el primero y todos los de reconexión** |
| `disconnected` | `{ at: number; code: number \| null }` | `close` |
| `reconnecting` | `{ at: number; attempt: number; delayMs: number }` | antes de cada reintento |
| `heartbeat` | `{ at: number }` | frame `ping` o `pong` del socket |
| `execution-report` | `ExecutionReportEvent` | evento de usuario `e === 'executionReport'` |
| `session-lost` | `{ at: number; reason: 'RECONNECT_EXHAUSTED' }` | agotados los reintentos |
| `error` | `Error` | error del socket |

**`connected` se emite en TODAS las aperturas, incluida la primera.** Es la pieza que hace que RN-10
sea imposible de violar: el servicio tiene **un solo** camino de autenticación, colgado de
`connected`, y no puede existir una rama "primera conexión" que autentique distinto de una
reconexión (D-13).

**Reconexión.** Backoff exponencial con jitter ±20 %, idéntico al de cycle-01:
`delay = min(reconnectBaseDelayMs * 2^attempt, reconnectMaxDelayMs)`, contador reseteado en cada
`open`. Con `reconnectAttemptsBeforeExhaustion` agotado ⇒ `session-lost(RECONNECT_EXHAUSTED)` y el
cliente se detiene.

**Heartbeat.** `ws.ping()` cada `wsPingIntervalMs`, `ws.terminate()` si no llega `pong` en
`wsPongTimeoutMs` — el mecanismo que ya resolvió el socket medio abierto, y que acá vuelve a ser más
crítico que en el riel de mercado porque el silencio es indistinguible del funcionamiento normal
(RN-03). El servidor de la WebSocket API además manda sus propios frames `ping`; la librería `ws`
responde `pong` sola y el `on('ping')` refresca `lastHeartbeatAtMs`.

**El cliente sigue siendo transporte y nada más.** No conoce Prisma, no conoce credenciales más allá
del `Ed25519Signer` que le pasan por argumento en `logon()`, no decide reconciliación, **no
re-autentica solo** y no guarda la `apiKey` ni el signer entre `logon()`s. Renegociar es
responsabilidad de `apps/api` (D-13). Sin dependencias npm nuevas: `ws` y `node:crypto`.

### D-11 — Contrato de firma Ed25519 de `session.logon`

**Archivo:** `libs/data-fetcher/src/lib/binance/ed25519-signer.ts`. Módulo puro, sin `ws`, sin
axios, sin estado global.

```ts
export interface Ed25519Signer {
  sign(params: Record<string, string>): string;   // firma base64
}

export function buildSignaturePayload(params: Record<string, string>): string;
export function createEd25519Signer(privateKeyPem: string, passphrase?: string): Ed25519Signer;
```

**Construcción exacta del payload firmado.** Los parámetros del request **sin** `signature`, ordenados
por nombre de forma ascendente (comparación de strings), concatenados como `clave=valor` y unidos con
`&`, **sin percent-encoding**:

```
payload = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&')
```

Para `session.logon` los parámetros son exactamente dos, así que el payload es literalmente:

```
apiKey=<BINANCE_API_TESTNET_ED25519_KEY>&timestamp=<epoch ms corregido>
```

> **La ausencia de percent-encoding es la decisión, no un descuido.** La `apiKey` Ed25519 es una
> cadena base64 que puede contener `+`, `/` y `=`. Si el implementador usa `URLSearchParams` —el
> reflejo natural, porque es lo que hace `signedRequest` para REST— esos caracteres se escapan y la
> firma deja de validar. El síntoma es un `status 400` con `code -1022`
> (*"Signature for this request is not valid"*) que **parece** un problema de clave y no lo es.
> Diagnóstico de un vistazo: si el payload firmado contiene `%2B` o `%2F`, está mal construido.

**Firma:**

```ts
const key = crypto.createPrivateKey({ key: pem, format: 'pem', passphrase });
// createEd25519Signer lanza si key.asymmetricKeyType !== 'ed25519'
const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), key).toString('base64');
```

- El algoritmo es **`null`**: es la forma en que `node:crypto` firma Ed25519 (el hash es parte del
  esquema). Pasar `'sha256'` lanza.
- Salida en **base64**, 88 caracteres para una firma Ed25519 de 64 bytes.
- **`node:crypto` y nada más. Cero dependencias npm nuevas** — igual que `createHmac` en
  `signedRequest`.

**Timestamp y reloj.** El `timestamp` se calcula como `Date.now() + serverTimeOffsetMs`, donde
`serverTimeOffsetMs` sale de llamar `time()` **en cada apertura de socket, antes del logon**. Es una
llamada de peso mínimo, sin credenciales (medida en la sonda), y elimina de raíz la clase de fallo
más difícil de diagnosticar del ciclo: un reloj local desfasado produce `-1021` / `-1022`
indistinguibles de una clave mal cargada. No se envía `recvWindow`: con el offset aplicado, el
default de Binance sobra.

**Dónde vive el material y cómo no llega a un log:**

1. El PEM se lee (de archivo o de entorno) **dentro** de `EnvUserStreamAuthCredentialResolver`, en
   una constante local de una sola función. **No se guarda en ningún campo, en ninguna clase.**
2. Se convierte inmediatamente a `KeyObject` con `createPrivateKey`. A partir de ahí solo circula el
   `KeyObject`, dentro del closure de `Ed25519Signer`.
3. `Ed25519Signer` **no expone** la clave: no tiene getter, no tiene campo público y no define
   `toJSON`. `JSON.stringify(signer)` da `{}`.
4. La firma producida entra al frame de `session.logon` y **no se guarda** en ninguna estructura del
   servicio ni del cliente.
5. Ningún log del ciclo recibe `params`, ni el frame, ni el signer. El único diagnóstico permitido en
   el camino de error es `status`/`code`/`msg`/`method` de `BinanceWsApiError` (§6).
6. Para el caso en que alguien agregue un diagnóstico en el futuro, la lib exporta
   `redactWsApiRequest(frame)`, que devuelve una copia con `params.apiKey` y `params.signature`
   reemplazados por `'***'`. Es la **única** forma permitida de imprimir un frame saliente.

### D-12 — Puerto de resolución de la credencial Ed25519, y la ausencia como estado de primera clase

**Archivos:** `apps/api/src/reactive/user-stream-auth-credential.port.ts` (puerto + símbolo) y
`apps/api/src/reactive/env-user-stream-auth-credential.resolver.ts` (implementación por entorno).

```ts
export const USER_STREAM_AUTH_CREDENTIAL = Symbol('USER_STREAM_AUTH_CREDENTIAL');

export type UserStreamAuthInvalidReason =
  | 'UNREADABLE_KEY_FILE'
  | 'MALFORMED_PEM'
  | 'NOT_ED25519';

export type UserStreamAuthResolution =
  | { kind: 'RESOLVED'; apiKey: string; signer: Ed25519Signer }
  | { kind: 'ABSENT' }
  | { kind: 'INVALID'; reason: UserStreamAuthInvalidReason };

export interface UserStreamAuthCredentialPort {
  resolve(userId: string, env: CredentialEnv): Promise<UserStreamAuthResolution>;
}
```

**Tres estados y no dos, a propósito.** `ABSENT` es configuración (HU-08 CA-1..CA-4: normal, un log
espaciado, sin lease). `INVALID` es un error del operador (HU-08 CE-1: mismo tratamiento operativo
—sin lease, sin excepción, cubierto por la sonda— pero con cooldown de credencial rechazada y una
razón que nombra el problema). Fundirlos obligaría al servicio a adivinar cuál de los dos es, o a
tratar un PEM corrupto como si no existiera, que es exactamente el silencio que HU-08 CE-1 prohíbe.

**`UserStreamAuthInvalidReason` es una unión de literales, no texto libre.** Un `reason: string`
construido a partir del error de `createPrivateKey` puede arrastrar fragmentos del PEM al log. Con
una unión cerrada eso es imposible por typecheck.

**Implementación por entorno** (`EnvUserStreamAuthCredentialResolver`):

- Lee `process.env` **de forma perezosa, en la primera llamada a `resolve()`**, nunca en el
  constructor ni en el import. Con el interruptor apagado el servicio no existe ⇒ `resolve()` nunca
  se llama ⇒ **ninguna variable Ed25519 se lee** (HU-03 CA-1).
- Memoiza el `Ed25519Signer` por `env` — el `KeyObject` se construye una sola vez por proceso.
- Normalización del PEM: `_PATH` con precedencia; `\n` literales convertidos a saltos reales;
  `trim()` final. Ver §1.3.
- Regla de matcheo por usuario: §1.6.

**El servicio no toma el lease cuando la resolución no es `RESOLVED`.** Orden estricto en
`acquireActiveCredentials`, por cada credencial activa:

```
¿hay backoff vigente para esta key?  → sí: saltar EN SILENCIO
resolve(userId, env)
  ├─ ABSENT   → registrar backoff 'ABSENT'  (cooldown largo) + 1 warn espaciado. NO tryAcquire.
  ├─ INVALID  → registrar backoff 'INVALID' (cooldown largo) + 1 warn espaciado. NO tryAcquire.
  └─ RESOLVED → tryAcquire(...)
                 ├─ false → nada (otra réplica es dueña). Sin log, sin backoff.
                 └─ true  → negotiateAndConnect(...)
```

Tomar el lease para después no hacer nada sería el peor de los dos mundos: bloquearía a otra réplica
que tampoco puede hacer nada y ocultaría el estado real. Resolver **antes** de adquirir también
hace que el log de credencial ausente sea uno por réplica y no uno por adquisición.

### D-13 — Ciclo de vida de la sesión: logon, subscribe, relogon, reconexión, cierre

Reemplaza a la máquina de estados de cycle-01 §2.2. La unidad de "sesión viva" ya no es un
`listenKey` con vencimiento del exchange, sino **una conexión autenticada y suscripta**.

**Máquina de estados por credencial:**

| Estado | Entrada | Salida |
| --- | --- | --- |
| `IDLE` | inicial, o tras release | credencial `RESOLVED` + `tryAcquire` OK → `CONNECTING` |
| `CONNECTING` | dueño con credencial | `ws.connect()` OK → evento `connected` → `AUTHENTICATING`; timeout/error → `IDLE` + backoff |
| `AUTHENTICATING` | socket abierto, sesión **no** autenticada | `time` → `logon` → `subscribe`, todos OK → `LIVE`; cualquier error → clasificar (abajo) |
| `LIVE` | sesión autenticada y suscripta | `renew` del lease cada `userStreamOwnerRenewIntervalMs`; `ping` cada `userStreamSessionPingIntervalMs`; `logon` cada `userStreamRelogonIntervalMs` |
| `RECONNECTING` | socket cerrado, `autoReconnect` del cliente activo | próximo `connected` → `AUTHENTICATING`; `session-lost(RECONNECT_EXHAUSTED)` → `RELEASING` + backoff |
| `RELEASING` | lease perdido, credencial fuera del set, fallo de sesión o shutdown | §"Cierre" |

**La secuencia de autenticación es UNA sola función**, colgada del evento `connected`, y por lo tanto
idéntica en la primera conexión y en todas las reconexiones (RN-10, HU-04 CA-2):

```
on('connected')
  → serverTimeOffsetMs = (await ws.time()) - Date.now()
  → await ws.logon({ apiKey, signer })            // firmado con el offset aplicado (D-11)
  → await ws.subscribeUserDataStream()
  → lastSessionAuthAtMs = now; lastHeartbeatAtMs = now; reconnectAttempts = 0
  → estado LIVE
```

Un flag `authenticating` por credencial impide que dos `connected` solapados disparen dos secuencias.
**No existe una rama "ya estaba autenticado, no re-suscribo":** la WebSocket API no da forma de
saberlo y la suscripción es por conexión. Re-suscribir de más es barato; no re-suscribir es perder
fills en silencio.

**Relogon periódico (HU-04 CA-1).** Timer cada `userStreamRelogonIntervalMs` que, tras revalidar la
tenencia del lease, emite `session.logon` de nuevo sobre la conexión viva y actualiza
`lastSessionAuthAtMs`. **No re-suscribe** (la conexión no cambió). Si el relogon falla ⇒ fallo de
sesión (abajo).

**Invariante temporal, homólogo exacto del de cycle-01** (§5, verificado por test sobre las
constantes):

```
userStreamRelogonIntervalMs + userStreamRelogonGraceMs < userStreamSessionMaxAgeMs
```

`userStreamSessionMaxAgeMs` es un **techo autoimpuesto de 1 h**, no un dato del exchange: Binance
documenta un límite de conexión de 24 h y **no** documenta un vencimiento de la autorización de
sesión. Elegir 1 h con relogon cada 30 min y 15 min de colchón deja **dos** relogons exitosos antes
de tocar el colchón, es dos órdenes de magnitud más barato que el presupuesto de rate limit
(`REQUEST_WEIGHT` 6000/min medido en la sonda) y es robusto si mañana Binance introduce un
vencimiento más corto que 24 h. Está marcado como no medido en §13.

**Heartbeat aplicativo.** Timer cada `userStreamSessionPingIntervalMs` que emite el método `ping`
(medido: existe, `status 200`, sin credenciales). Éxito ⇒ `lastHeartbeatAtMs = now`. Un `ping` que
falla o vence **no** dispara renegociación por sí solo: deja que la frescura decida `DEGRADED` (D-15)
y que el pong-timeout del socket dispare `terminate()` → reconexión. Es la contención contra el
socket medio abierto **a nivel aplicativo**, complementaria a la de frames.

**Fallo de sesión — clasificación y camino único.** Cualquier `BinanceWsApiError` de `logon`,
`subscribe` o del relogon se clasifica:

| Clase | Códigos | Tratamiento |
| --- | --- | --- |
| `AUTH_REJECTED` (permanente) | `-1022` (firma inválida), `-2015` (key/IP/permisos), `-1102` (parámetro faltante o malformado) | `releaseCredential(key, 'AUTH_REJECTED')` + backoff fijo `userStreamAuthRejectedCooldownMs` (1 h) + **un** `warn`. Martillar una credencial rechazada es quemar rate limit sin ninguna chance de éxito — mismo criterio que `RETRYABLE_BINANCE_ERROR_CODES` aplica a `-1013`/`-2010` en REST. |
| `SESSION_UNAUTHENTICATED` | `-1193` | La sesión se cayó del lado del exchange: `releaseCredential(key, 'SESSION_LOST')` + backoff **transitorio**. La renegociación completa (socket nuevo + logon + subscribe) es el único camino de recuperación. |
| `TRANSIENT` | todo lo demás, incluidos timeout de request y desconexión | `releaseCredential(key, 'SESSION_LOST')` + backoff exponencial. |

**Hay un solo camino de salida de una sesión rota, y siempre libera el lease.** Eso es lo que mata
el issue-2 por construcción (D-16).

**Cierre ordenado (HU-04 CA-3).** `onApplicationShutdown` y salida del conjunto de suscripción, en
este orden estricto, cada paso en su propio `try/catch` y acotado por `userStreamRequestTimeoutMs`
para que el apagado no pueda colgarse:

```
parar timers (relogon, ping)
  → ws.unsubscribeUserDataStream()   best-effort
  → ws.logout()                      best-effort
  → ws.disconnect()
  → detachWsListeners()
  → coordination.release(...)        (solo si seguimos siendo dueños; si el lease se perdió, se salta)
  → borrar el estado en memoria y el health state conocido
```

A diferencia de cycle-01, `unsubscribe`/`logout` **no son peligrosos sin lease** (D-01): afectan solo
a la conexión propia. Se saltan igual cuando el socket ya está cerrado, porque no tendrían a quién
hablarle.

**Conjunto de credenciales a suscribir:** sin cambios respecto de cycle-01 §2.1 — unión de
`tradingConfig` con `isRunning: true`, modo `LIVE|TESTNET` y `entryOrderMode ≠ 'MARKET'`, más
`entryOrder` con `status: 'RESTING'`, refrescada cada `userStreamSubscriptionRefreshIntervalMs`.
`SANDBOX` nunca participa.

### D-14 — Parser del evento empujado: las dos envolturas, decididas por estructura

**Archivo nuevo:** `libs/data-fetcher/src/lib/binance/execution-report.ts`. Contiene, **movidos tal
cual** desde el cliente de cycle-01 que se borra: `RawUserDataStreamMessage`,
`ExecutionReportEvent` y `parseExecutionReport`. El mapeo campo por campo (`i → orderId` como
string, `g === -1 → null`, `C === '' → null`, `t === -1 → null`, los `parseFloat`) **no cambia ni
una línea**: es lo que sostiene la paridad de D-06 y sus tests ya pasados.

Se suma el extractor de envoltura:

```ts
export function extractUserDataEvent(frame: unknown): RawUserDataStreamMessage | null;
```

Reglas, en orden:

1. `frame` no es un objeto ⇒ `null`.
2. `frame.event` es un objeto ⇒ el candidato es `frame.event` (**envoltura A**:
   `{ event: { e: 'executionReport', … } }`).
3. Si no, el candidato es `frame` mismo (**envoltura B**: payload desnudo
   `{ e: 'executionReport', … }`).
4. El candidato tiene `e` de tipo string ⇒ se devuelve; si no ⇒ `null`.

**Se aceptan las dos formas y no se elige una.** La forma exacta no se pudo confirmar sin credencial
(requiere la Ed25519, que no existe) y **no puede bloquear el ciclo**. Aceptar las dos no es
ambigüedad: son estructuras disjuntas —una tiene `event` objeto, la otra tiene `e` string en la
raíz— y ninguna respuesta legítima de la WebSocket API (que siempre trae `id` + `status`) matchea
ninguna de las dos, porque el enrutamiento de D-10 resuelve las respuestas **antes** de llegar acá.
La verificación TESTNET dejará constancia de cuál de las dos usa Binance realmente (§13); el código
no necesita cambiar cuando se sepa.

`extractUserDataEvent` se verifica con tabla en las dos envolturas más el ruido (§11 T-14).

### D-15 — Salud y staleness: se renombra la señal, no el modelo

El modelo de RN-03 no cambia: la salud se decide por **señales que laten cuando no pasa nada**, y
`lastEventAtMs` sigue siendo **informativo y fuera del cálculo**. Lo que cambia es que la segunda
señal ya no es un keepalive REST sino la **última autenticación exitosa de sesión**.

`UserDataStreamHealthRecord` en `libs/shared/src/types/interfaces.ts` — **un campo renombrado, el
resto idéntico**:

```ts
export interface UserDataStreamHealthRecord {
  credentialKey: string;          // `${userId}:${env}` — jamás apiKey, firma ni clave privada
  ownerId: string;
  connectedAt: number;
  lastHeartbeatAtMs: number;
  lastSessionAuthAtMs: number;    // ← renombrado desde lastKeepaliveAtMs
  lastEventAtMs: number | null;   // INFORMATIVO — nunca entra al cálculo
  publishedAt: number;
}
```

`USER_DATA_STREAM_HEALTH_FIELDS` y el guard `AssertNoKeyDrift` se actualizan con el nombre nuevo y
**siguen siendo el candado**: agregar un campo que transporte material sensible falla en typecheck,
no en producción.

`libs/analysis/src/lib/reactive/user-data-stream-health.ts` — misma forma, misma cascada, una razón
renombrada:

```ts
export type UserDataStreamHealthReason =
  | 'NO_RECORD' | 'HEARTBEAT_STALE' | 'SESSION_AUTH_STALE' | null;
```

1. `!record` → `UNKNOWN` / `NO_RECORD`
2. `now - lastHeartbeatAtMs > heartbeatMaxAgeMs` → `DEGRADED` / `HEARTBEAT_STALE`
3. `now - lastSessionAuthAtMs > sessionAuthMaxAgeMs` → `DEGRADED` / `SESSION_AUTH_STALE`
4. → `HEALTHY` / `null`

**Se renombra en vez de reutilizar el nombre viejo** porque un campo llamado `lastKeepaliveAtMs` en
un transporte que no tiene keepalive es una mentira que el próximo lector paga. El registro es
interno (Redis con TTL de 25 s, un solo productor y un solo consumidor, ambos en `apps/api`), no
viaja a la SPA y no está en ningún contrato de API: el costo del renombre es mecánico y acotado a
tres archivos y sus specs.

`UNKNOWN` se sigue tratando como `DEGRADED` (fail-closed). Publicación cada
`userStreamHealthPublishIntervalMs` solo para credenciales con lease vivo; réplica muerta ⇒ registro
caducado ⇒ `UNKNOWN` ⇒ `DEGRADED`. **La ausencia de dueño nunca se ve como salud.**

Sin endpoint nuevo, sin evento WS nuevo, sin notificación nueva: se expone por el registro en Redis,
el getter en proceso `getHealth(userId, env)` y el log de transición.

### D-16 — Un solo camino de fallo de negociación, con backoff (issues 2 y 3)

**El defecto que se elimina** (issue-2, `user-data-stream.service.ts:731-737`): `renegotiate()`
paraba el keepalive, desconectaba el ws y, si `createListenKey()` fallaba, hacía `return` **dejando
el crédito en `ownedCredentials`**. `renewOwnedLeases()` seguía renovando el lease de un stream
muerto y `acquireActiveCredentials()` salteaba la key por estar ya en el mapa: el stream no se
recuperaba nunca y ninguna otra réplica podía tomar la credencial hasta reiniciar el proceso.

**La corrección no es un `release` más: es que exista una sola salida.** Todo fallo de sesión —de
`connect`, de `time`, de `logon`, de `subscribe`, del relogon, del `session-lost` del cliente— llama
a la **misma** función:

```ts
private async failSession(
  key: string,
  reason: CredentialReleaseReason,
  failureClass: NegotiationFailureClass,
): Promise<void>
```

que hace, siempre y en este orden: parar timers → detach de listeners → `ws.disconnect()` →
`release` del lease → borrar el estado en memoria → `registerNegotiationFailure(key, failureClass)`.
Después de `failSession` **es imposible** quedar con el crédito colgado, porque el estado y el lease
se sueltan en la misma función que registra el fallo. `renegotiate()` deja de existir como camino
propio: reconectar es `failSession` + el sweep siguiente, o la reconexión automática del cliente con
su re-autenticación (D-13).

**Backoff del sweep** (issue-3, `user-data-stream.service.ts:352-358`): hoy el fallo de creación
libera el lease y el sweep reintenta **cada 10 s por credencial con un `warn` por intento** —
reintento indefinido, rate limit quemado y flood de logs. Se reemplaza por:

```ts
type NegotiationFailureClass = 'TRANSIENT' | 'AUTH_REJECTED' | 'ABSENT' | 'INVALID';

interface NegotiationBackoff {
  attempts: number;
  nextAttemptAtMs: number;
  failureClass: NegotiationFailureClass;
}
private readonly negotiationBackoff = new Map<string, NegotiationBackoff>();
```

- `TRANSIENT`: `delay = min(userStreamNegotiateBaseDelayMs * 2^(attempts-1), userStreamNegotiateMaxDelayMs)`
  con jitter ±20 % (misma convención que `protection-retry.ts` y que el backoff del cliente).
- `AUTH_REJECTED` / `INVALID`: `userStreamAuthRejectedCooldownMs` fijo (1 h).
- `ABSENT`: `userStreamMissingCredentialLogIntervalMs` fijo (1 h).
- **Un `warn` por intento real.** Un tick del sweep que saltea la credencial porque
  `nextAttemptAtMs > now` **no loguea nada**. Eso es lo que hace verdaderas a HU-04 CA-6 y HU-08 CA-3
  al mismo tiempo.
- Éxito de negociación ⇒ `negotiationBackoff.delete(key)`. El backoff no sobrevive a una sesión
  sana.
- El mapa se purga junto con las cachés (D-19): entradas cuyo `nextAttemptAtMs` venció hace más de
  `userStreamNegotiateMaxDelayMs` y cuya credencial ya no está activa se borran.

### D-17 — Dedupe: la identidad se marca vista **después** del settle (issue-6)

**El defecto**: `handleExecutionReport()` marcaba la identidad como vista **antes** de que
`settleExecutionReport()` terminara. Un settle que fallaba por un error transitorio dejaba la
reentrega idéntica descartada durante 10 minutos — el stream dejaba de ser el detector rápido justo
en el caso en que había fallado.

**Estructura nueva:** dos colecciones, no una.

```ts
private readonly seenEvents = new Map<string, number>();   // identidad → settledAt (terminales)
private readonly inFlightEvents = new Set<string>();       // identidades en curso, en este tick
```

Identidad sin cambios:
`${symbol}:${orderId}:${orderStatus}:${cumulativeFilledQuantity}`.

**Pipeline** (el orden importa y es parte del contrato):

```
execution-report
  → lastEventAtMs = now                                (frescura; nunca decide salud)
  → identity = seenEventIdentity(report)
  → seenEvents tiene identity y no venció   ⇒ RETURN   (0 consultas a Prisma — HU-02 CA-2)
  → inFlightEvents tiene identity           ⇒ RETURN   (reentrega solapada; CE-1 de HU-02)
  → inFlightEvents.add(identity)
  → try:
       fillStatus = toEntryFillStatus(report)
       fillStatus === null                  ⇒ TERMINAL: markSeen
       order = correlate(userId, report)
       order === null                       ⇒ TERMINAL: markSeen (+ debug + contador)
       config  === null                     ⇒ TRANSITORIO: NO markSeen (+ warn)
       executor === null                    ⇒ TRANSITORIO: NO markSeen (+ warn)
       outcome = settleFill(...)
       'SETTLED'                            ⇒ TERMINAL: markSeen + fastPath.invalidateOpenPositions
       'ALREADY_SETTLED'                    ⇒ TERMINAL: markSeen
    catch (err):                            ⇒ TRANSITORIO: NO markSeen (+ error)
    finally: inFlightEvents.delete(identity)
```

**La regla, en una línea:** se marca vista una identidad **cuando volver a procesarla no puede
producir un efecto distinto**; no se marca cuando el intento se cayó por una condición que puede
desaparecer sola (Prisma transitorio, config todavía no visible, credencial que se acaba de rotar).
`ALREADY_SETTLED` cuenta como terminal porque el claim CAS ya decidió y ningún reintento cambia eso.

`inFlightEvents` es lo que cierra la ventana de concurrencia sin bloquear: dos entregas del mismo
evento en el mismo tick de event loop no producen dos consultas a Prisma, y si aun así se colaran,
el claim CAS de `settleFill` sigue siendo la red (RN-02 no depende del dedupe).

`seenEvents` conserva la cota FIFO por `userStreamSeenEventCacheSize` y la expiración por
`userStreamSeenEventTtlMs` de cycle-01. `inFlightEvents` no necesita cota: sus entradas se borran en
un `finally`.

### D-18 — Listener de `'error'` en los dos clientes WS (issue-4)

Un `EventEmitter` de Node que hace `emit('error', err)` **sin listener registrado lanza la excepción
y voltea el proceso**. Hoy hay dos superficies con ese agujero.

1. **`UserDataStreamService`** debe registrar `error` en `attachWsListeners` junto a los demás, y
   quitarlo en `detachWsListeners`. Tratamiento: `logger.warn` con `err.message` **y nada más** (§6),
   y **no** disparar renegociación por sí solo — un error de socket viene casi siempre acompañado de
   un `close`, que ya tiene su camino (reconexión del cliente → re-autenticación → o
   `session-lost` → `failSession`). Reaccionar a los dos duplicaría la renegociación.
2. **`MarketStreamService`** debe registrar `error` sobre `BinanceWsClient` en su constructor, junto
   a `ticker`/`kline`/`heartbeat` (`market-stream.service.ts:84-86`). Es un agujero **preexistente**,
   no una regresión de este ciclo, y el brief lo absorbe explícitamente. Tratamiento: `logger.warn`
   con `err.message`. El puerto `MarketStreamWsClient` de `apps/api` debe admitir el evento.

Los dos se verifican por comportamiento: emitir `'error'` sobre el doble **no** debe lanzar
(§11 T-09a/T-09b).

### D-19 — Cachés acotadas y tipadas (issue-8)

**El defecto**: `configCache`, `credentialsCache` y `executorCache` se llenan con TTL pero **nunca se
purgan** — crecen con la cantidad de usuarios/configs vistos y solo se vacían al reiniciar. Y
`ConfigCacheEntry.config` / `resolveTradingConfig()` están tipados `any`, perdiendo el chequeo del
payload que se pasa a `settleFill`.

**Cota.** Helper nuevo `apps/api/src/reactive/bounded-ttl-cache.ts`, sin dependencias:

```ts
export class BoundedTtlCache<V> {
  constructor(private readonly maxSize: number, private readonly ttlMs: number);
  get(key: string, now: number): V | undefined;   // vencida ⇒ se borra y devuelve undefined
  set(key: string, value: V, now: number): void;  // desaloja FIFO mientras size > maxSize
  delete(key: string): void;
  get size(): number;
}
```

Desalojo FIFO por orden de inserción del `Map` — el mismo patrón que ya usa `recordSeenEvent`, para
no introducir una segunda política de desalojo en el mismo archivo. Las tres cachés pasan a
`BoundedTtlCache`, con `maxSize = userStreamResolverCacheSize` (200) y
`ttlMs = userStreamSubscriptionRefreshIntervalMs` (el TTL efectivo de hoy). El `Map` de
`negotiationBackoff` se purga en el mismo barrido.

**Tipos.** Se elimina `any` de este archivo:

```ts
export interface UserStreamTradingConfig {
  id: string;
  userId: string;
  mode: TradingMode;
  asset: string;
  pair: string;
  nativeProtectionEnabled: boolean;
  stopLossPct: number;
  takeProfitPct: number;
  stopLimitOffsetPct: number;
  closeOnProtectionFailure: boolean;
}
```

Son exactamente los campos que `settleFill` y `PositionActionService.placeInitialProtection` leen del
config (verificado en `entry-order.service.ts:283-361` y `position-action.service.ts:149-548`). La
fila de Prisma satisface el tipo estructuralmente, así que `resolveTradingConfig(): Promise<UserStreamTradingConfig | null>`
tipa sin cast y sin acoplar `apps/api/src/reactive` al cliente generado de Prisma
(`apps/generated/prisma/client`), que ningún archivo de `src/` importa hoy.

`SettleFillParams.config` sigue siendo `any` en `entry-order.service.ts` — **eso es deuda ajena a
este ciclo y no se toca** (tres llamadores más dependen de esa firma). Lo que este ciclo garantiza es
que **su** lado del contrato está tipado.

Las dos `eslint-disable-next-line @typescript-eslint/no-explicit-any` del puerto
`UserStreamWsClient` desaparecen con el puerto tipado por eventos de §4.2.

### D-20 — Umbrales: los que se retiran y los que entran

Ver §5. Los cuatro umbrales de `listenKey` se **borran** (no quedan como legado muerto) y entran
nueve nuevos, con seis invariantes verificados por test sobre las constantes.

---

## 4bis. Contratos completos

### 4.1 Frames de la WebSocket API — lo que el cliente escribe y lee

```ts
// saliente
interface WsApiRequest {
  id: string;
  method: 'ping' | 'time' | 'session.logon' | 'session.logout'
        | 'userDataStream.subscribe' | 'userDataStream.unsubscribe';
  params: Record<string, string>;
}

// entrante — respuesta (forma MEDIDA en la sonda)
interface WsApiResponse {
  id: string;
  status: number;                                   // 200 = ok
  result?: unknown;                                 // no se inspecciona para nada crítico
  error?: { code: number; msg: string };
  rateLimits?: Array<{ rateLimitType: string; interval: string;
                       intervalNum: number; limit: number; count: number }>;
}
```

`session.logon` es el único request con `params` no vacío:

```json
{ "id": "<id>", "method": "session.logon",
  "params": { "apiKey": "<…>", "timestamp": "<ms>", "signature": "<base64>" } }
```

**Criterio de éxito de `session.logon`: `status === 200`, y nada más.** El contenido de `result` no
se pudo medir (requiere credencial) y **el diseño no depende de él**: no se lee, no se guarda y no se
loguea. Si Binance devuelve `{ apiKey, authorizedSince, connectedSince, returnRateLimits,
serverTime, userDataStream }` o cualquier otra forma, el cliente funciona igual. Ésa es la respuesta
a la mitad no medible de la pregunta abierta 1.

`rateLimits` se ignora (el limitador local de REST no aplica acá y la sonda midió `limit: 6000` con
`count: 3`: el consumo del ciclo —un `time`, un `logon` y un `subscribe` por conexión, más un `ping`
cada 3 min y un `logon` cada 30 min— es despreciable contra ese presupuesto).

### 4.2 Puertos estructurales en `apps/api`

```ts
export const USER_STREAM_WS_API_FACTORY = Symbol('USER_STREAM_WS_API_FACTORY');
export const USER_STREAM_AUTH_CREDENTIAL = Symbol('USER_STREAM_AUTH_CREDENTIAL');

export interface UserStreamWsApiEvents {
  connected: (payload: { at: number }) => void;
  disconnected: (payload: { at: number; code: number | null }) => void;
  reconnecting: (payload: { at: number; attempt: number; delayMs: number }) => void;
  heartbeat: (payload: { at: number }) => void;
  'execution-report': (report: ExecutionReportEvent) => void;
  'session-lost': (payload: { at: number; reason: 'RECONNECT_EXHAUSTED' }) => void;
  error: (err: Error) => void;
}

export interface UserStreamWsApiClient {
  on<E extends keyof UserStreamWsApiEvents>(e: E, l: UserStreamWsApiEvents[E]): unknown;
  off<E extends keyof UserStreamWsApiEvents>(e: E, l: UserStreamWsApiEvents[E]): unknown;
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  getBaseUrl(): string;
  time(): Promise<number>;
  ping(): Promise<void>;
  logon(auth: { apiKey: string; signer: Ed25519Signer }): Promise<void>;
  logout(): Promise<void>;
  subscribeUserDataStream(): Promise<void>;
  unsubscribeUserDataStream(): Promise<void>;
}

export type UserStreamWsApiFactory = (opts: { testnet: boolean }) => UserStreamWsApiClient;
```

El puerto **tipado por evento** reemplaza al `on(event: string, listener: (...args: any[]) => void)`
de cycle-01 y elimina sus dos `eslint-disable`. `BinanceWsApiClient extends EventEmitter` lo satisface
por bivarianza de métodos; si el compilador objetara, el implementador **no inventa casts**: declara
en el cliente sobrecargas explícitas de `on`/`off` con la misma firma del puerto.

### 4.3 Estado por credencial (en memoria, jamás serializado)

```ts
interface OwnedCredentialStream {
  userId: string;
  env: CredentialEnv;
  apiKey: string;                  // material sensible — no sale de este objeto
  signer: Ed25519Signer;           // material sensible — no sale de este objeto
  ws: UserStreamWsApiClient;
  serverTimeOffsetMs: number;
  connectedAt: number;
  lastHeartbeatAtMs: number;
  lastSessionAuthAtMs: number;
  lastEventAtMs: number | null;
  relogonTimer: ReturnType<typeof setInterval> | null;
  pingTimer: ReturnType<typeof setInterval> | null;
  reconnectAttempts: number;
  authenticating: boolean;
  listeners?: OwnedCredentialListeners;
}

export type CredentialReleaseReason =
  | 'INACTIVE' | 'LEASE_LOST' | 'COORDINATION_UNHEALTHY' | 'SHUTDOWN'
  | 'SESSION_LOST' | 'AUTH_REJECTED';
```

### 4.4 Camino del evento — el único camino de reconciliación (RN-01)

Sin cambios de fondo respecto de cycle-01, con el dedupe de D-17 y la guarda de `userId` de §4.5:

```
execution-report → frescura → dedupe (D-17) → toEntryFillStatus (D-06)
  → correlación con guarda de userId (D-05) → config + executor
  → entryOrderService.settleFill({...})
  → 'SETTLED' ⇒ fastPath.invalidateOpenPositions(order.configId)
```

**Prohibido, y el reviewer lo verifica:** este servicio **no** crea `Position`, **no** crea `Trade`,
**no** escribe `bot_actions`, **no** llama a `placeInitialProtection` y **no** emite ningún evento
`entry-order:*`. Sigue sin inyectar `AppGateway` ni `NotificationsService`.

### 4.5 Defecto adicional que este ciclo cierra: la correlación no está acotada por usuario

`correlateRestingOrder` hace `findUnique({ where: { clientOrderId } })` —una consulta **global**, no
acotada por usuario— y después valida con `isAcceptableEntryOrderMatch`, que chequea
`side === 'BUY'`, `status === 'RESTING'` y `symbol`, **pero no `userId`**. El `userId` con el que se
llama a `settleFill` sale del **dueño de la sesión** (`state.userId`), no de la fila. Un
`executionReport` que llegue por la sesión de un dueño y correlacione con la fila de otro produciría
un settle con el `userId` equivocado.

En cycle-01 el escenario era remoto (la credencial de la sesión salía de la base, del mismo usuario).
En cycle-02 deja de serlo: la credencial Ed25519 sale del **entorno** y puede pertenecer a una cuenta
de Binance distinta de la del usuario (§1.6). No es aceptable dejarlo apoyado en una probabilidad.

**Corrección**: `isAcceptableEntryOrderMatch(row, report, userId)` suma `row.userId === userId`. El
respaldo ya filtraba por `userId` en el `where`; el primario ahora tiene la misma garantía. Efecto
sobre el peor caso de §1.6: una sesión de una cuenta ajena produce **cero** correlaciones, nunca una
equivocada.

Se verifica con un test de comportamiento explícito (§11 T-01c).

---

## 5. Umbrales — `reactive-runtime-thresholds.ts`

**Se borran** (no quedan como legado muerto): `userStreamKeyExpiryMs`,
`userStreamKeepaliveIntervalMs`, `userStreamKeepaliveGraceMs`, `userStreamKeepaliveMaxAgeMs`.

**Quedan igual:** `userStreamOwnerLeaseTtlMs`, `userStreamOwnerRenewIntervalMs`,
`userStreamSweepIntervalMs`, `userStreamSubscriptionRefreshIntervalMs`,
`userStreamHeartbeatMaxAgeMs`, `userStreamHealthPublishIntervalMs`, `userStreamHealthTtlMs`,
`userStreamReconnectBaseDelayMs`, `userStreamReconnectMaxDelayMs`,
`userStreamReconnectAttemptsBeforeRenegotiate`, `userStreamSeenEventTtlMs`,
`userStreamSeenEventCacheSize`.

**Entran:**

```ts
userStreamSessionMaxAgeMs: 3_600_000,              // techo autoimpuesto de sesión (1 h) — NO medido
userStreamRelogonIntervalMs: 1_800_000,            // 30 min → 2 relogons antes del colchón
userStreamRelogonGraceMs: 900_000,                 // 15 min de colchón
userStreamSessionAuthMaxAgeMs: 2_400_000,          // 40 min — frescura de la autenticación
userStreamSessionPingIntervalMs: 180_000,          // 3 min — heartbeat aplicativo
userStreamRequestTimeoutMs: 10_000,                // timeout de un request de la WS API
userStreamConnectTimeoutMs: 15_000,                // timeout del 'open' del socket
userStreamNegotiateBaseDelayMs: 10_000,            // backoff del sweep (issue-3)
userStreamNegotiateMaxDelayMs: 300_000,            // 5 min de techo
userStreamAuthRejectedCooldownMs: 3_600_000,       // 1 h ante credencial rechazada o inválida
userStreamMissingCredentialLogIntervalMs: 3_600_000, // 1 h entre avisos de credencial ausente
userStreamResolverCacheSize: 200,                  // cota de config/credentials/executor (issue-8)
```

**Invariantes, verificados por un test unitario sobre las constantes** (así el umbral no se puede
desajustar por un cambio suelto):

1. `userStreamRelogonIntervalMs + userStreamRelogonGraceMs < userStreamSessionMaxAgeMs`
2. `userStreamSessionAuthMaxAgeMs < userStreamSessionMaxAgeMs`
3. `userStreamRelogonIntervalMs < userStreamSessionAuthMaxAgeMs`
4. `userStreamOwnerRenewIntervalMs < userStreamOwnerLeaseTtlMs`
5. `userStreamHealthTtlMs > userStreamHealthPublishIntervalMs`
6. `userStreamSessionPingIntervalMs < userStreamHeartbeatMaxAgeMs`
7. `userStreamNegotiateBaseDelayMs >= userStreamSweepIntervalMs`
8. `userStreamRequestTimeoutMs < userStreamSessionPingIntervalMs`

Los invariantes 1-3 son el homólogo exacto de los 1-3 de cycle-01: misma forma, mismo test, sujeto
distinto. Los 6-8 son nuevos y protegen las tres formas de desajuste que el transporte nuevo
introduce (un ping más lento que el umbral de frescura declararía `DEGRADED` a un stream sano; un
backoff más corto que el sweep no frenaría nada; un timeout más largo que el intervalo de ping
solaparía requests).

---

## 6. Seguridad del material sensible (HU-06 / RN-07)

Reglas de construcción, no de disciplina. Las tres piezas protegidas son **la clave privada Ed25519,
la firma de `session.logon` y la `apiKey`**.

1. **La clave privada nunca es un campo.** Se lee en una constante local del resolver, se convierte a
   `KeyObject` y el string se descarta. Solo circula el `KeyObject`, dentro del closure del signer
   (D-11).
2. **`Ed25519Signer` no expone material.** Sin getter, sin campo público, sin `toJSON`.
   `JSON.stringify(signer)` da `{}`; `util.inspect(keyObject)` muestra tipo y algoritmo, nunca bytes.
3. **La `apiKey` y el signer entran a `logon()` como argumento de método**, no como campo de
   configuración del cliente. Un objeto de config se loguea entero con naturalidad ("config del
   cliente"); un argumento de método no. Es la misma decisión que en cycle-01 puso el `listenKey`
   como argumento de `connect()`.
4. **El cliente no guarda la credencial entre `logon()`s** y no re-autentica solo (D-10): no hay
   dónde quede residente.
5. **`UserDataStreamHealthRecord` tiene lista de campos congelada** y ningún campo derivado de las
   tres piezas — ni hash, ni prefijo, ni longitud. Agregar uno rompe el typecheck (D-15).
6. **Ningún payload hacia la SPA cambia** (§7) ⇒ el material no puede viajar al navegador. El
   servicio sigue sin inyectar gateway ni notificaciones.
7. **Los logs referencian la credencial por `credentialKey = ${userId}:${env}`**, nunca por `apiKey`.
8. **`BinanceWsApiError.message` se construye solo con `status`, `code`, `msg` y `method`.** Jamás
   con el request. Esto reemplaza a la regla de cycle-01 sobre `error.config.url` de axios: con el
   transporte nuevo no hay REST en este camino, pero **sí** hay un frame saliente que contiene
   literalmente la `apiKey` y la firma, y volcarlo en un log de error es la vía de fuga concreta del
   ciclo.
9. **`redactWsApiRequest(frame)`** es la única forma permitida de imprimir un frame saliente
   (`params.apiKey` y `params.signature` → `'***'`). Existe para que el diagnóstico que alguien
   agregue el mes que viene ya tenga la herramienta correcta a mano.
10. **El listener de `'error'` loguea `err.message` y nada más** (D-18) — no el objeto de error, no
    el estado del cliente.

Todo esto se verifica con el **centinela en runtime** de cycle-01, extendido a tres centinelas
(§11 T-06). No se hace string-matching sobre el texto fuente: está prohibido y además probaría menos.

---

## 7. Schema, API y componentes

| Registro | Estado |
| --- | --- |
| `sdd/schema.json` | **No modificado.** Ninguna tabla, columna, índice ni enum nuevo. La clave Ed25519 viene del entorno y **no se persiste** (fuera de alcance por brief). La correlación de respaldo sigue apoyada en el índice existente `[userId, status]`. La idempotencia sigue siendo la transición condicional `RESTING → FILLED`. |
| `sdd/api.json` | **No modificado.** Ningún endpoint REST nuevo, modificado ni depreciado. **EP-017 `GET /trading/entry-orders` queda byte-idéntico** y los seis eventos `entry-order:*` de `ENTRY_ORDER_WS_EVENTS` también: el stream reusa `settleFill`, que ya los emite. Ningún evento WS nuevo, ningún tipo de notificación nuevo. |
| `sdd/components.json` | **No modificado.** La SPA no se toca: cero componentes creados, modificados o borrados. |

El renombre de `lastKeepaliveAtMs` → `lastSessionAuthAtMs` (D-15) **no es un cambio de contrato de
API**: `UserDataStreamHealthRecord` es un registro interno de Redis con TTL de 25 s, producido y
consumido dentro de `apps/api`/`libs/analysis`, que nunca se serializa hacia la SPA ni aparece en
ninguna respuesta HTTP.

---

## 8. Cableado (`reactive.module.ts`)

```ts
{
  provide: USER_STREAM_AUTH_CREDENTIAL,
  useFactory: (): UserStreamAuthCredentialPort => new EnvUserStreamAuthCredentialResolver(),
},
{
  provide: USER_STREAM_WS_API_FACTORY,
  useFactory: (): UserStreamWsApiFactory =>
    ({ testnet }) => new BinanceWsApiClient({
      testnet,
      wsPingIntervalMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.wsPingIntervalMs,
      wsPongTimeoutMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.wsPongTimeoutMs,
      reconnectBaseDelayMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamReconnectBaseDelayMs,
      reconnectMaxDelayMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamReconnectMaxDelayMs,
      reconnectAttemptsBeforeExhaustion:
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamReconnectAttemptsBeforeRenegotiate,
      requestTimeoutMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamRequestTimeoutMs,
      connectTimeoutMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamConnectTimeoutMs,
    }),
},
{
  provide: UserDataStreamService,
  useFactory: (prisma, coordination, entryOrders, fastPath, authCredentials, wsApiFactory) =>
    isUserDataStreamFillsEnabled()
      ? new UserDataStreamService(prisma, coordination, entryOrders, fastPath,
          authCredentials, wsApiFactory, DEFAULT_REACTIVE_RUNTIME_THRESHOLDS, randomUUID())
      : null,
  inject: [PrismaService, REACTIVE_COORDINATION, EntryOrderService, FastPathService,
           USER_STREAM_AUTH_CREDENTIAL, USER_STREAM_WS_API_FACTORY],
}
```

Cambios respecto de cycle-01: **desaparece** `USER_STREAM_REST_FACTORY` (D-09) y **entra**
`USER_STREAM_AUTH_CREDENTIAL`. La factory de WS cambia de clase y suma dos timeouts.

**El grafo de módulos no cambia** (constitución de `apps/api` §3.4): `ReactiveModule` ya importa
`PrismaModule`, `ReactiveCoordinationModule`, `TradingModule` y `GatewayModule`; no hace falta
ninguna importación nueva. `reactive-module-wiring.spec.ts` sigue siendo el candado.
`EnvUserStreamAuthCredentialResolver` **no se instancia con el interruptor apagado en un sentido
efectivo**: aunque su provider exista, su constructor no lee `process.env` (D-12) y su `resolve()`
nunca se llama porque `UserDataStreamService` es `null`.

---

## 9. Qué se borra de cycle-01 y qué se conserva — archivo por archivo

### 9.1 Se borra

| Archivo / símbolo | Motivo |
| --- | --- |
| `libs/data-fetcher/src/lib/binance/binance-user-data-stream.client.ts` | Cliente single-stream `/ws/<listenKey>`. Su URL, su envoltura y su modelo de key no existen en el transporte nuevo. **`ExecutionReportEvent`, `RawUserDataStreamMessage` y `parseExecutionReport` se MUEVEN a `execution-report.ts` sin cambios** (D-14); todo lo demás del archivo se borra. |
| `libs/data-fetcher/src/lib/binance/binance-user-data-stream.client.spec.ts` | Cubre el cliente borrado. Los casos del **parser** se mueven a `execution-report.spec.ts`; los de conexión/heartbeat/backoff los reemplazan los de `binance-ws-api.client.spec.ts`. |
| `libs/data-fetcher/src/lib/binance/binance-user-data-stream.testnet.spec.ts` | Harness contra el transporte muerto (aborta en `createListenKey` con 410). Reemplazado por `binance-ws-api.testnet.spec.ts`. |
| `BINANCE_USER_STREAM_WS_URL`, `BINANCE_TESTNET_USER_STREAM_WS_URL` | URLs del transporte retirado. Reemplazadas por `BINANCE_WS_API_URL` / `BINANCE_WS_API_TESTNET_URL`. |
| `StreamExpiredEvent`, `StreamExpiredReason` (`'LISTEN_KEY_EXPIRED'`) | No hay `listenKey` que venza. Reemplazados por `session-lost` con `'RECONNECT_EXHAUSTED'`. |
| `BinanceRestClient.createListenKey / keepAliveListenKey / closeListenKey` y el privado `keyedRequest` | D-09. Sin otro usuario. |
| Las 3 entradas de `ENDPOINT_WEIGHTS` para `/api/v3/userDataStream` (POST/PUT/DELETE) | D-09. Los endpoints no existen. |
| Los casos de `binance-rest.client.spec.ts` que cubren esos tres métodos | Cubren código borrado. |
| `USER_STREAM_REST_FACTORY`, `UserStreamRestClient`, `UserStreamRestFactory` (`apps/api`) | D-09. El stream no hace REST. |
| `UserStreamWsClient`, `UserStreamWsFactory` (`apps/api`, la forma de cycle-01) | Reemplazados por `UserStreamWsApiClient` / `UserStreamWsApiFactory` tipados por evento (§4.2). |
| `LISTEN_KEY_MISSING_ERROR_CODE` (`-1125`) y su rama | Código de un endpoint que ya no se llama. |
| `startKeepalive` / `stopKeepalive` / `runKeepaliveTick` / `renegotiate` / `handleStreamExpired` | Reemplazados por la máquina de D-13 y el `failSession` único de D-16. |
| Umbrales `userStreamKeyExpiryMs`, `userStreamKeepaliveIntervalMs`, `userStreamKeepaliveGraceMs`, `userStreamKeepaliveMaxAgeMs` | D-20. |
| Campo `lastKeepaliveAtMs` y razón `KEEPALIVE_STALE` | Renombrados (D-15). |
| `FakeUserStreamRestClient` (doble de test) | No hay REST que doblar. |

### 9.2 Se conserva sin tocar

| Archivo | Por qué sobrevive |
| --- | --- |
| `apps/api/src/reactive/execution-report-fill.ts` **y su spec** | D-06 no depende del transporte. Ni una línea. |
| `apps/api/src/reactive/entry-fill-watch.service.ts` | La sonda por tick no se gatea (D-07). Solo se le **agrega un test** a su spec (issue-5). |
| `apps/api/src/trading/entry-order.service.ts` (`settleFill`, `normalizeEntryClientOrderId`) | Único camino de reconciliación. Se llama, no se cambia. |
| `apps/api/src/trading/reconciliation.service.ts` | Fuera de alcance. |
| `libs/trading-engine/**` | Nunca depende de `data-fetcher`. Sin cambios. |
| `libs/data-fetcher/src/lib/binance/binance-ws.client.ts` | El riel de mercado no se toca (solo su **consumidor** suma un listener, D-18). |
| `libs/data-fetcher/src/lib/binance/binance-rest.client.testnet.spec.ts` | Harness de órdenes, ajeno al stream. |
| `apps/web/**` | Requisito del ciclo: la SPA no cambia. |
| `apps/api/prisma/schema.prisma` | Sin tablas, columnas ni enums nuevos. |

### 9.3 Se modifica

| Archivo | Qué cambia |
| --- | --- |
| `libs/data-fetcher/src/lib/binance/binance-rest.client.ts` | Borrado de los 3 métodos + `keyedRequest` + 3 pesos (D-09). Nada más. |
| `libs/data-fetcher/src/lib/binance/index.ts` | Exports: fuera el cliente viejo y sus constantes; adentro `BinanceWsApiClient`, sus URLs y tipos, `Ed25519Signer` + `createEd25519Signer` + `buildSignaturePayload` + `redactWsApiRequest`, y `ExecutionReportEvent` + `parseExecutionReport` + `extractUserDataEvent` desde `execution-report.ts`. **`ExecutionReportEvent` sigue exportándose con el mismo nombre desde `@crypto-trader/data-fetcher`** — por eso `execution-report-fill.ts` no cambia. |
| `libs/shared/src/types/interfaces.ts` | Renombre del campo + de la lista congelada (D-15). |
| `libs/analysis/src/lib/reactive/user-data-stream-health.ts` **y su spec** | Renombre de la razón + del umbral (D-15). |
| `apps/api/src/reactive/user-data-stream.service.ts` | Reescritura del transporte y del ciclo de vida (D-10..D-19), conservando lease, correlación, dedupe, salud y el camino a `settleFill`. |
| `apps/api/src/reactive/reactive-runtime-thresholds.ts` **y su spec** | D-20 + los 8 invariantes. |
| `apps/api/src/reactive/reactive.module.ts` **y `reactive-module-wiring.spec.ts`** | §8. |
| `apps/api/src/reactive/user-data-stream-flag.ts` **y su spec** | `=== 'true'` a secas (D-08 / issue-7). |
| `apps/api/src/reactive/market-stream.service.ts` | **Solo** el listener de `'error'` (D-18). |
| `apps/api/src/reactive/entry-fill-watch.service.spec.ts` | **Solo** el test de HU-05 CA-2 (issue-5). |
| `.env.example` | Las nueve variables de §1.1, vacías, con el comentario de referencia. |

### 9.4 Se crea

| Archivo | Contenido |
| --- | --- |
| `libs/data-fetcher/src/lib/binance/ed25519-signer.ts` (+ spec) | D-11. |
| `libs/data-fetcher/src/lib/binance/execution-report.ts` (+ spec) | D-14 + lo movido del cliente viejo. |
| `libs/data-fetcher/src/lib/binance/binance-ws-api.client.ts` (+ spec) | D-10. |
| `libs/data-fetcher/src/lib/binance/binance-ws-api.testnet.spec.ts` | Harness TESTNET opt-in (§11.4). |
| `apps/api/src/reactive/user-stream-auth-credential.port.ts` | D-12. |
| `apps/api/src/reactive/env-user-stream-auth-credential.resolver.ts` (+ spec) | D-12. |
| `apps/api/src/reactive/bounded-ttl-cache.ts` (+ spec) | D-19. |
| `apps/api/src/reactive/user-stream-ws-api.test-double.ts` | `FakeUserStreamWsApiClient` compartido por los specs del servicio (§11.1). |

---

## 10. Carriles por implementador — qué puede y qué no puede tocar

Un dueño por archivo. Los carriles L y S se pueden correr en paralelo; A depende de los dos; V va
último y es bloqueable.

### Carril L — `libs/data-fetcher` (transporte)

**Puede tocar:** `ed25519-signer.ts`, `execution-report.ts`, `binance-ws-api.client.ts` y sus specs;
`binance-user-data-stream.client.ts` + sus dos specs (para **borrarlos**); `binance-rest.client.ts`
(solo el bloque de `listenKey`, `keyedRequest` y los 3 pesos); `binance-rest.client.spec.ts` (solo
esos casos); `binance/index.ts`.

**NO puede tocar:** `binance-ws.client.ts`, `binance-rate-limiter.ts`, `signedRequest`, ninguna otra
operación de trading de `BinanceRestClient`, `binance-rest.client.testnet.spec.ts`, ni nada fuera de
`libs/data-fetcher`.

**Invariantes que debe respetar:** cero dependencias npm nuevas; el cliente no conoce Prisma, no hace
REST y no decide reconciliación; ningún log dentro de la lib; el mapeo de `parseExecutionReport` se
mueve **sin modificaciones**.

### Carril S — `libs/shared` + `libs/analysis` (vocabulario y resolver puro)

**Puede tocar:** el bloque `UserDataStreamHealthRecord` /
`USER_DATA_STREAM_HEALTH_FIELDS` / `AssertNoKeyDrift` de `libs/shared/src/types/interfaces.ts`;
`libs/analysis/src/lib/reactive/user-data-stream-health.ts` y su spec.

**NO puede tocar:** `StreamHealthRecord` ni `StreamHealthState` (del riel de mercado),
`ENTRY_ORDER_WIRE_FIELDS`, `trading-config-wire.ts`, `stream-health.ts` de `libs/analysis`, ni
ningún otro tipo compartido.

**Invariante:** `libs/shared` no puede importar de `libs/data-fetcher`; `Ed25519Signer` vive en
`data-fetcher` y **no** se promueve a `shared` (solo lo usan `data-fetcher` y `apps/api`, y
`libs/trading-engine` no lo necesita — es la misma regla que dejó a `ExecutionReportEvent` en
`data-fetcher` en cycle-01).

### Carril A — `apps/api/src/reactive` (consumidor)

**Puede tocar:** `user-data-stream.service.ts` y su spec; `user-stream-auth-credential.port.ts`;
`env-user-stream-auth-credential.resolver.ts` + spec; `bounded-ttl-cache.ts` + spec;
`user-stream-ws-api.test-double.ts`; `reactive-runtime-thresholds.ts` + spec;
`reactive.module.ts` + `reactive-module-wiring.spec.ts`; `user-data-stream-flag.ts` + spec;
`market-stream.service.ts` **solo** para el listener de `'error'` y el puerto que lo admite;
`entry-fill-watch.service.spec.ts` **solo** para el test de HU-05 CA-2.

**NO puede tocar:** `entry-fill-watch.service.ts` (el **fuente**), `fast-path.service.ts`,
`material-event.service.ts`, `stream-health.service.ts`, `reactive-coordination.port.ts` ni sus
implementaciones, `apps/api/src/trading/**` (incluidos `entry-order.service.ts`,
`reconciliation.service.ts`, `position-action.service.ts`, `action-gate.service.ts`),
`apps/api/src/gateway/**`, `apps/api/src/notifications/**`, `apps/web/**`, ni el schema de Prisma.

**Invariantes que el reviewer verifica:** el servicio no inyecta `AppGateway` ni
`NotificationsService`; no crea `Position`/`Trade`/`bot_actions`; no llama `placeInitialProtection`;
no emite ningún `entry-order:*`; no existe ninguna ruta que condicione la sonda o la reconciliación
al estado del stream; cero comentarios narrativos.

### Carril V — verificación TESTNET (última, bloqueable)

**Puede tocar:** `libs/data-fetcher/src/lib/binance/binance-ws-api.testnet.spec.ts` y
`cycles/cycle-02/artifacts/`.

**NO puede tocar:** ningún archivo de producción. Si la clave Ed25519 no existe, **la task se declara
bloqueada y no se inventa evidencia** (HU-07 CA-2).

### Prohibiciones transversales (todos los carriles)

- **Nunca LIVE**: ni claves, ni bots, ni órdenes, ni sockets contra `ws-api.binance.com` o
  `api.binance.com` con credencial.
- El interruptor se entrega **apagado**; `.env.example` deja `USER_DATA_STREAM_FILLS_ENABLED=` vacío.
- Tests unitarios y de integración **sin red**: el transporte se ejercita por doble.
- `libs/trading-engine` **nunca** depende de `libs/data-fetcher`.
- **Sin comentarios narrativos** en el código.
- **Prohibido** testear sobre el texto fuente de un rango entre dos símbolos.
- No se tocan `sdd/api.json`, `sdd/schema.json` ni `sdd/components.json`.
- La SPA, EP-017 y los seis eventos `entry-order:*` no cambian.

---

## 11. Estrategia de pruebas — cómo se verifica cada criterio

### 11.1 Dobles (todo corre sin red; CI recibe 451 de Binance)

- **`FakeUserStreamWsApiClient extends EventEmitter implements UserStreamWsApiClient`**
  (`apps/api/src/reactive/user-stream-ws-api.test-double.ts`): cuenta llamadas de `connect`,
  `logon`, `subscribeUserDataStream`, `unsubscribeUserDataStream`, `logout`, `ping`, `time`,
  `disconnect`; guarda la `apiKey` recibida en cada `logon`; permite programar rechazos
  (`failNextLogonWith(status, code)`, `failNextSubscribeWith(...)`); helpers
  `emitConnected()`, `emitExecutionReport(partial)`, `emitClose()`, `emitHeartbeat()`,
  `emitSessionLost()`, `emitError(err)`.
- **`FakeUserStreamAuthCredentialResolver`**: devuelve `RESOLVED` / `ABSENT` / `INVALID` a demanda,
  con un `Ed25519Signer` falso cuyo `sign()` devuelve un centinela.
- **Coordinación:** `createSharedFakeCoordination()` extraído a
  `apps/api/src/reactive/reactive-coordination.test-double.ts` (ya previsto en cycle-01) e importado
  por los specs de market-stream, user-data-stream y entry-fill-watch.
- **Socket de la lib:** los specs de `binance-ws-api.client.ts` usan un doble de `ws` (mismo patrón
  que `binance-ws.client.spec.ts`) — **ningún test instancia un socket real**.
- **Timers falsos de Jest/Vitest** para relogon, ping aplicativo, sweep, backoff y publicación de
  salud.

### 11.2 Matriz criterio → verificación

| Criterio | Cómo se verifica (ejecutable) | ID |
| --- | --- | --- |
| **HU-01 CA-1** — protección sin esperar ningún tick | Con el doble de `MarketStreamService` sin emitir **un solo** `tick`, se emite `execution-report` sobre el doble; assert: `settleFill` llamado 1 vez. | T-01a |
| **HU-01 CA-2 / CE-2** — correlación por id principal y por respaldos | Tabla: `clientOrderId` exacto; `clientOrderId` con sufijo `-l` y `-s` (normalización); `orderId`, `limitLegOrderId`, `stopLegOrderId`, `orderListId`. Cada fila resuelve la fila correcta. | T-01b |
| **(defecto §4.5)** — la correlación no cruza usuarios | Fila `entry_orders` RESTING de `user-A` con el `clientOrderId` del reporte; sesión cuyo dueño es `user-B`; assert: `settleFill` **0 llamadas**. | T-01c |
| **HU-01 CA-3** — mismo contenido para cualquier detector | Fixtures pareados (payload REST ↔ `executionReport` del mismo fill): `toEntryFillStatus(report)` **deep-equal** al `EntryOrderExchangeStatus` del camino REST, para `LIMIT_MAKER` y para pierna OCO `STOP_LOSS_LIMIT`. Test **heredado de cycle-01, sin cambios**. | T-01d |
| **HU-01 CE-1** — orden ya no descansando | Fila `FILLED`/inexistente ⇒ `settleFill` 0 llamadas, gateway 0, notificaciones 0. | T-01e |
| **HU-02 CA-1** — conteo único en cualquier orden | Dos entregas del mismo fill por el stream; stream + sonda; sonda + barrido. En los tres, con el claim CAS real de `settleFill` doblado por un Prisma falso que respeta `updateMany({status:'RESTING'})`: exactamente 1 posición, 1 trade, 1 bot_action. | T-02a |
| **HU-02 CA-2** — el efecto del segundo aviso es nulo | Con la fila ya `FILLED`: spies sobre notificaciones, `emitToUser` y el executor ⇒ 0 llamadas en los tres. Con reentrega de identidad ya vista: **0 llamadas al doble de Prisma**. | T-02b |
| **HU-02 CA-3** *(issue-6)* — la identidad se marca vista solo tras un settle exitoso | (a) `settleFill` **lanza** en la 1.ª entrega; la 2.ª entrega **vuelve a intentar** y llega a `settleFill` (2 llamadas). (b) `resolveTradingConfig` devuelve `null` la 1.ª vez y el config la 2.ª: la 2.ª entrega settlea. (c) `SETTLED` y (d) `ALREADY_SETTLED`: la 2.ª entrega **no** llega a Prisma. (e) `toEntryFillStatus` `null` y (f) sin correlación: la 2.ª entrega no consulta Prisma. | T-02c |
| **HU-02 CE-1** — dos detectores concurrentes | Dos `emit('execution-report')` en el mismo tick del event loop: `settleFill` 1 vez (guarda `inFlightEvents`). | T-02d |
| **HU-03 CA-1** — apagado, nada se abre ni se pide | Sin `USER_DATA_STREAM_FILLS_ENABLED`: `moduleRef.get(UserDataStreamService)` es `null`; el doble de WS registra 0 `connect`/`logon`/`subscribe` y el doble de resolver 0 `resolve`, tras avanzar timers falsos más allá de la suma de todos los intervalos `userStream*`. | T-03a |
| **HU-03 CA-2** — activar/desactivar no cambia la SPA | El servicio no inyecta `AppGateway` ni `NotificationsService` (assert sobre el `inject` del provider) y `ENTRY_ORDER_WS_EVENTS` no cambia (test existente). | T-03b |
| **HU-03 CA-3** *(issue-7)* — una sola forma de estar encendido | Tabla sobre `isUserDataStreamFillsEnabled()`: `'true'` ⇒ `true`; `'1'`, `'TRUE'`, `'yes'`, `''`, `undefined` ⇒ `false`. | T-03c |
| **HU-04 CA-1** — nunca se cumple el plazo de sesión sin renovación | (a) invariantes 1-3 de §5 sobre las constantes; (b) con timers falsos, avanzar `userStreamSessionMaxAgeMs` y assert ≥1 `logon` posterior al inicial, leyendo el umbral **del objeto**, nunca como literal. | T-04a |
| **HU-04 CA-2** — re-logon + re-subscribe tras **cualquier** reconexión | Tabla de causas: `emitClose()` seguido de `emitConnected()`; `emitError` + close; cierre limpio del exchange. En las tres: `logon` y `subscribeUserDataStream` **+1 cada uno** antes de que el servicio vuelva a considerar operativa la escucha, sin intervención. | T-04b |
| **HU-04 CA-3** — cierre explícito al apagar | `onApplicationShutdown`: para los timers, llama `unsubscribeUserDataStream`, `logout`, `disconnect` y `release`, en ese orden; y con el lease ya perdido, **sin `release` redundante**. | T-04c |
| **HU-04 CA-4** — una sola sesión por dueño y ambiente | Dos instancias del servicio contra `createSharedFakeCoordination()`: exactamente una llama `logon`; la otra 0 `connect` y 0 `logon`. | T-04d |
| **HU-04 CA-5** *(issue-2)* — el crédito nunca queda retenido | Tabla de fallos: `connect` rechaza; `time` rechaza; `logon` rechaza (transitorio y `-1022`); `subscribe` rechaza; relogon rechaza; `session-lost`. En **cada** fila: `coordination.release` llamado 1 vez, `getOwnedCredentialKeys()` vacío, y en el sweep siguiente la **otra** instancia puede adquirir la credencial. | T-04e |
| **HU-04 CA-6** *(issue-3)* — el reintento crece y no inunda el log | Con `connect` fallando siempre y timers falsos: los instantes de intento respetan `base * 2^(n-1)` (con tolerancia de jitter ±20 %) y quedan acotados por `userStreamNegotiateMaxDelayMs`; los `warn` capturados **igualan la cantidad de intentos reales**, no la de ticks del sweep. | T-04f |
| **HU-04 CE-1** — rechazo ⇒ canal no sano | Tras el fallo, `getHealth(userId, env)` devuelve `DEGRADED`/`UNKNOWN`, nunca `HEALTHY`. | T-04g |
| **HU-05 CA-1** — estado observable | Tabla sobre `resolveUserDataStreamHealth`: `HEALTHY` / `DEGRADED(HEARTBEAT_STALE\|SESSION_AUTH_STALE)` / `UNKNOWN(NO_RECORD)`. | T-05a |
| **HU-05 CA-2** *(issue-5)* — la sonda cubre en degradado | **Test de comportamiento**, en `entry-fill-watch.service.spec.ts`: se publica un health record vencido en `rx:v1:uds:health:{u}:{env}` de la coordinación falsa (stream en `DEGRADED`), se emite un tick que cruza el nivel de una entrada RESTING y se assertea `settleFill` **1 llamada**. Complemento en la misma prueba: la coordinación falsa registra sus `getJson` y se assertea que `EntryFillWatchService` **no consultó ninguna clave `rx:v1:uds:health:`** — la ausencia de acoplamiento pasa de inspección manual a propiedad de runtime. | T-05b |
| **HU-05 CA-3** — el silencio no es salud | Variando **solo** `lastEventAtMs` en todo su rango (`null`, `now`, `now - 24 h`) el veredicto **no cambia**; moviendo `lastHeartbeatAtMs`/`lastSessionAuthAtMs` más allá de su umbral pasa a `DEGRADED` con la razón correspondiente. | T-05c |
| **HU-05 CA-4** — retoma sola | Con un `heartbeat` fresco y un `logon` exitoso vuelve a `HEALTHY` sin llamada manual. | T-05d |
| **HU-05 CE-1** — coordinación no disponible | `isHealthy() === false` ⇒ 0 `connect`, 0 `logon`, ningún crash, salud `UNKNOWN` ⇒ tratada como `DEGRADED`; con `isEnabled?.() === false` **no se loguea nada**. | T-05e |
| **HU-06 CA-1/CA-2/CE-1** — nada del material sensible se filtra | **Centinela en runtime, tres centinelas**: `apiKey = 'API-KEY-SENTINEL'`, PEM `'PRIVATE-KEY-SENTINEL'` y `sign()` devolviendo `'SIGNATURE-SENTINEL'`. Se recorre el ciclo completo (connect → time → logon → subscribe → evento → relogon → fallo de logon con `-1022` → shutdown) con spies sobre `Logger#log/warn/error/debug` y sobre `gateway.emitToUser`; assert: `JSON.stringify(args)` de **ninguna** llamada capturada contiene ninguno de los tres. Se ejercita explícitamente el camino de error, que es el propenso a volcar el request. Complementos: `JSON.stringify(signer) === '{}'`; `BinanceWsApiError.message` no contiene ninguno de los tres aunque el request que falló los llevara; y tabla sobre `redactWsApiRequest`. **Ningún string-matching sobre el texto fuente.** | T-06 |
| **HU-07 CA-1** — la suite pasa sin red | `pnpm nx run-many -t lint test --projects=api,data-fetcher,shared,analysis` verde sin variables de TESTNET; ningún test instancia `BinanceWsApiClient` contra un socket real (el harness queda *skipped*). | T-07a |
| **HU-07 CA-2/CA-3/CA-4** — evidencia TESTNET, nunca LIVE | §11.4. | T-07b |
| **HU-08 CA-1/CA-2** — sin clave, arranque normal y sonda | Resolver `ABSENT` para todas: `onModuleInit` resuelve sin lanzar, `tryAcquire` **0 llamadas**, `connect` 0, y un tick que cruza el nivel sigue produciendo `settleFill` por la sonda. | T-08a |
| **HU-08 CA-3** — un aviso, no un flood | Con `ABSENT` y timers falsos, avanzar 10 × `userStreamSweepIntervalMs`: **1** log capturado para esa credencial. Avanzar `userStreamMissingCredentialLogIntervalMs` + 1 tick: **2**. | T-08b |
| **HU-08 CA-4** — la ausencia es por credencial | Resolver `RESOLVED` para `user-A`/testnet y `ABSENT` para `user-B`/testnet: A hace `logon`, B no; ningún efecto de B sobre A. | T-08c |
| **HU-08 CE-1** — clave presente pero inválida | Tabla sobre `EnvUserStreamAuthCredentialResolver`: PEM corrupto ⇒ `INVALID/MALFORMED_PEM`; clave RSA ⇒ `INVALID/NOT_ED25519`; `_PATH` inexistente ⇒ `INVALID/UNREADABLE_KEY_FILE`. En el servicio: `INVALID` ⇒ 0 `tryAcquire`, 0 `connect`, sin excepción, salud `DEGRADED`, 1 log con cooldown. | T-08d |
| **HU-09 CA-1** *(issue-4)* — error del socket de usuario no voltea el proceso | `emitError(new Error('boom'))` sobre el doble **no lanza**; queda 1 `warn`; la salud no pasa a `HEALTHY`. | T-09a |
| **HU-09 CA-2** *(issue-4)* — ídem para el socket de mercado | `emitError` sobre el doble de `BinanceWsClient` en `market-stream.service.spec.ts` no lanza. | T-09b |
| **HU-09 CA-3** *(issue-8)* — las cachés no crecen sin límite | Resolver `userStreamResolverCacheSize + 50` configs/credenciales/executors distintos y assertear que el `size` de las tres estructuras **deja de crecer** en el máximo. Test directo de `BoundedTtlCache` (FIFO + expiración). | T-09c |
| **D-14 / pregunta abierta 1** — las dos envolturas | Tabla sobre `extractUserDataEvent`: `{event:{e:'executionReport',…}}` ⇒ evento; `{e:'executionReport',…}` ⇒ evento; `{event:{e:'outboundAccountPosition'}}` ⇒ ignorado; `{id,status,result}` ⇒ ignorado; `{}`, `null`, `[]`, `'texto'` ⇒ `null`. En el cliente: emitir cada una de las dos envolturas produce **un** `execution-report` idéntico. | T-14 |
| **D-11** — construcción de la firma | `buildSignaturePayload({timestamp:'2', apiKey:'A+B/C='})` ⇒ `'apiKey=A+B/C=&timestamp=2'` (orden ascendente, **sin percent-encoding**). Firma verificada contra `crypto.verify(null, payload, publicKey, sigBuffer)` con un par generado en el test. `createEd25519Signer` lanza con PEM RSA. | T-11 |
| **D-10** — correlación y timeouts del cliente | Respuestas fuera de orden se resuelven a su request; `status !== 200` rechaza con `BinanceWsApiError`; `requestTimeoutMs` rechaza y limpia la pendiente; el cierre del socket rechaza **todas** las pendientes; un frame con `id` desconocido no rompe el enrutamiento de eventos. | T-10 |
| **§5** — invariantes de umbrales | Test unitario sobre las 8 relaciones. | T-05t |

### 11.3 Cómo se corre la suite sin red

```bash
pnpm nx run-many -t lint test --projects=api,data-fetcher,shared,analysis
```

### 11.4 Verificación TESTNET — opt-in, local, nunca CI, nunca LIVE

**Archivo:** `libs/data-fetcher/src/lib/binance/binance-ws-api.testnet.spec.ts` (Vitest, misma
mecánica que el harness de REST: `dotenv` sin tocar `process.env`).

**Triple compuerta:**

1. `BINANCE_TESTNET_E2E === '1'`, si no ⇒ `describe.skip`.
2. `BINANCE_API_TESTNET_ED25519_KEY` **y** una de las dos formas de la privada presentes; si faltan
   ⇒ `describe.skip` con un mensaje que dice literalmente que **la corrida está bloqueada por
   ausencia de la credencial Ed25519, no por un defecto del transporte** (HU-07 CA-2).
3. **Aborto antes del primer frame** si `client.getBaseUrl() !== BINANCE_WS_API_TESTNET_URL`, y
   además si el `BinanceRestClient` del harness no apunta a `https://testnet.binance.vision`
   (HU-07 CA-4, RN-08).

**Secuencia (es lo que cuenta como evidencia — HU-07 CA-3):**

```
connect → time (offset) → logon → subscribe
  → colocar una entrada descansando con prefijo `ent-e2e-` que se llene (BinanceRestClient)
  → recibir un `execution-report` real y afirmar que toEntryFillStatus(report) !== null
  → RENOVACIÓN: logon otra vez sobre la conexión viva (assert status 200)
  → RECONEXIÓN: forzar el cierre del socket, esperar `connected`, re-logon + re-subscribe
  → recibir un segundo `execution-report` real después de la re-autenticación
  → unsubscribe → logout → disconnect
  → barrer `ent-e2e-*` y afirmar cero órdenes propias abiertas
```

**Se registra como evidencia en `cycles/cycle-02/artifacts/`:** cuál de las dos envolturas de D-14
usó Binance realmente, la forma del `result` de `session.logon` (redactada con
`redactWsApiRequest`), los `rateLimits` observados y el tiempo entre el fill y la llegada del evento.

```bash
set -a && source .env && set +a
BINANCE_TESTNET_E2E=1 pnpm nx test data-fetcher -- --run ws-api
```

> Recordatorio de la constitución de `apps/api`: si `NX_WORKSPACE_ROOT_PATH` está definida y no
> apunta al cwd, cualquier `nx …` corre contra **otro** repo sin error visible.

---

## 12. Dependencias externas

**Ninguna nueva.** `ws` (8.20.0) y `dotenv` (17.3.1) ya son dependencias del workspace;
`node:crypto` es del runtime (Node 22). No se agrega paquete npm, ni servicio externo, ni
infraestructura: Redis, Postgres y Bull quedan como están. No se abre ningún puerto nuevo.

---

## 13. Riesgos residuales y lo que quedó sin medir

1. **La forma exacta del `result` de `session.logon` — no medida.** Requiere la credencial Ed25519.
   Mitigación: el diseño depende **solo** de `status === 200` (§4.1) y no lee `result`. Riesgo
   residual: nulo para el funcionamiento; se registra el dato real en la corrida TESTNET.
2. **La envoltura del evento empujado — no medida.** Mitigación: D-14 acepta las dos formas
   plausibles, verificadas con dobles. Riesgo residual: que Binance use una **tercera** forma. Sería
   visible de inmediato en la corrida TESTNET (0 `execution-report` recibidos con el socket sano) y
   el arreglo es una rama más en `extractUserDataEvent`.
3. **El vencimiento de la autorización de sesión — no documentado ni medido.** Mitigación: techo
   autoimpuesto de 1 h con relogon cada 30 min (D-13). Si el vencimiento real fuera **más corto que
   30 minutos**, el síntoma sería un `-1193` en el `ping` o en el `subscribe`, que ya tiene camino de
   recuperación (renegociación completa) y solo costaría latencia. Bajar
   `userStreamRelogonIntervalMs` es un cambio de una constante, no un rediseño.
4. **El peso real de los métodos de la WebSocket API — parcialmente medido.** La sonda vio
   `REQUEST_WEIGHT limit 6000 / MINUTE` y `count: 3` tras tres requests. Con el consumo del ciclo (un
   `time` + un `logon` + un `subscribe` por conexión, un `ping` cada 3 min, un `logon` cada 30 min)
   el margen es de tres órdenes de magnitud. No se agrega limitador local: sería complejidad sin
   riesgo que mitigar. Se anota el `rateLimits` observado en la corrida TESTNET.
5. **Deuda preexistente que este ciclo hereda y no empeora** (declarada por el architect de cycle-01
   §14.2 y por `brief.out_of_scope`): `settleFill` hace el claim CAS y **después** crea `Position`,
   `Trade` y `bot_actions` **fuera de una transacción**. Si el proceso muere en el medio, la fila
   queda `FILLED` sin `Position` y ningún detector la vuelve a mirar. Existe hoy con la sonda y con
   la reconciliación; el stream no lo agranda ni lo achica. **Se registra, no se arregla acá**:
   corresponde un fix o un ciclo propio.
6. **`SettleFillParams.config: any`** en `entry-order.service.ts` queda como está: tiene tres
   llamadores fuera del alcance de este ciclo. Lo que este ciclo garantiza es que **su** lado del
   contrato está tipado (D-19).

---

## 14. Registros SDD tocados por el architect

| Registro | Estado |
| --- | --- |
| `sdd/api.json` | **No modificado** — el ciclo no agrega ni cambia endpoints (§7). |
| `sdd/schema.json` | **No modificado** — sin tablas, columnas, índices ni enums nuevos (§7). |
| `sdd/components.json` | **No modificado** — la SPA no se toca (§7). |
| `cycle.json`, `tasks.json`, `global.json`, `specs/index.json` | No tocados — los escribe el orquestador / el reviewer. |
