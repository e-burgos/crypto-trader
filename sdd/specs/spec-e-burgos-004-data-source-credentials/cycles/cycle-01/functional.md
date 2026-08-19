# Functional — Cycle 01: Resolución híbrida de credenciales de data sources

> **Spec:** spec-e-burgos-004-data-source-credentials
> **Módulo:** market-data-credentials · **Fecha:** 2026-08-19
> **Subproyectos:** `apps/api`, `apps/web`, `libs/shared`

## Contexto de negocio

El bot decide sobre un `EnrichedMarketSnapshot`: precio y velas de Binance más ocho fuentes
externas que aportan sentimiento, derivados, salud DeFi, noticias, mercado global, mercados de
predicción, desbloqueos de tokens y análisis técnico pre-calculado. Seis de esas ocho no piden
API key y funcionan para todos. Las dos que sí la piden —`coinalyze` (derivados) y `finnhub`
(noticias)— son las que aportan señal que no se puede derivar del precio.

Hoy esas dos solo funcionan para quien tenga una fila en `data_source_credentials`, y esa fila
únicamente la crea el panel de admin. Un trader no-admin nunca la tiene: su snapshot llega con
`derivatives` y `news` en `null`, y su bot paga exactamente el mismo costo de LLM por ciclo que
un bot con contexto completo. El ahorro que `spec-e-burgos-001` consiguió en el denominador se
pierde en el numerador.

Las dos keys son de free tier: el costo de habilitar esto es cero en dinero. El costo real es de
**cupo** —cuántas llamadas por minuto tolera el proveedor— y hoy el sistema lo administra mal:
todas las credenciales de una fuente comparten un único bucket de rate limit y una única entrada
de caché, sin importar de quién sea la key. Por eso el aislamiento por dueño de credencial no es
una optimización posterior: es parte de lo que hace que la feature rinda.

## Historias de usuario

### HU-01-01: Empezar a operar con contexto completo sin pedirle nada a un administrador

**Como** trader recién incorporado, sin ninguna API key propia
**Quiero** que las fuentes que el administrador decidió compartir estén disponibles para mi bot
**Para** que mis decisiones se tomen con derivados y noticias desde el primer ciclo, en lugar de
esperar a que alguien me cargue credenciales una por una

**Criterios de aceptación:**

- [ ] CA-001: Con el admin teniendo una credencial de `coinalyze` marcada como compartida y el
  trader sin credencial propia, el `EnrichedMarketSnapshot` del trader trae `derivatives` no nulo
  y `coinalyze` aparece en `activeSources`, no en `failedSources`.
- [ ] CA-002: Con el admin teniendo una credencial de `finnhub` marcada como compartida y el
  trader sin credencial propia, las fuentes de noticias del trader incluyen Finnhub.
- [ ] CA-003: Si ninguna credencial de esa fuente está marcada como compartida y el trader no
  tiene la suya, la fuente se omite: aparece en `failedSources` y su campo llega `null`. Es el
  comportamiento actual y no cambia.
- [ ] CA-004: Una credencial de otro **trader** —no de un admin— jamás se usa como fallback,
  esté marcada como compartida o no.

### HU-01-02: Usar mi propia API key y que tenga prioridad sobre la compartida

**Como** trader con cuenta propia en el proveedor
**Quiero** cargar mi API key y que el sistema use la mía y no la del administrador
**Para** no depender del cupo de una key que comparto con desconocidos, y para que mi consumo
salga de mi propia cuota

**Criterios de aceptación:**

- [ ] CA-005: Con credencial propia y credencial compartida disponibles para la misma fuente, el
  fetch se hace con la key propia del trader (test con assert explícito sobre la key que llega a
  `fetchData`).
- [ ] CA-006: Cargar una key propia no modifica, desactiva ni marca la credencial compartida del
  admin.
- [ ] CA-007: Al borrar su credencial propia, el trader vuelve automáticamente a la compartida si
  existe, sin ninguna acción adicional.
- [ ] CA-008: Una credencial guardada por un trader queda siempre como no compartida, aunque el
  request incluya el campo pidiendo lo contrario.

### HU-01-03: Ver el estado de mis fuentes de datos y gestionarlas yo mismo

**Como** trader
**Quiero** una pantalla donde vea cada fuente activa, si tengo acceso y por qué vía, y donde
pueda cargar o borrar mi key
**Para** entender de dónde saca información mi bot sin abrir un ticket ni la documentación de la
API

**Criterios de aceptación:**

- [ ] CA-009: `/dashboard/settings/data-sources` lista las fuentes activas de la plataforma
  agrupadas por categoría, con su estado de salud.
- [ ] CA-010: Cada fuente muestra exactamente uno de tres estados: **Your key** (credencial
  propia), **Admin shared** (sin credencial propia, hay compartida disponible), **No key**
  (ninguna de las dos y la fuente exige key).
- [ ] CA-011: Las fuentes que no exigen API key se muestran como disponibles y no ofrecen la
  acción de cargar key.
- [ ] CA-012: La API key nunca se devuelve al cliente. Tras guardarla, la respuesta y la pantalla
  solo muestran los últimos 4 caracteres.
- [ ] CA-013: Borrar una credencial que no existe responde éxito, sin error (idempotente).
- [ ] CA-014: La pantalla nunca revela de quién es la credencial compartida ni ningún dato del
  administrador.

### HU-01-04: Decidir como administrador qué credenciales presto y cuáles no

