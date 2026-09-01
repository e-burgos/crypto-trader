# Spec e-burgos-008 — Migración de infraestructura a Hetzner y Cloudflare

> Autor: e-burgos | Creada: 2026-08-31 | App principal: `apps/api`
> Plan de origen: [`docs/infra/migration-hetzner-cloudflare.md`](../../../docs/infra/migration-hetzner-cloudflare.md)
> Referencia en producción: `e-burgos/display-ads` (mismo stack desde junio 2026)

---

## 1. Contexto y diagnóstico

La plataforma corre hoy sobre **Railway** (API + Postgres) y **GitHub Pages** (SPA). Se migra a
un **VPS de Hetzner** con todo autoalojado detrás de nginx, más **Cloudflare** para Pages y
almacenamiento de backups en R2. El DNS y el TLS quedan fuera de Cloudflare — ver **DEC-DOM** (§7).

### Por qué ahora

El argumento no es de costo sino de **control del punto de falla**. `display-ads` corría su base
en Neon hasta que el proyecto agotó la cuota mensual de compute y **tumbó la plataforma entera
durante 6 días** (`ERROR 53000`); el corte a Postgres autoalojado se hizo el 2026-08-24 a costo
cero. Ese postmortem (`docs/infra/neon-compute-quota-incident.md` de aquel repo) es el
antecedente directo: una plataforma que ejecuta órdenes con dinero real no puede depender de una
cuota de terceros que se agota sin aviso.

### Hallazgos verificados sobre el estado de partida

- **A — La validación de entorno es bloqueante.** `apps/api/src/common/config/env.config.ts` exige
  `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` y `BINANCE_KEY_ENCRYPTION_KEY` (32 caracteres
  exactos). Si falta una, la API **no arranca**. Cualquier `.env.production` incompleto es un
  contenedor que no levanta, no un servicio degradado.
- **B — `TRUST_PROXY_HOPS` está en 0.** Detrás de nginx y Cloudflare hay que fijarlo al número real
  de saltos, o el rate limiting de auth agrupa todo el tráfico en un solo bucket.
- **C — La base necesita pgvector.** La migración `20260413130000_add_agent_definitions_rag` hace
  `CREATE EXTENSION vector`; con `postgres:16-alpine` muere con `P3018`. La imagen debe ser
  `pgvector/pgvector:pg16`.
- **D — El health check no verifica nada.** Devuelve `{status:'ok'}` fijo sin mirar base ni Redis.
  En Railway era una alerta media; acá pasa a decidir si un contenedor reiniciado está sano.
- **E — `VITE_API_URL` es inconsistente.** El cliente asume que la URL incluye `/api`; el compose y
  el CI la pasan sin el prefijo.
- **F — El WebSocket no tiene precedente.** El gateway Socket.io con salas por usuario requiere
  `proxy_set_header Upgrade`/`Connection` y timeouts largos en nginx. `display-ads` no tiene
  WebSocket: no hay de dónde copiarlo.
- **G — Redis es dependencia dura sin degradación definida.** Si Redis no está, las colas de Bull
  dejan de procesar **en silencio**. En `display-ads` Redis es cache; acá sostiene los ciclos de
  agentes encolados.
- **H — Cuatro cuentas de la semilla siguen vivas en producción** con contraseñas en claro en el
  repositorio. `FIX-e-burgos-006` impide recrearlas pero no toca las existentes.

## 2. Objetivo

Dejar la plataforma corriendo íntegramente sobre Hetzner + Cloudflare, con la base autoalojada y
respaldada fuera del servidor, sin perder ningún dato de producción y sin que el bot deje de
operar más de lo que dure el corte planificado.

## 3. Alcance por ciclo

Las **8 fases del plan** son los criterios de aceptación (§6). Los ciclos las agrupan por unidad
desplegable; cada fase conserva su propio "hecho cuando" y ninguna se da por cerrada sin él.

### Cycle-01 — Servidor, datos y red de seguridad *(Fases 1-3)*

1. **Servidor en pie.** CX23 provisionado, firewall de Hetzner, usuario no-root con clave
   dedicada, Docker. Todo el provisioning como **script idempotente versionado** — no como pasos
   ejecutados a mano.
