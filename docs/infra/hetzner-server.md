# Servidor de producción — Hetzner CX23

> spec-e-burgos-008 · TASK-003 · Estado verificado 2026-09-01
> Documento operacional: refleja lo que está desplegado, no lo que se planeó.

Todo lo que hay acá fue **medido en el servidor**, no copiado del plan.

## 1. El servidor

| Parámetro | Valor |
| --- | --- |
| Plan | **CX23** — 2 vCPU · 4 GB RAM · 40 GB NVMe |
| ID de Hetzner | `164138483` |
| Nombre | `ubuntu-4gb-hel1-2` |
| Ubicación | **Helsinki, Finlandia** (`hel1`, zona `eu-central`) |
| IPv4 | `2.29.24.221` |
| IPv6 | `2a01:4f9:c015:64c1::/64` |
| SO | **Ubuntu 26.04.1 LTS** (`resolute`), kernel 7.0.0-30, x86_64 |
| Costo | **€6,49/mes** |
| Backups de Hetzner | **Deshabilitados** — decisión del dueño (§6) |

> **Por qué importa el SO:** es 26.04, no 24.04 como `display-ads`. Docker publica repo para
> `resolute`, verificado antes de instalar. Los scripts de provisioning toman el codename **del
> propio SO** en vez de fijarlo, para que sigan sirviendo tras una actualización.

## 2. Acceso

| | |
| --- | --- |
| Autenticación | **Solo por clave.** `PasswordAuthentication no` |
| Clave | `crypto-trader-hetzner-202608` (ed25519), dedicada a este proyecto |
| Fingerprint | `SHA256:oo3Q5xNsdzbul7EWFbPVBaxYc2BMrEvEMlTkqjhzMaU` |
| Usuario de operación | **`deploy`** (uid 1000), `sudo` NOPASSWD, grupo `docker` |
| `root` | `prohibit-password` — accesible por clave, como camino de emergencia |

```bash
ssh crypto-trader          # root
ssh crypto-trader-deploy   # deploy
```

> **Camino de emergencia.** Si se pierde la clave privada o el firewall deja al operador afuera,
> la vuelta es la **consola web de Hetzner**, que no pasa por `sshd`, con la contraseña de root
> (`HETZNER_PASSWORD`). Por eso esa contraseña **se conserva** aunque ya no sirva para SSH.

## 3. Firewall

Firewall **de Hetzner**, no `ufw`: vive fuera de la VM, así que una regla equivocada se corrige
desde el panel sin necesidad de entrar. Una regla de `ufw` mal puesta es un servidor perdido.

| Regla | Origen |
| --- | --- |
| TCP **22** | `181.87.108.160/32` — solo la IP del operador |
| TCP **22** | `<ip-del-runner>/32`, regla **transitoria** `gh-runner-<run_id>` que `deploy.yml` agrega antes de copiar por SCP y elimina al terminar (`if: always()`), vía `HETZNER_API_TOKEN` (FIX-e-burgos-016). Si aparece una fuera de un deploy en curso, es residuo de una corrida abortada: borrarla |
| TCP **80** | `0.0.0.0/0`, `::/0` — desafío HTTP-01 y redirección a HTTPS |
| TCP **443** | `0.0.0.0/0`, `::/0` |
| ICMP | `0.0.0.0/0`, `::/0` |

Firewall `crypto-trader-prod`, id `11552165`.

> **La IP del operador es residencial y cambia.** Cuando eso pase, SSH deja de responder: se
> corrige editando la regla en el panel de Hetzner.
>
> **80 y 443 están abiertos a todo internet** porque `trader.estebanburgos.com.ar` **no** pasa por
> el proxy de Cloudflare (DEC-DOM): no hay rango que acotar. Es una diferencia deliberada con lo
> que el plan original preveía.

**No hace falta una regla que bloquee IPv6:** el firewall de Hetzner deniega por defecto todo lo
que no esté permitido, en ambas familias.

## 4. Servicios

Cinco contenedores. **Solo `nginx` publica puertos**; el resto vive en la red interna del compose.

| Servicio | Imagen | Puertos |
| --- | --- | --- |
| `nginx` | `nginx:alpine` | **80, 443** |
| `api` | `crypto-trader-api` | — interna |
| `web` | `crypto-trader-web` | — interna |
| `postgres` | `pgvector/pgvector:pg16` | — interna |
| `redis` | `redis:7-alpine` | — interna |

