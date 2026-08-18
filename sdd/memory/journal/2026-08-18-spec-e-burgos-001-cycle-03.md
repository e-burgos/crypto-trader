# spec-e-burgos-001-agents-simplification cycle-03 — 2026-08-18

## Qué pasó → el hecho concreto (error, descubrimiento, supuesto que falló)

architect.md especificó `buildGateSnapshot({ indicators, newsFingerprint, macroFingerprint,
positionsFingerprint })` asumiendo que `close` sale de `IndicatorSnapshot`. Esa interfaz
(`libs/shared/src/types/interfaces.ts`) nunca tuvo `close` — solo `Candle.close`. El código
pre-existente de `orchestrator.service.ts` ya leía
`(indicators as unknown as Record<string, unknown>)?.close`, que en runtime siempre es
`undefined`: un bug silencioso que ningún test detectó porque nada verificaba ese campo.

## Lección → 1 línea accionable, candidata a lessons.md

Antes de implementar un contrato del architect que lee un campo de un tipo compartido
(`IndicatorSnapshot`, `PositionData`, etc.), releer la interfaz real en
`libs/shared/src/types/interfaces.ts` — el architect a veces asume shape de runtime que el tipo
declarado no garantiza, y el implementor lo hereda si no verifica.

## Costo evitable → qué tokens/tiempo se habrían ahorrado sabiéndolo antes

Grep de 2 minutos sobre `interfaces.ts` antes de escribir `buildGateSnapshot` hubiera evitado
escribir la función con el contrato literal del architect, descubrir en el spec run que `close`
era `NaN`/`undefined`, y recién ahí corregir la firma — un ciclo completo de escritura +
verificación + reescritura del pure function y su spec.

---

# Cierre del ciclo (reviewer) — 2026-08-18

## Qué pasó → el hecho concreto (error, descubrimiento, supuesto que falló)

1. **El mínimo cacheable del proveedor invalidó un ahorro que la spec daba por hecho.** La spec y
   el brief planificaron prompt caching sobre "los system prompts estáticos de 650-830 tokens".
   El mínimo de prefijo cacheable de Anthropic es **1024 tokens (2048 en Haiku)**: por debajo, la
   marca `cache_control` simplemente no cachea. La feature se implementó completa y correcta, pero
   quedó **dormida** — cero prompts marcados, cero ahorro. El −50 % del ciclo lo aportaron el gate
   determinista y el caché compartido, no el prompt caching.
2. **Un harness de N escenarios congelados sirvió como sustituto ejecutable de un backtest que no
   existe.** El criterio "−50 % de costo sin degradar decisiones" no era verificable: no hay
   backtest ni escenario de referencia como infraestructura. Se resolvió con 12 escenarios
   versionados como fixture, corridos dos veces (línea base vs. optimizado) con un cliente LLM que
   cuenta invocaciones y un `costProxy` determinista, y **un assert por escenario** para que un
   solo caso silenciado haga fallar la suite aunque el promedio de ahorro se cumpla.

## Lección → 1 línea accionable, candidata a lessons.md

- Antes de presupuestar un ahorro por prompt caching, verificar el **mínimo de prefijo cacheable
  del proveedor** contra el tamaño real del prompt: por debajo del mínimo la marca no falla, no
  avisa y no ahorra — la capacidad queda dormida.
- Cuando un criterio de aceptación exige medir una mejora contra infraestructura que no existe
  (backtest, entorno de referencia), congelar N escenarios como fixture y correr línea base vs.
  optimizado en el mismo test, con assert **por escenario** además del agregado — evita que un
  promedio favorable esconda un caso regresionado.

## Costo evitable → qué tokens/tiempo se habrían ahorrado sabiéndolo antes

Chequear el mínimo cacheable al escribir el architect (no al implementar) habría permitido
decidir de entrada entre consolidar un prefijo estático que supere los 1024 tokens o declarar el
prompt caching fuera de alcance del ciclo — en vez de implementar, testear y documentar una
optimización que hoy no ejecuta ninguna de sus ramas útiles.