2. **Base y Redis sin tráfico.** `pgvector/pgvector:pg16` y Redis en la red interna de Docker,
   **sin puertos publicados**, con las 37 migraciones aplicadas. Redis **con persistencia**: a
   diferencia de `display-ads`, acá perder la cola significa perder ciclos de agentes encolados.
3. **Backups antes que datos.** Scripts de backup y restore portados con sus suites de shell,
   bucket privado en R2, reglas de lifecycle y cron. Se porta la guarda **H-9**, que rechaza
   cualquier bucket cuyo nombre contenga `media` — es la protección contra subir dumps a un
   bucket público.

> **Por qué los backups van antes de migrar los datos.** La Fase 4 es el paso irreversible. Un
> backup que nunca se restauró no es un backup: el criterio de cierre exige haber restaurado en
> una base descartable, no haber corrido el script.

### Cycle-02 — La plataforma en el aire *(Fase 5; la Fase 4 queda cancelada)*

4. ~~Migración de datos desde Railway.~~ **CANCELADA 2026-09-01 — ver DEC-DATOS (§7).**
5. API en producción: imagen en GHCR, compose en el VPS, nginx con **certificado Let's Encrypt
   emitido en el propio servidor** (DEC-DOM, no un Origin Certificate de Cloudflare),
   `TRUST_PROXY_HOPS` real, el **health check convertido en verificación real** de base y Redis
   (hallazgo D), y un **único usuario `ADMIN` provisionado desde el entorno** (DEC-ADMIN, §7).

### Cycle-03 — Frontend y corte *(Fases 6-7; la Fase 6 se adelantó a cycle-02)*

6. ~~SPA en Cloudflare Pages.~~ **REEMPLAZADA 2026-09-01 — ver DEC-PAGES (§7).** La SPA se sirve
   desde el VPS, en el mismo origen que la API. Ejecutado en cycle-02.
7. Alta del registro `A trader` en Hostinger y emisión del certificado (DEC-DOM reescribe esta
   fase: no hay corte de DNS en Cloudflare), verificación de un ciclo de agente completo contra la
   base nueva, baja de Railway.

### Cycle-04 — Lo que la migración deja abierto *(Fase 8)*

8. Observabilidad (hoy no hay métricas, ni tracing, ni seguimiento de errores) y la decisión de
   RPO (§7). **Resend queda fuera de esta spec** (§4).

## 4. No-objetivos (fuera de esta spec)

| Excluido | Por qué / dónde va |
| --- | --- |
| Integración de Resend | crypto-trader **hoy no manda un solo mail**: las notificaciones son filas en la base más un evento WebSocket. Es trabajo nuevo, no migración. Spec aparte. |
| Rediseño del esquema de datos | La migración mueve datos, no los transforma. |
| Kubernetes, orquestación multi-nodo | Un CX23 con compose es lo que el volumen justifica. |
| Alta disponibilidad / réplicas de Postgres | Requiere segundo servidor; se evalúa cuando el RPO lo exija. |
| Cambios de comportamiento de trading | Ninguna fase toca la lógica de decisión ni de ejecución de órdenes. |

## 5. Restricciones de diseño (no negociables)

- **La base nunca expone puerto público.** Postgres y Redis viven en la red interna del compose;
  el único ingreso al servidor son 22, 80 y 443.
- **Ningún secreto en el repositorio.** `.env.production` vive solo en el VPS y se genera desde
  GitHub Secrets en cada deploy. El repo versiona `.env.example`, nunca valores.
- **Todo el provisioning es reproducible.** Se descartaron los backups de Hetzner (decisión del
  dev, 2026-08-31), así que la configuración del servidor **solo existe en git**: cada paso va como
  script idempotente. Es la falla concreta de `display-ads`, cuyo `infrastructure.md` describe el
  estado final pero nunca cómo se llegó.
- **El firewall se administra fuera de la VM.** Se usa el firewall de Hetzner, no `ufw`: si una
  regla deja al dev afuera, se corrige desde el panel. Una regla de `ufw` mal puesta es un
  servidor perdido.
