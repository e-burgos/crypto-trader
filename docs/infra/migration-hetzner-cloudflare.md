# Migración de infraestructura — Railway + GitHub Pages → Hetzner + Cloudflare

> Estado: **plan aprobado, sin ejecutar.** Escrito el 2026-08-31 al cierre del trabajo de código.
> Referencia real: `e-burgos/display-ads`, que ya corre exactamente este stack en producción.

---

## 0. Antes de tocar nada

**Hay una acción urgente pendiente que no depende de la migración.** La base de producción actual
tiene cuatro cuentas creadas por la semilla, con contraseñas escritas en claro en el repositorio:

| Cuenta | Rol |
| --- | --- |
| `admin@crypto.com` | ADMIN |
| `admin@cryptotrader.dev` | ADMIN |
| `trader@crypto.com` | TRADER |
| `trader@cryptotrader.dev` | TRADER |

`FIX-e-burgos-006` impide que se vuelvan a crear, pero **no toca las existentes**. Desactivarlas
desde el panel de admin corta el acceso: `login` y `refresh` verifican `isActive`, y el access token
vive 15 minutos. En la migración conviene borrarlas de verdad, no solo desactivarlas.

---

## 1. De dónde partimos

Todo el trabajo de código está en `main`. Lo relevante para la migración:

- **La validación de entorno es bloqueante.** `apps/api/src/common/config/env.config.ts` exige
  `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` y `BINANCE_KEY_ENCRYPTION_KEY` (32 caracteres
  exactos). Si falta una, **la API no arranca** y dice cuál. Esto es nuevo: antes arrancaba con
  secretos por defecto públicos.
- **`TRUST_PROXY_HOPS` existe y está en 0.** Detrás del proxy de Cloudflare o de nginx hay que
  ponerlo en el número real de saltos, o el rate limiting de auth agrupa todo el tráfico en un solo
  bucket.
- **CI ahora bloquea de verdad**: lint, typecheck, `typecheck:api` y `test:all` (1126 tests en 7
  proyectos). E2E corre en push y PR a `main`.
- **La base necesita pgvector.** La migración `20260413130000_add_agent_definitions_rag` hace
  `CREATE EXTENSION vector`. Con `postgres:16-alpine` muere con `P3018`. Es la razón por la que CI
  pasó a `pgvector/pgvector:pg16`.
- **La semilla ya no crea cuentas demo en producción**, con dos cerrojos: `NODE_ENV=production` y
  `SEED_DEMO_ACCOUNTS=false` fijado en el `CMD` del Dockerfile. Sí sigue sembrando datos de
  referencia (definiciones de agentes, proveedores LLM, fuentes de datos) que se leen en runtime.

---

## 2. Topología destino

| Capa | Dónde | Nota |
| --- | --- | --- |
| API NestJS | Hetzner, contenedor Docker | detrás de nginx |
| PostgreSQL + pgvector | Hetzner, contenedor | red interna, **sin puerto público** |
| Redis | Hetzner, contenedor | red interna |
| Frontend React | Cloudflare Pages | SPA estática |
| DNS / TLS | Cloudflare | Full Strict + Origin Certificate |
| Backups de la base | Cloudflare R2 | bucket **privado**, retención por lifecycle |
| Mail | Resend | dominio propio verificado |
| Imágenes Docker | GHCR | `ghcr.io/e-burgos/crypto-trader-api` |
| CI/CD | GitHub Actions | deploy por push a `main` con filtro de paths |

---

## 3. Qué se copia de display-ads

`display-ads` corre este stack desde junio de 2026 y **su base está autoalojada desde el 2026-08-24**,
después de que Neon agotara su cuota de compute y tumbara la plataforma seis días. Ese postmortem
(`docs/infra/neon-compute-quota-incident.md`) es el argumento a favor de autoalojar la base acá también.

**Se copia casi tal cual:**

- `infra/scripts/db-backup.sh` y `db-restore.sh` — dump a disco, subida a R2 con un contenedor
  efímero de `rclone`, sin instalar nada en el servidor. Incluye la guarda **H-9**, que rechaza
  cualquier bucket cuyo nombre contenga `media`: es la protección contra subir dumps a un bucket
  público. Traen sus propios tests de shell (`db-backup.test.sh`, `db-restore.test.sh`).
