# spec-e-burgos-008 cycle-04 — 2026-09-01

## Estado

**La plataforma avisa cuando algo se rompe.** Antes de este ciclo no había métricas, ni alertas, ni
nadie leyendo los logs de cron: un backup que no subía o un certificado por vencer se descubrían el
día que hacían falta.

## Estructura

### `infra/scripts/daily-health-check.sh`

Seis verificaciones, y **cada una corresponde a un modo de falla que este proyecto demostró que
ocurre en silencio** — no a una lista genérica de cosas que suelen monitorearse:

| Chequeo | El silencio que rompe |
| --- | --- |
| Disco | 40 GB que Hetzner **no deja achicar**; pasó de 4 % a 30 % sólo con desplegar |
| Contenedores | Si la API queda `unhealthy`, nginx sigue en pie devolviendo 502 |
| Backups | El cron horario escribe a un log que nadie lee: 24 chances diarias de fallar |
| Certificado | Vence el 2026-11-30; si la renovación falla, el sitio cae sin aviso previo |
| `/api/health` | Exige el **cuerpo**, no el código: un 200 con la base caída sería el mismo fail-open ya corregido |
| Truncados de LLM | Un sub-agente que trunca degrada la decisión sin ningún error — así se coló `FIX-e-burgos-014` |

**El aviso va a la tabla `Notification` de la propia plataforma**, con el tipo nuevo `INFRA_ALERT`,
y aparece en la UI con su evento WebSocket. Es deliberado: agregar un servicio externo para avisar
que algo falló **suma un punto de falla en vez de restarlo**, y este script tiene que funcionar
justamente cuando algo está roto.

`INFRA_ALERT` es un tipo propio y no `AGENT_ERROR`: *"mi bot falló"* y *"el servidor se queda sin
disco"* son urgencias distintas y el operador tiene que poder distinguirlas.

### Cron

`0 8 * * *` UTC — las 05:00 en Argentina. El chequeo tiene que llegar **antes** de que el operador
empiece el día, no después. Con esto son tres crons: backup horario, renovación del certificado dos
veces al día, y este.

## Qué sigue

- **La ventana entre que algo cae y las 08:00 UTC no está cubierta.** El health check lo refleja al
  instante, pero nadie lo consulta si no hay un monitor externo apuntándole. Un uptime check gratuito
  contra `/api/health` cerraría el hueco; queda como mejora, no como requisito.
- **El chequeo no mide uso de memoria de Redis.** Con `noeviction` un Redis lleno falla las
  escrituras con error en vez de descartar jobs, que es lo que se buscó, pero no se ve venir.
- Ver [`docs/infra/redis-degradation.md`](../../../../docs/infra/redis-degradation.md): se decidió
  **monitorear y no mitigar**, porque un fallback en memoria violaría el aislamiento entre réplicas
  y haría que los caps de frecuencia dejen de contar lo que realmente pasó.