**Como** administrador de la plataforma
**Quiero** marcar explícitamente cuáles de mis credenciales quedan disponibles para los traders
**Para** habilitar el arranque sin ceder por defecto todas mis keys

**Criterios de aceptación:**

- [ ] CA-015: `PUT /admin/data-sources/:id/credential` acepta el campo que marca la credencial
  como compartida y lo persiste.
- [ ] CA-016: Omitir el campo deja la credencial como no compartida. Ninguna credencial existente
  pasa a compartida por el solo hecho de desplegar este ciclo.
- [ ] CA-017: Un usuario autenticado sin rol de administrador no puede marcar ninguna credencial
  como compartida por ningún endpoint.
- [ ] CA-018: Al dejar de compartir una credencial, los traders que dependían de ella vuelven a
  ver la fuente como **No key** y sus siguientes snapshots la omiten. No queda ningún acceso
  residual por caché.

### HU-01-05: Que el cupo y los datos de un trader no dependan de otro trader

**Como** dueño de la plataforma
**Quiero** que las llamadas hechas con la key de un trader no consuman el cupo de otro ni le
entreguen a otro los datos que trajeron
**Para** que sumar traders con key propia agregue capacidad en lugar de contención, y para que
ningún dato de un tenant termine en el snapshot de otro

**Comportamiento observable esperado:**

El cupo y la frescura de una fuente son propiedades de la **credencial**, no del nombre de la
fuente. Dos traders con keys propias distintas para `coinalyze` son, a efectos del proveedor,
dos clientes independientes. Dos traders que caen en la misma credencial compartida del admin
sí comparten cupo y datos, porque comparten literalmente la cuota del proveedor.

**Criterios de aceptación:**

- [ ] CA-019: Dos traders con credenciales propias distintas para la misma fuente consumen
  buckets de rate limit separados: agotar el cupo de uno no bloquea al otro.
- [ ] CA-020: Dos traders con credenciales propias distintas para la misma fuente no comparten
  entrada de caché. El payload traído con la key de uno nunca se le sirve al otro, tampoco en
  los caminos de rate limit excedido, circuito abierto o error de fetch.
- [ ] CA-021: Dos traders que resuelven contra la misma credencial compartida del admin sí
  comparten bucket y entrada de caché.
- [ ] CA-022: El circuit breaker de una credencial no abre el circuito de las demás credenciales
  de la misma fuente.

## Requisitos funcionales

### RF-01: Punto único de resolución de credenciales

La resolución `credencial propia → credencial de admin compartida → ninguna` vive en **un solo
servicio**, consumido tanto por el armado del snapshot enriquecido como por el armado de las
fuentes de noticias. Ningún otro archivo implementa la cascada. El resultado es tipado e incluye
quién es el dueño de la credencial resuelta y por cuál de las dos vías se resolvió, para que los
consumidores puedan aislar cupo y caché sin volver a consultar la base.

Es el mismo invariante que `spec-e-burgos-001` cycle-01 estableció al unificar la resolución de
provider/modelo: una cascada, un servicio, un tipo de resultado.

### RF-02: Marca de credencial compartida

Tanto las credenciales de data sources como las de proveedores de noticias admiten una marca de
"compartida". Solo un administrador puede activarla. El valor por defecto es no compartida, de
modo que el despliegue de este ciclo no cambia el comportamiento de ninguna instalación
existente hasta que un administrador decida compartir algo.

### RF-03: Prioridad y no interferencia

La credencial propia del trader gana siempre. La compartida solo se consulta para las fuentes en
las que el trader no tiene la suya. Guardar, actualizar o borrar la credencial propia de un
trader no escribe jamás sobre la credencial de otro usuario.

### RF-04: Aislamiento por dueño de credencial

El caché de respuestas y el rate limiter de fuentes externas se indexan por la combinación de
fuente y dueño de la credencial usada. Una fuente sin credencial —las seis que no exigen key—
se comporta como un único dueño común, porque literalmente no hay cuota por cliente que separar.

### RF-05: Endpoints de self-service del trader

El trader dispone de tres operaciones sobre sus propias credenciales de data sources: listar el
estado de las fuentes activas, guardar su key para una fuente, y borrarla. Guardar sobre una
fuente inexistente o inactiva responde no encontrado. Borrar es idempotente. Ninguna respuesta
incluye material de clave más allá de los últimos 4 caracteres de lo que el propio trader acaba
de enviar.

### RF-06: Pantalla de fuentes de datos del trader

La pantalla consume el listado del RF-05 y presenta cada fuente con su categoría, su salud y su
estado de acceso, con la acción de cargar o borrar la key propia cuando la fuente la admite. El
estado mostrado se deriva del listado del servidor y no de una inferencia del cliente.

## Glosario del dominio

| Término | Significado en esta spec |
| --- | --- |
| **Credencial propia** | Fila de credencial cuyo `userId` es el del trader que está operando |
| **Credencial compartida** | Fila de credencial de un usuario con rol de administrador, marcada explícitamente como disponible para los demás |
| **Dueño de credencial** | El `userId` de la credencial efectivamente usada para un fetch; es la unidad de aislamiento de cupo y caché |
| **Fuente omitida** | Fuente que exige key, no tiene ninguna resoluble, y por eso no se llama: su campo llega `null` y su nombre entra en `failedSources` |
| **Fuente sin key** | Una de las seis fuentes que no exigen credencial; siempre disponible para todos |