- `infra/scripts/db-backup-cron-install.sh` — instalación del cron.
- `infra/nginx/nginx.conf` — reverse proxy.
- `docker-compose.prod.yml` — orquestación en el VPS.
- El patrón de `deploy-api.yml`: **las suites de shell corren antes de construir nada**. Si el
  script de backup está roto, no hay deploy.

**Se adapta:**

- El `Dockerfile` de la API ya existe en crypto-trader y funciona. Hay que sacarle el arrastre de
  `node_modules` completo del builder (incluye devDependencies) y cambiar el registry a GHCR.
- El compose necesita **Redis con persistencia** — crypto-trader lo usa para Bull, y perder la cola
  significa perder ciclos de agentes encolados. display-ads lo usa más como cache.

**Es nuevo, no hay de dónde copiarlo:**

- **WebSocket detrás de nginx.** crypto-trader tiene un gateway Socket.io con salas por usuario.
  Requiere `proxy_set_header Upgrade` / `Connection` y timeouts largos. display-ads no lo tiene.
- **Worker de colas persistente.** El procesador de trading corre ciclos de agentes con dinero real.
  Si el contenedor se reinicia a mitad de un ciclo, hay que verificar que Bull lo recupere: el
  código ya re-encola al arrancar los bots marcados como corriendo, pero eso no se probó bajo
  reinicio real.
- **Resend.** display-ads lo tiene, pero **crypto-trader hoy no manda un solo mail**: las
  notificaciones son filas en la base más un evento WebSocket. Integrarlo es trabajo nuevo, no una
  migración. Conviene tratarlo como una spec aparte, después de que la infra esté en pie.

---

## 4. Lo que tenés que preparar

### Cuentas

| Servicio | Para qué | Decisión pendiente |
| --- | --- | --- |
| **Hetzner Cloud** | El servidor | ya lo estás contratando |
| **Cloudflare** | DNS, Pages, R2 | **¿qué cuenta?** display-ads centraliza todo en `displayadsdigital@gmail.com` y dejó `estebanburgos85@gmail.com` en decomiso |
| **Resend** | Mail | dominio a verificar; puede esperar |
| **GitHub** | GHCR + Actions | ya está |
| **Registrador del dominio** | Apuntar nameservers a Cloudflare | ¿qué dominio para crypto-trader? |

### Credenciales

Generalas vos; yo no las necesito escritas en el chat, solo poder usarlas desde tu máquina.

1. **Clave SSH dedicada** a este proyecto — no reutilices una existente, así la podés revocar sola.
2. **Token de API de Hetzner**, con alcance de proyecto.
3. **Tres tokens de Cloudflare distintos**, porque uno no cubre los tres usos:
   - `Account → Cloudflare Pages → Edit` para el deploy del frontend.
   - Token de R2 acotado al bucket de backups (access key + secret).
   - Un token de cuenta aparte **solo para aplicar las reglas de lifecycle** del bucket. El token
     del bucket no alcanza. Es de un solo uso, pero si no lo tenés a mano te trabás.
4. **API key de Resend**, de envío, no de administración de cuenta.
5. **Acceso a la base de Railway** para el dump — es lo que más importa: ahí están tus 2 configs y
   tus 91 posiciones.

---

## 5. Fases

Cada fase termina con algo verificable. No se pasa a la siguiente sin eso.

### Fase 1 — Servidor en pie
Provisionar el CX23, aplicar el firewall de Hetzner (solo 22, 80, 443), crear usuario no-root con la
clave SSH, instalar Docker. **Hecho cuando:** entrás por SSH sin contraseña y `docker run hello-world`
corre.

> **El disco es la restricción a mirar.** display-ads corre este mismo stack en 80 GB, y encima
> hospeda una app Next.js que crypto-trader no tiene. Con 40 GB debería alcanzar, pero los dumps se
> escriben en disco antes de subir a R2 y el script conserva las dos últimas copias por base. Con
> los embeddings del RAG creciendo, es el número a vigilar. Hetzner deja escalar hacia arriba, nunca
> hacia abajo.

