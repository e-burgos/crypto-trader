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