- **Un backup no restaurado no cuenta.** Ningún criterio de backup se cierra corriendo el script;
  se cierra restaurando en una base descartable y verificando.
- ~~La migración de datos se verifica por conteos.~~ Sin objeto tras DEC-DATOS.
- **El disco es 40 GB y no se puede achicar.** Hetzner escala solo hacia arriba. Los dumps se
  escriben en disco antes de subir a R2 y los embeddings del RAG crecen: es el número a vigilar
  desde el día uno.

## 6. Criterios de aceptación de la spec

Uno por fase, tomados literalmente del plan de origen.

| ID | Fase | Criterio |
| --- | --- | --- |
| CA-001 | 1 | Se entra por SSH sin contraseña y `docker run hello-world` corre. |
| CA-002 | 2 | `prisma migrate status` dice que está al día y `CREATE EXTENSION vector` no falló. |
| CA-003 | 3 | Se corrió un backup, se bajó y se **restauró en una base descartable**. |
| ~~CA-004~~ | 4 | **ANULADO** por DEC-DATOS. La base arranca vacía; las cuentas demo nunca se provisionan en producción (`NODE_ENV=production`). Lo reemplaza CA-004b. |
| CA-004b | 5 | Existe **exactamente un** usuario `ADMIN`, provisionado desde `ADMIN_USERNAME`/`ADMIN_PASSWORD`, y se puede iniciar sesión con él. |
| CA-005 | 5 | `/api/health` responde por HTTPS **verificando base y Redis**, y se puede iniciar sesión con una cuenta real. |
| CA-006 | 6 | La SPA carga, inicia sesión y **el WebSocket conecta**. *(Servida desde el VPS — DEC-PAGES.)* |
| CA-007 | 7 | Un ciclo de agente completo corre en Hetzner y queda registrado. |
| CA-008 | 8 | La decisión de RPO está tomada y registrada, y hay observabilidad mínima de la API. |

## 7. Decisiones abiertas

1. **RPO.** El esquema de `display-ads` son cuatro backups por día: se pueden perder hasta 6 horas
   y no hay recuperación a un punto en el tiempo. Para una plataforma que ejecuta órdenes con
   dinero real hay que decidir si alcanza. La alternativa es archivado continuo de WAL a R2, que
   es trabajo nuevo. **Se resuelve en cycle-01, porque condiciona el diseño de los backups.**
2. ~~**Qué cuenta de Cloudflare.**~~ **RESUELTA 2026-08-31: `cryptotradereb@gmail.com`.** Es la
   cuenta por defecto del proyecto. Se usa para **R2 y Pages** (recursos de cuenta, no requieren
   zona). Token `crypto-trader-ops` creado y verificado.
3. ~~**Dominio.**~~ **RESUELTA 2026-08-31: `trader.estebanburgos.com.ar`**, con una consecuencia
   que reescribe la Fase 7 — ver DEC-DOM más abajo.

### DEC-DOM — El subdominio NO va detrás del proxy de Cloudflare *(2026-08-31)*

Verificado empíricamente, no asumido:

- El DNS de `estebanburgos.com.ar` lo sirve **Hostinger** (`nebula`/`aurora.dns-parking.com`), no
  Cloudflare. El certificado del apex es un **Let's Encrypt** provisionado por Hostinger, **no** un
  Origin Certificate: no había nada que extraer.
- El dominio tiene **correo activo** en Hostinger (`mx1`/`mx2.hostinger.com`, SPF, `autodiscover`).
  Mover los nameservers a Cloudflare lo arrastra, y ese riesgo no se justifica por un subdominio.
- Se intentó delegar **solo** `trader.estebanburgos.com.ar` como zona propia: Cloudflare responde
  **error 1116** — no admite zonas de subdominio en esta cuenta.

**Decisión:** el DNS queda en Hostinger; se agrega un registro `A trader` al VPS y **nginx sirve un
certificado Let's Encrypt emitido y renovado en el propio servidor** (certbot).

**Consecuencias que hay que asumir, no minimizar:**