### Fase 2 — Base y Redis, sin tráfico
Levantar `pgvector/pgvector:pg16` y Redis en la red interna de Docker, **sin puertos publicados**.
Correr las 37 migraciones con `prisma migrate deploy`. **Hecho cuando:** `prisma migrate status` dice
que está al día y `CREATE EXTENSION vector` no falló.

### Fase 3 — Backups antes que datos
Portar los scripts de backup y restore con sus tests. Crear el bucket privado en R2, configurar las
reglas de lifecycle, instalar el cron. **Hecho cuando:** corriste un backup, lo bajaste, y lo
**restauraste en una base descartable**. Un backup que nunca se restauró no es un backup.

> Esta fase va **antes** de migrar los datos a propósito. Es la red para la fase 4.

### Fase 4 — Migrar los datos
Dump de Railway, restore en Hetzner, verificar conteos: usuarios, configs, posiciones (91), trades,
decisiones. **Borrar las cuatro cuentas de la semilla.** **Hecho cuando:** los conteos coinciden y
las cuentas demo no están.

### Fase 5 — API en el aire
Construir la imagen, publicarla en GHCR, levantarla con el compose. nginx con TLS de Cloudflare
Origin Certificate. `TRUST_PROXY_HOPS` en el valor real. **Hecho cuando:** `/api/health` responde por
HTTPS y podés loguearte con tu cuenta real.

> El health check actual **no verifica nada** — devuelve `{status:'ok'}` fijo sin mirar base ni
> Redis. Con Railway eso era una alerta media; acá pasa a ser peor, porque es lo que va a decidir si
> un contenedor reiniciado está sano. Conviene arreglarlo en esta fase.

### Fase 6 — Frontend en Cloudflare Pages
Build y deploy, variables de entorno, dominio. **Acá se resuelve la inconsistencia de
`VITE_API_URL`** que quedó anotada: el cliente asume que la URL incluye `/api`, y compose y CI la
pasan sin el prefijo. **Hecho cuando:** la SPA carga, se loguea y el WebSocket conecta.

### Fase 7 — Corte
Apuntar el DNS, verificar que el bot opera contra la base nueva, dar de baja Railway.
**Hecho cuando:** un ciclo de agente completo corre en Hetzner y queda registrado.

### Fase 8 — Lo que quedó pendiente
Observabilidad (hoy no hay métricas, ni tracing, ni seguimiento de errores), Resend, y la decisión
de RPO.

---

## 6. Decisiones abiertas

1. **RPO.** El esquema de display-ads son cuatro backups por día: se pueden perder hasta 6 horas y
   no hay recuperación a un punto en el tiempo. Para una plataforma que ejecuta órdenes con dinero
   real, hay que decidir si eso alcanza. La alternativa es archivado continuo de WAL a R2, que es
   trabajo nuevo.
2. **Qué cuenta de Cloudflare.**
3. **Dominio** de crypto-trader.
4. **Redis y las colas.** Es dependencia dura de Bull sin degradación definida: si Redis no está,
   las colas dejan de procesar en silencio. Decidir si eso se monitorea o se mitiga.

---

## 7. Riesgos

| Riesgo | Por qué |
| --- | --- |
| **La migración de datos** | Es el paso irreversible. Por eso los backups van antes. |
| **Disco de 40 GB** | Dumps transitorios + embeddings crecientes. Vigilar desde el día uno. |
| **WebSocket tras nginx** | Sin configuración explícita de upgrade, el frontend conecta y se cae en silencio. No hay referencia en display-ads. |
| **Reinicio a mitad de ciclo** | Un contenedor que se reinicia mientras un bot opera. El código re-encola al arrancar, pero no se probó bajo reinicio real. |
| **CI se pone en rojo al mergear** | Los gates ahora bloquean. E2E corre en push a `main` y nunca corrió en Actions: es probable que la primera corrida encuentre algo. |
