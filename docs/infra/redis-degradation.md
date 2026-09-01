# Decisión — qué pasa cuando Redis no está

> spec-e-burgos-008 cycle-04 · Decidido 2026-09-01 · Resuelve la decisión abierta §7.4 (hallazgo G)

## Decisión

**Se monitorea, no se mitiga.** Redis sigue siendo dependencia dura del ciclo de trading, y el
chequeo diario más el health check son los que hacen visible su ausencia.

## El problema

Sin Redis, **las colas de Bull dejan de procesar en silencio**. No hay excepción, no hay log de
error: los jobs simplemente no se encolan y el bot deja de operar. En `display-ads` Redis es cache y
perderlo degrada; acá **sostiene los ciclos de agentes encolados y los leases de coordinación
`rx:v1:*` del loop reactivo**.

## Por qué no se mitiga

La mitigación obvia sería degradar a un scheduler en memoria cuando Redis falta. **Se descarta**, y
por la misma razón que `spec-e-burgos-005` ya había resuelto para la coordinación:

- Un contador o un lease en memoria de proceso **viola el aislamiento entre réplicas**. Con N
  instancias, cada una creería ser la dueña del símbolo y el mismo bot ejecutaría N veces.
- Los caps de frecuencia se cuentan sobre `bot_actions`, que es estado compartido. Un fallback en
  memoria haría que **los caps dejen de contar lo que realmente pasó** — y los caps existen
  precisamente para que el LLM no pueda sobre-operar.
- `ReactiveCoordinationModule` ya toma esta decisión: sin Redis el driver es `Disabled` y todo queda
  **fail-closed**. Agregar un fallback en memoria contradiría esa elección.

**Que el bot se detenga es el comportamiento correcto.** Lo inaceptable no es que pare: es que pare
sin que nadie se entere.

## Por qué alcanza con monitorear

Redis está en el mismo `docker compose` que la API, con `restart: unless-stopped` y healthcheck. Un
Redis caído en este despliegue significa que el contenedor murió y no pudo reiniciar, o que la
máquina entera se cayó — escenarios en los que un fallback tampoco salvaría nada.

Lo que faltaba era **verlo**, y ahora se ve por tres caminos:

| Camino | Qué detecta | Cuándo |
| --- | --- | --- |
| `/api/health` | `redis: "down"` y **HTTP 503** | En cada consulta |
| Healthcheck del contenedor de la API | Marca `unhealthy` porque exige `"status":"ok"` | Cada 15 s |
| `daily-health-check.sh` | Contenedor caído o unhealthy → notificación `INFRA_ALERT` | Diario, 08:00 UTC |

## Lo que esta decisión NO cubre

- **La ventana entre que Redis cae y el chequeo diario corre.** El health check lo refleja al
  instante, pero nadie lo consulta si no hay un monitor externo apuntándole. Un uptime check
  gratuito contra `/api/health` cerraría ese hueco; queda como mejora, no como requisito.
- **Un Redis vivo pero lleno.** Con `noeviction` las escrituras fallan con error en vez de descartar
  jobs en silencio —que es lo que se buscó al elegir esa política— pero el chequeo diario no mide
  uso de memoria todavía.

## Cuándo reevaluar

- Si aparece una segunda réplica de la API: ahí la coordinación por Redis deja de ser una comodidad
  y pasa a ser el único mecanismo de corrección.
- Si el bot opera con volumen suficiente para que unas horas detenido tengan costo material.