| Consecuencia | Impacto |
| --- | --- |
| **La IP del origen queda expuesta** | Sin proxy de Cloudflare, `trader.*` resuelve directo al VPS. No hay WAF ni mitigación de DDoS delante. |
| **80/443 se abren a `0.0.0.0/0`** | Queda **sin efecto** la decisión previa de acotarlos a los rangos de Cloudflare: si nadie proxea, no hay rango que permitir. El puerto 80 además es necesario para el desafío HTTP-01 de Let's Encrypt. |
| **La Fase 7 se reescribe** | Deja de ser "corte de DNS en Cloudflare" y pasa a ser "alta del registro A en Hostinger + emisión del certificado". |
| **Renovación del certificado pasa a ser nuestra** | Un Origin Certificate de Cloudflare dura años; uno de Let's Encrypt, 90 días. La renovación automática se vuelve parte de la infraestructura que hay que monitorear: **si falla, el sitio deja de cargar.** |

**Cloudflare sigue en el stack** para lo que no necesita zona: **R2** (backups, Fase 3) y **Pages**
(la SPA, Fase 6, con un `CNAME` desde Hostinger).
4. **Degradación de Redis.** Si Redis no está, las colas dejan de procesar en silencio (hallazgo
   G). Decidir si se monitorea o se mitiga. Se resuelve junto con CA-008.

### DEC-DATOS — La Fase 4 se cancela: se arranca con la base vacía *(2026-09-01)*

Railway quedó inaccesible. Verificado, no asumido: el CLI y la mutación `serviceInstanceRedeploy`
de la API GraphQL devuelven **`"Your trial has expired. Please select a plan to continue using
Railway."`** — no es una factura impaga sino el trial vencido, y bloquea todo despliegue.

Estado comprobado del proyecto en Railway:

| Hecho | Valor |
| --- | --- |
| Proyecto | `deletedAt: null` — no fue eliminado |
| Volumen `postgres-volume` | `READY`, 362 MB — **los datos están intactos** |
| Deployments de Postgres | todos `REMOVED` |
| PITR (backups continuos) | **deshabilitado**, sin bucket conectado |
| Backups de volumen | 2, automáticos de Railway (2026-08-06 y 2026-08-23) |

**No existe vía técnica para extraer los datos sin levantar el Postgres**, y no se puede levantar
sin elegir un plan. Los backups de volumen **no** sirven como exportación: `volumeInstanceBackupRestore`
restaura *dentro del mismo volumen* pisando su contenido, no entrega un archivo — y aun restaurado,
haría falta un Postgres corriendo para leerlo.

**Decisión del dueño (2026-09-01): los datos eran de prueba y no se rescatan.** La plataforma
arranca con la base vacía en Hetzner, que ya tiene las 37 migraciones aplicadas y `vector` instalada.

**Consecuencias:**

- **CA-004 queda anulado** y lo reemplaza CA-004b (el usuario `ADMIN` desde el entorno).
- Desaparece el paso irreversible del plan, y con él su riesgo. El corte de la Fase 7 deja de ser
  una ventana con el bot detenido y pasa a ser un cambio de DNS.
- El hallazgo H (cuatro cuentas de la semilla vivas en producción) **se resuelve solo**: la base
  nace vacía y `seedDemoAccounts` no corre con `NODE_ENV=production`.
- Se pierde el historial de `AgentDecision` y sus evaluaciones, o sea la materia prima del
  scorecard. Los agentes arrancan sin historial contra el cual comparar. Asumido a conciencia.

> **Esto es el argumento de la migración, no una nota al pie.** La plataforma quedó inaccesible por
> una condición comercial, no por un fallo técnico — el mismo patrón que el incidente de Neon que
> tumbó a `display-ads` seis días. En Hetzner la base corre en un servidor propio y los dumps van
> cada hora a un bucket propio, con un restore ya verificado (CA-003).

### DEC-ADMIN — Un único `ADMIN` provisionado desde el entorno *(2026-09-01)*

`UserRole` sólo tiene `TRADER | ADMIN`: **no existe un rol `SUPERADMIN`** en el esquema ni el
concepto en el código. "Superadmin" acá es el único usuario con rol `ADMIN`.