Verificado desde fuera del VPS: **5432, 6379 y 3000 no responden**. En el host, `ss` solo muestra
el 22 escuchando.

**Rutas públicas:** `/` → SPA · `/api/` → API · `/socket.io/` → WebSocket. Mismo origen, sin CORS.

## 5. Línea de base medida

Los números contra los cuales comparar cuando algo se degrade.

| Métrica | Valor | Medido |
| --- | --- | --- |
| Latencia a `api.binance.com` | **~263 ms** por request | 2026-09-01 |
| Latencia a `data-api.binance.vision` | ~1,07 s | 2026-09-01 |
| Drift de reloj contra Binance | **−140 ms** (`recvWindow` = 60.000 ms) | 2026-09-01 |
| NTP | sincronizado, `Etc/UTC` | 2026-09-01 |
| Disco tras desplegar todo | **30 % usado**, 26 GB libres de 38 | 2026-09-01 |
| Imágenes de Docker | 3,26 GB | 2026-09-01 |
| RAM disponible con todo arriba | 2,7 GB de 3,7 | 2026-09-01 |
| Swap | 2 GiB, `vm.swappiness=10` | agregada en Fase 1 |

> **`api.binance.com` tiene un edge de CDN prácticamente local** (TCP connect de 2–4 ms), pero la
> respuesta viaja al origen: 263 ms totales. `data-api.binance.vision` **no** tiene ese edge y es
> **4× más lento** — el código usa `api.binance.com` en los dos defaults, que es lo correcto.

> **El disco es el número a vigilar.** 40 GB que Hetzner **no permite achicar**. Pasó de 4 % a 30 %
> solo con desplegar. Los dumps horarios (`KEEP_LOCAL=2`) y los embeddings de pgvector van a
> crecer sobre eso.

## 6. Backups

**Los snapshots de Hetzner están deshabilitados** por decisión del dueño (2026-08-31). La
consecuencia asumida: la configuración del servidor **solo existe en git**, y por eso todo el
provisioning está versionado como scripts idempotentes en `infra/scripts/`.

La base sí está respaldada: dumps horarios a Cloudflare R2 con restore verificado —
ver [rpo-decision.md](rpo-decision.md) y `infra/scripts/db-backup.sh`.

## 7. Tareas programadas (`crontab` de `deploy`)

| Cuándo (UTC) | Qué |
| --- | --- |
| `0 * * * *` | Backup de la base a R2 |
| `17 3,15 * * *` | Renovación del certificado |

> **Los logs de cron no van bajo `certbot/`**: ese árbol es de root y el cron corre como `deploy`.
> Una redirección que falla aborta la línea entera del cron **antes de ejecutar nada** — el
> certificado se vencería sin que ninguna corrida llegara a intentarse.

## 8. TLS

| | |
| --- | --- |
| Dominio | `trader.estebanburgos.com.ar` |
| Emisor | **Let's Encrypt**, emitido en este servidor |
| Vence | **2026-11-30** |
| Renovación | `certbot renew --webroot`, dos veces por día |
| DNS | **Hostinger**, no Cloudflare (DEC-DOM) |

> La renovación es **infraestructura propia que hay que monitorear**. Un Origin Certificate de
> Cloudflare habría durado años; este dura 90 días y si la renovación falla en silencio, el sitio
> deja de cargar con un error de certificado.

## 9. Reconstruir el servidor desde cero

```bash
# 1. Provisionar el CX23 en Hetzner con la clave crypto-trader-hetzner ya cargada
# 2. Base del sistema
ssh root@<ip> 'bash -s' < infra/scripts/provision-01-base.sh
# 3. Verificar que `deploy` entra por clave ANTES de apagar la contraseña
ssh -i ~/.ssh/crypto-trader-hetzner deploy@<ip> 'echo ok'
# 4. Endurecer sshd
ssh root@<ip> 'bash -s' < infra/scripts/provision-02-sshd.sh
# 5. Firewall
HETZNER_API_TOKEN=... DEV_IP=... SERVER_ID=... bash infra/scripts/provision-03-firewall.sh
# 6. El resto lo hace el workflow de deploy
```

El **paso 3 no es opcional**: `provision-02` apaga la autenticación por contraseña, y si la clave
del usuario no quedó bien instalada, el único camino de vuelta es la consola web.
