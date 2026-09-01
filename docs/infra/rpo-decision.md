# Decisión de RPO — cuánto se puede perder

> spec-e-burgos-008 cycle-01, TASK-008 · Decidido 2026-08-31 · Resuelve spec §7.1 y architect DEC-11

## Decisión

**RPO = 1 hora.** Un `pg_dump -Fc` de `crypto_trader` cada hora, subido a Cloudflare R2.

No se implementa archivado continuo de WAL. Queda registrado como **decisión consciente**, no como
omisión, y se reevalúa en cycle-04 (CA-008).

## Qué significa RPO acá

*Recovery Point Objective*: cuántos datos se aceptan perder ante un desastre. Con dumps horarios, un
fallo total del disco a las 14:59 se recupera desde el dump de las 14:00 — se pierden hasta 59
minutos.

Lo que se pierde **no es principalmente volumen**: la plataforma opera un puñado de posiciones. Lo
que se pierde es **saber qué ejecutó el bot en esa ventana**. Las `Position`, `Trade`, `AgentDecision`
y `bot_actions` de esa hora desaparecen del registro, mientras que las órdenes correspondientes **sí
existieron en Binance**. La base y el exchange quedan desincronizados.

> Mitigación que ya existe y que hay que tener presente: `ReconciliationService` corre como paso
> previo a toda decisión del ciclo en LIVE/TESTNET y sincroniza contra el exchange. No reconstruye el
> historial perdido, pero **evita operar sobre un estado falso** después de un restore.

## Por qué 1 hora y no 6

La referencia (`display-ads`) usa 4 backups diarios, RPO ≤ 6 h. No se copia:

- **Cuesta lo mismo.** La diferencia entre cada 6 h y cada 1 h es un número en el cron.
- **El disco lo aguanta.** 35 GB libres, `DB_BACKUP_KEEP_LOCAL=2` mantiene 2 copias locales; la
  retención larga vive en R2 por reglas de lifecycle, no en el VPS.
- **El contenido es distinto.** En display-ads seis horas son registros comerciales que se pueden
  reconstruir preguntando. Acá son órdenes ejecutadas con dinero real contra un exchange.

## Por qué no WAL continuo (todavía)

El archivado continuo de WAL daría un RPO de minutos, pero:

| Contra | Detalle |
| --- | --- |
| **No es portable** | `display-ads` no lo tiene. Hay que elegir e integrar pgBackRest, WAL-G o barman desde cero. |
| **El restore se complica** | Deja de ser `pg_restore --dbname` y pasa a un procedimiento con `recovery.signal` y `restore_command`. Más pasos que practicar antes de necesitarlos. |
| **Almacenamiento continuo** | Crece todo el tiempo, no en saltos, y hay que podarlo con una política propia. |
| **Modo de falla nuevo y peligroso** | Si el archivado se traba (R2 caído, credencial vencida), **Postgres retiene los segmentos de WAL en disco** porque no puede descartar lo que no archivó. En 40 GB eso termina con la base detenida por falta de espacio. **El mecanismo que protege pasa a ser el que tumba.** |

Con dumps periódicos ese último modo de falla no existe: si un backup falla, queda el anterior y la
base sigue operando.

## Consecuencias operativas

- **Cron cada hora**, en el minuto 0, UTC (el servidor corre `Etc/UTC`).
- **Lifecycle en R2** —no borrado desde el script— con retención escalonada: se define en TASK-011.
- **`DB_BACKUP_KEEP_LOCAL=2`**: dos copias en el VPS, el resto vive en R2.
- **Un backup que falla tiene que ser visible.** Con RPO de 1 h, 24 oportunidades diarias de fallar
  en silencio. La alerta de backup fallido entra en el alcance de observabilidad (CA-008); hasta
  entonces, el modo de verificación es manual y queda anotado en el runbook.

## Cuándo reevaluar

- Si el volumen de operación crece hasta que perder una hora sea material.
- Si `ReconciliationService` demuestra no alcanzar para reconstruir el estado tras un restore real
  (se sabrá en TASK-012, al restaurar en la base descartable).
- En cycle-04 (CA-008), junto con la observabilidad.