- Se provisiona desde `ADMIN_USERNAME` (un email; `LoginDto` valida con `@IsEmail()`) y
  `ADMIN_PASSWORD`, con hash bcrypt de 12 rondas, igual que el resto de la semilla.
- **Converge en cada corrida**: rotar la contraseña es cambiar el secret y redesplegar — mismo
  patrón que el rol de aplicación en `00-init.sql`.
- **Fail-closed en producción**: sin esas variables la semilla aborta. El `CMD` del Dockerfile corre
  `prisma db seed` antes de arrancar la API, así que el contenedor no levanta. Una API en producción
  sin forma de entrar no es un servicio degradado.
- Si aparecen **otros** usuarios `ADMIN`, se reportan con un warning pero **no se borran**: un seed
  que borra usuarios termina borrando al equivocado.

### DEC-PAGES — La SPA se sirve desde el VPS, no desde Cloudflare Pages *(2026-09-01)*

El plan preveía la SPA en Cloudflare Pages. Se descarta al resolver una pregunta más básica: **qué
responde `https://trader.estebanburgos.com.ar/`**. Con sólo la API desplegada devolvía 404, porque
la API tiene prefijo global `api`.

Decisión del dueño: la raíz sirve la web y la API vive en `/api/`. Eso vuelve incompatible a Pages,
que se quedaría con todo el dominio.

**Servir la SPA desde el mismo nginx del VPS resuelve más de lo que cuesta:**

| Beneficio | Por qué importa acá |
| --- | --- |
| **Cero CORS** | Mismo origen: sin preflight y sin una lista de orígenes que se desincronice del despliegue. |
| **Un solo certificado** | La renovación ya es infraestructura propia (DEC-DOM); dos dominios serían dos cadenas que vigilar. |
| **WebSocket same-origin** | El handshake de Socket.io deja de ser cross-origin, una cosa menos que pueda fallar (hallazgo F). |
| **Un solo despliegue** | Front y API salen juntos; no hay ventana donde una SPA nueva hable con una API vieja. |

**Costo asumido:** el VPS sirve los estáticos (carga despreciable) y se pierde la CDN de Pages. Para
un panel de trading de un solo operador, la latencia del estático no es el problema a optimizar.

**Cloudflare queda en el stack sólo para R2** (backups). Pages y DNS no se usan.

**Lo que destapó implementarlo — el hallazgo E era peor de lo documentado.** `VITE_API_URL` se
usaba con **dos significados contradictorios**: `lib/api.ts` y `use-chat.ts` la esperan **con** el
prefijo `/api`; `use-websocket.ts` la esperaba **sin** él. Con un único valor, el cliente negociaba
el namespace `/api/ws`, que el gateway no sirve, y **el socket conectaba y fallaba en silencio**. Se
resolvió derivando el origen del WebSocket a partir de la base REST, con `VITE_WS_URL` como escape.

Además, `apps/web/Dockerfile` estaba roto de antes: hacía `COPY apps/web/package.json`, archivo que
no existe en este monorepo. **Ningún workflow construía esa imagen**, así que nunca se detectó.

## 8. Riesgos

| Riesgo | Por qué |
| --- | --- |
| ~~La migración de datos~~ | Eliminado: la Fase 4 quedó cancelada (DEC-DATOS). El riesgo del paso irreversible desaparece con ella. |
| **Disco de 40 GB** | Dumps transitorios + embeddings crecientes, sin posibilidad de achicar. |
| **WebSocket tras nginx** | Sin configuración explícita de upgrade, el frontend conecta y se cae en silencio. Sin referencia en `display-ads`. |
| **Renovación del certificado** | Let's Encrypt dura 90 días (DEC-DOM). Si la renovación automática falla y nadie mira, el sitio deja de cargar. Un Origin Certificate de Cloudflare habría durado años. |
| **Reinicio a mitad de ciclo** | El código re-encola al arrancar los bots marcados como corriendo, pero **no se probó bajo reinicio real** con dinero en juego. |
| **CI se pone en rojo al mergear** | Los gates ahora bloquean (lint, typecheck, `typecheck:api`, `test:all`). E2E corre en push a `main` y **nunca corrió en Actions**: es probable que la primera corrida encuentre algo. |
