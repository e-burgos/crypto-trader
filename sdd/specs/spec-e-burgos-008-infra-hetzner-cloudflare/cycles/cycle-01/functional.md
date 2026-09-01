# Functional — Cycle 01: Servidor, datos y red de seguridad

> Spec: `spec-e-burgos-008-infra-hetzner-cloudflare` | Fases 1-3 del plan | 2026-08-31

## Contexto de negocio

Este ciclo no produce nada que un trader vea. **El usuario de estas historias es el operador de la
plataforma** — hoy, una sola persona.

Lo que está en juego es concreto: la base de Railway tiene 2 configuraciones de trading y 91
posiciones reales. La Fase 4 las mueve, y ese movimiento es irreversible. Este ciclo construye lo
que tiene que existir **antes** de intentarlo: un servidor al que solo entra su dueño, una base que
no escucha en internet, y una cadena de backup que ya demostró poder devolver los datos.

El antecedente no es hipotético: `display-ads` perdió su plataforma seis días cuando Neon agotó la
cuota de compute. Lo que lo salvó no fue el proveedor, fue tener a dónde ir.

## Historias de usuario

### US-01-001: Entrar al servidor sin exponerlo

**Como** operador de la plataforma
**quiero** que al servidor solo se entre con una clave dedicada y desde mi IP
**para** que un servidor con IP pública no sea una puerta abierta mientras lo configuro.

**Criterios de aceptación**

- [ ] El acceso por contraseña está deshabilitado en `sshd`: un intento con contraseña recibe
      `Permission denied (publickey)` sin ofrecer `password`.
- [ ] Existe un usuario no-root con la clave dedicada y `sudo`; `root` queda en
      `prohibit-password` como único camino de emergencia.
- [ ] El firewall de Hetzner está `applied` y solo permite TCP/22 desde la IP del operador.
- [ ] El firewall se administra **fuera de la VM**: si una regla deja al operador afuera, se
      corrige desde el panel sin necesidad de entrar al servidor.
- [ ] `docker run hello-world` corre desde el usuario no-root, sin `sudo`.

> Cubre **CA-001**.

### US-01-002: Reproducir el servidor sin memoria ni intuición

**Como** operador
**quiero** que cada paso del provisioning sea un script versionado e idempotente
**para** poder reconstruir el servidor desde cero sin depender de lo que recuerde.

**Criterios de aceptación**

- [ ] Cada paso del provisioning vive en `infra/scripts/` y está en git.
- [ ] Los scripts son **idempotentes**: correrlos dos veces sobre el mismo servidor no rompe nada
      ni duplica configuración.
- [ ] El script que endurece `sshd` está separado del resto y documenta por qué su archivo debe
      ordenar antes que `50-cloud-init.conf`.
- [ ] Ningún script contiene secretos; los toma del entorno y falla explícitamente si faltan.

> Nace de la decisión del operador de **no** usar los backups de Hetzner (2026-08-31): sin
> snapshots, la configuración del servidor solo existe en git.

### US-01-003: Base y cola sin puerta a internet

**Como** operador
**quiero** que Postgres y Redis solo sean alcanzables desde dentro del compose
**para** que la base que guarda mis posiciones no acepte una sola conexión desde afuera.

**Criterios de aceptación**

- [ ] Postgres corre sobre `pgvector/pgvector:pg16` y Redis con persistencia habilitada.
- [ ] **Ninguno de los dos publica puertos al host**: no aparecen en un escaneo externo y `ss` no
      los muestra escuchando en `0.0.0.0`.
- [ ] Los datos de ambos viven en volúmenes con nombre que sobreviven a `docker compose down`.
- [ ] Las 37 migraciones aplican con `prisma migrate deploy` y `prisma migrate status` reporta que
      la base está al día.
- [ ] `CREATE EXTENSION vector` no falla — es lo que distingue a esta imagen de `postgres:16-alpine`,
      que muere con `P3018`.

> Cubre **CA-002**. Redis con persistencia es una diferencia deliberada con `display-ads`: acá la
> cola sostiene ciclos de agentes encolados, no cache.

### US-01-004: Un backup que ya demostró que sirve

**Como** operador
**quiero** haber restaurado un backup antes de mover un solo dato de producción
**para** no descubrir que la cadena no funciona el día que la necesite.

**Criterios de aceptación**

- [ ] Existe un backup automático programado que sube a un bucket **privado** de Cloudflare R2.
- [ ] El script rechaza cualquier bucket cuyo nombre contenga `media` (guarda **H-9**): es la
      protección contra escribir dumps en un bucket público.
- [ ] El bucket tiene reglas de lifecycle que aplican la retención decidida.
- [ ] Las suites de shell de backup y restore corren y pasan.
- [ ] **El criterio se cierra restaurando**, no ejecutando: un dump se baja de R2 y se restaura en
      una base descartable, y se verifica que los datos están.

> Cubre **CA-003**. Un backup que nunca se restauró no es un backup.

### US-01-005: Saber cuánto se puede perder

**Como** operador
**quiero** que el RPO sea una decisión escrita y no un efecto secundario del cron
**para** saber cuántas horas de operación estoy dispuesto a perder.

**Criterios de aceptación**

- [ ] La decisión de RPO está registrada con su justificación.
- [ ] La frecuencia del cron y las reglas de lifecycle **se derivan** de esa decisión, no al revés.
- [ ] Si el RPO elegido no se puede cumplir con dumps periódicos, queda registrado qué haría falta
      (archivado continuo de WAL) y por qué se difiere.

> Resuelve la decisión abierta §7.1 de la spec. Va en este ciclo porque condiciona el diseño de
> los backups, no porque sea urgente.

## Reglas de negocio

- **RN-01.** Ningún dato de producción entra al servidor antes de que US-01-004 esté cerrada. El
  orden de las fases no es preferencia: es la red debajo del paso irreversible.
- **RN-02.** Ningún secreto se versiona. `.env.production` vive solo en el VPS.
- **RN-03.** Los servicios de datos no publican puertos. La única superficie de red del servidor
  son 22, 80 y 443.
- **RN-04.** Toda verificación de este ciclo se hace por evidencia ejecutada, nunca por lectura de
  configuración: "el compose dice que no publica el puerto" no cierra US-01-003; un escaneo que no
  lo encuentra, sí.

## Glosario del dominio

| Término | Significado acá |
| --- | --- |
| **RPO** | *Recovery Point Objective*: cuántas horas de datos se aceptan perder ante un desastre. |
| **Guarda H-9** | Verificación heredada de `display-ads` que aborta el backup si el bucket destino contiene `media` en su nombre — evita subir dumps a un bucket público. |
| **pgvector** | Extensión de Postgres para embeddings. La migración del RAG la exige; sin ella la migración 37 falla con `P3018`. |
| **Base descartable** | Base vacía creada solo para probar un restore y borrada después. Nunca la de producción. |
| **Idempotente** | Un script que se puede correr N veces con el mismo resultado que correrlo una. |
