# spec-e-burgos-008 cycle-04 — 2026-09-01

## Qué pasó

Al escribir el chequeo diario de salud, la tentación era la lista genérica: CPU, memoria, disco,
uptime. En cambio se armó **desde los modos de falla que este mismo proyecto había demostrado**:
el cron del certificado que nunca habría corrido, el backup que escribe a un log que nadie lee, el
disco que pasó de 4 % a 30 % en una tarde, los sub-agentes truncando en silencio.

En su **primera corrida real** el chequeo detectó un hallazgo legítimo.

## Lección

**Un chequeo de salud se diseña desde los fallos que ya ocurrieron, no desde una lista genérica de
métricas.** Cada verificación debería poder nombrar el incidente concreto que la justifica; si no
puede, probablemente sea ruido que alguien va a terminar silenciando.

Corolario sobre el canal de aviso: **notificar por un servicio externo que algo falló suma un punto
de falla en vez de restarlo.** Si la plataforma ya tiene un canal propio, usarlo — el aviso tiene que
funcionar justamente cuando algo está roto.

## Costo evitable

Ninguno significativo. Vale registrar lo contrario: haber tenido los incidentes documentados en
`issues_found` de los ciclos anteriores hizo que diseñar esto fuera casi mecánico.
