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

### Cycle-02 — La plataforma en el aire *(Fases 4-5)*

4. Migración de datos desde Railway con verificación de conteos, y **borrado de las cuatro cuentas
   de la semilla** (hallazgo H).
5. API en producción: imagen en GHCR, compose en el VPS, nginx con **certificado Let's Encrypt
   emitido en el propio servidor** (DEC-DOM, no un Origin Certificate de Cloudflare),
   `TRUST_PROXY_HOPS` real, y el **health check convertido en verificación real** de base y Redis
   (hallazgo D).

### Cycle-03 — Frontend y corte *(Fases 6-7)*

6. SPA en Cloudflare Pages, resolviendo la inconsistencia de `VITE_API_URL` (hallazgo E) y con el
   **WebSocket funcionando detrás de nginx** (hallazgo F).
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
- **La migración de datos se verifica por conteos**, no por ausencia de error: usuarios, configs,
  posiciones (91), trades y decisiones.
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
| CA-004 | 4 | Los conteos coinciden con Railway y las cuatro cuentas demo no están. |
| CA-005 | 5 | `/api/health` responde por HTTPS **verificando base y Redis**, y se puede iniciar sesión con una cuenta real. |
| CA-006 | 6 | La SPA carga, inicia sesión y **el WebSocket conecta**. |
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

## 8. Riesgos

| Riesgo | Por qué |
| --- | --- |
| **La migración de datos** | Es el paso irreversible. Por eso los backups van antes. |
| **Disco de 40 GB** | Dumps transitorios + embeddings crecientes, sin posibilidad de achicar. |
| **WebSocket tras nginx** | Sin configuración explícita de upgrade, el frontend conecta y se cae en silencio. Sin referencia en `display-ads`. |
| **Renovación del certificado** | Let's Encrypt dura 90 días (DEC-DOM). Si la renovación automática falla y nadie mira, el sitio deja de cargar. Un Origin Certificate de Cloudflare habría durado años. |
| **Reinicio a mitad de ciclo** | El código re-encola al arrancar los bots marcados como corriendo, pero **no se probó bajo reinicio real** con dinero en juego. |
| **CI se pone en rojo al mergear** | Los gates ahora bloquean (lint, typecheck, `typecheck:api`, `test:all`). E2E corre en push a `main` y **nunca corrió en Actions**: es probable que la primera corrida encuentre algo. |
