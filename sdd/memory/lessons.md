# 🧠 Memoria del proyecto — lecciones destiladas

> Versión 1.1 | Última destilación: 2026-08-29 — 5 entradas (spec-e-burgos-001 cycles 01-03,
> spec-e-burgos-004 cycle-01, FIX-e-burgos-002)
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

- **Verificar el mínimo de prefijo cacheable del proveedor contra el tamaño real del prompt
  antes de presupuestar ahorro por prompt caching**: Anthropic exige 1024 tokens (2048 en
  Haiku) y por debajo la marca `cache_control` no falla, no avisa y no ahorra — la capacidad
  queda implementada pero dormida, y el ahorro lo termina aportando otra cosa.
