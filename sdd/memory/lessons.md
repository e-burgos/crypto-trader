# 🧠 Memoria del proyecto — lecciones destiladas

> Versión 1.2 | Última destilación: 2026-09-01 — 6 entradas (spec-e-burgos-005 cycle-01,
> spec-e-burgos-008 cycle-02, FIX-e-burgos-004, -005-001, -010)
> **Cap duro: 120 líneas.** Este archivo se lee COMPLETO al inicio de cada sesión de agente —
> cada línea acá cuesta tokens en todas las sesiones futuras. Si al destilar se supera el cap,
> primero podar lecciones obsoletas o absorbidas por constitutions/skills.

Reglas de este archivo (ver sección 🧠 MEMORIA GATE del dual-harness):

- **Solo lecciones destiladas**: una línea por lección, accionable, empezando por el verbo
  o la prohibición. Nada de narrativa ni historia — eso vive en `journal/`.
- **Nunca se edita durante un ciclo/fix**: las lecciones nuevas entran como entradas
  episódicas en `sdd/memory/journal/` y solo la destilación (un solo actor) las funde acá.
- **No duplicar** lo que ya dicen las constitutions, skills o el dual-harness: si una lección
  pertenece a un subproyecto concreto, va a su `constitution.md` en la consolidación de
  contexto; acá van las transversales al repo o al proceso.

## Proceso (cómo trabajan los agentes en este repo)

- **Un ciclo real encuentra en minutos lo que leer código no encuentra en horas.** Cuando una spec
  anota un riesgo como "teórico", ejecutarlo sale más barato que razonarlo: dos defectos críticos
  (gate de riesgo fallando abierto, índice vectorial inexistente) aparecieron en 90 segundos de
  corrida real y eran invisibles en el código.
- **Un comentario o un test que afirma un invariante NO es evidencia.** Los dos defectos anteriores
  estaban uno *afirmado por un test* y el otro *contradicho por un comentario*. Verificar contra el
  sistema vivo, no contra lo que el repo dice de sí mismo.
- **Antes de reportar un bug en una SPA, esperar a que la consulta resuelva.** Un estado de carga
  leído a destiempo se parece exactamente a un dato faltante.
- **Antes de operar con `gh`, cambiar a la cuenta `e-burgos` y volver a la original al terminar.**
  Un `403` de `gh` es cuenta equivocada hasta que se demuestre lo contrario, no falta de permisos.

- **Verificar con `ls` todo invariante que el arnés declare por nombre de archivo** antes de
  darlo por cumplido: los pasos "opcionales" del INSTALL son la fuente típica de gates que
  existen solo como texto y se leen como cumplidos durante ciclos enteros.
- **Diseñar cada oleada de subagentes como N unidades independientes que commitean al
  terminar**: un corte por límite de sesión cuesta solo las tasks en vuelo y el relanzamiento
  no necesita coordinación ni rescate de estado a medio escribir.
- **Reescribir como criterio ejecutable todo criterio de aceptación que mida un valor en vez
  de una propiedad**: "costo > $0" es incumplible con modelos `:free`, mientras que
  "`pricingSource` nunca nulo" sí es verificable. Lo reescribe el architect y el reviewer
  valida contra esa reinterpretación, no contra la letra de la spec.
- **Cuando un criterio exige medir una mejora contra infraestructura que no existe** (backtest,
  entorno de referencia), congelar N escenarios como fixture y correr línea base vs. optimizado
  en el mismo test, con assert **por escenario** además del agregado — un promedio favorable
  esconde un caso regresionado.

## Técnica (stack, herramientas, gotchas transversales)

- **Un `@Body()` que no apunta a una clase con decoradores desactiva el `ValidationPipe` global en
  silencio**: el pipe hace short-circuit cuando el metatype es `Object`. DTO es clase, o no hay
  validación. `body-dto-validation.spec.ts` lo vigila.
- **Una dependencia opcional en un constructor de Nest suele ser la cicatriz de una instancia
  construida a mano.** Antes de agregar el `?`, mover el controller al módulo que ya provee el
  servicio; y un módulo dinámico que otro necesita se **re-exporta**, nunca se vuelve a registrar.
- **Al planificar tasks en paralelo por carril de archivos, dar dueño explícito al composition
  root** (`app.module.ts`): lo que no es carril de nadie queda huérfano y los tests no lo detectan.
- **Una columna creada por SQL crudo que no está en `schema.prisma` la borra el próximo diff
  autogenerado.** Declararla como `Unsupported("tipo")` es lo único que lo impide.
- **Los modelos de razonamiento gastan `max_tokens` pensando y devuelven contenido vacío**, que el
  llamador sólo puede leer como truncado. `reasoning: { enabled: false }` lo resuelve;
  `exclude: true` NO — sólo oculta el pensamiento, se genera y se cobra igual. Algunos endpoints lo
  exigen y responden 400: hay que reintentar sin el flag.
- **Los embeddings de modelos distintos no son comparables** aunque midan lo mismo. Un fallback
  automático entre proveedores corrompe el índice en silencio: el proveedor se elige explícito y
  cambiarlo obliga a re-embeber.
- **Al corregir una constante que se nombra a sí misma** (`...-exactly-32-chars`), grepear ese
  literal: suele estar copiado en tests y fixtures que quedan mintiendo.

- **Presencia en el contenedor de DI no es evidencia de ejecución**: antes de rescatar,
  refactorizar o confiar en un subsistema, verificar callers reales con grep. Un cast a
  `as Record<string, unknown>` apaga el chequeo del cliente Prisma generado y puede esconder
  queries contra columnas inexistentes que nunca corrieron.
- **Releer la interfaz real en `libs/shared/src/types/interfaces.ts` antes de implementar un
  contrato del architect que lea un campo de un tipo compartido**: el architect a veces asume
  shape de runtime que el tipo declarado no garantiza (`IndicatorSnapshot` nunca tuvo `close`,
  y el acceso casteado devolvía `undefined` en silencio).
- **Verificar que una config global alcance al código concreto antes de tratarla como
  restricción de diseño**: el `ValidationPipe` global de este repo no valida ningún `@Body()`
  tipado inline — `toValidate` saltea cuando el metatype es `Object`.
- **Al renombrar un campo del wire en backend, grepear `apps/web` además del backend**: el
  front declara sus propias interfaces del response, así que el typecheck del monorepo no
  detecta la ruptura y los tests del backend quedan verdes con una pantalla rota.
- **Al centralizar una regla en un servicio, enumerar todos sus lectores, no solo el camino
  caliente**: un lector que sobrevive con su propia consulta produce una UI que promete lo que
  el backend niega, y ningún test de la ruta principal lo detecta.
- **Prohibido testear sobre el texto fuente de un rango entre dos símbolos** (`readFileSync` +
  match entre dos métodos): fija la forma del archivo, no el comportamiento, y obliga a los
  ciclos siguientes a acomodar el código al test. Las invariantes estructurales se afirman
  sobre comportamiento observable o sobre un símbolo concreto.

## Costo (qué gastó tokens/tiempo de más y cómo evitarlo)

- **Verificar antes de afirmar.** Tres hipótesis afirmadas con demasiada seguridad y desmentidas
  después (IP allowlist de Binance, OpenRouter "no soporta embeddings", tres falsos positivos por
  estado de carga) costaron más vueltas que comprobarlas de entrada.

- **Verificar el mínimo de prefijo cacheable del proveedor contra el tamaño real del prompt
  antes de presupuestar ahorro por prompt caching**: Anthropic exige 1024 tokens (2048 en
  Haiku) y por debajo la marca `cache_control` no falla, no avisa y no ahorra — la capacidad
  queda implementada pero dormida, y el ahorro lo termina aportando otra cosa.
