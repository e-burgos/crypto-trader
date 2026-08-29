# Corte de entregas — cycle-01 (DECISIÓN TOMADA)

> Decidido por el dev el 2026-08-29. No es una opción abierta: es el plan de entrega vigente.
> Fuente de verdad de IDs y estimaciones: `../tasks.json`.

## Decisión

El ciclo se entrega en **dos entregas**, con el **test multi-réplica adelantado a la entrega 1**.

`TASK-025` (test CA-007 original) no podía moverse entero a la entrega 1 porque dependía de
`TASK-021`, que queda en la entrega 2. Se dividió según el riesgo que cada mitad cubre:

| Task | Qué prueba | Entrega | depends_on |
| --- | --- | --- | --- |
| **TASK-035** | Una sola suscripción por símbolo y una sola ejecución del fast path bajo N instancias | **1** | TASK-011, TASK-012, TASK-016, TASK-018 |
| **TASK-036** | Un evento material produce exactamente un ciclo de decisión bajo N instancias | **2** | TASK-020, TASK-021, TASK-035 |

`TASK-025` queda en `status: "skipped"` con el motivo del split. **Su ID no se reutiliza** — la
numeración vigente solo crece.

## Entrega 1 — 95h · 122 puntos · 23 tasks

```
002 003 004 009 010 011 012 013 014 015 016 017 018 019
027 028 029 030 031 032 033 034 035
```

Cierra: kill switch, tabla `bot_actions`, caps de frecuencia como puerta única, extracción de
`PositionActionService` con sus specs de regresión saneadas, stream en vivo con dueño único,
salud del stream consultable, **fast path completo defendiendo posiciones abiertas sin LLM**, y
la prueba de dos instancias del dueño único.

**Grafo cerrado:** ninguna task de la entrega 1 depende de una task de la entrega 2.

## Entrega 2 — 33h · 39 puntos · 9 tasks

```
001 005 020 021 022 023 024 026 036
```

Cierra: el despertar por evento material (D2), la garantía de que el evento nunca pospone el
temporizador, la suspensión del disparo con el stream degradado, el comparativo de costo de LLM
y el cierre de las pruebas de kill switch y multi-réplica.

## Qué queda fuera de la entrega 1

| Historia | Qué no entra |
| --- | --- |
| US-01-001 | Reaccionar a un movimiento de precio sin esperar al reloj |
| US-01-002 | Reaccionar a un quiebre de nivel |
| US-01-003 | Reaccionar a un spike de volumen |
| US-01-004 | Garantía de que el evento nunca pospone el temporizador |
| US-01-005 | Verificación de costo de LLM constante (harness) |
| US-01-018 | Que la degradación del stream suspenda el disparo por evento |

**Criterios de aceptación no probados al cierre de la entrega 1:** CA-002, CA-003, y CA-001 en su
forma de test formal (`TASK-026`). **CA-007 queda parcialmente probado**: la propiedad de dueño
único y ejecución única del fast path sí (`TASK-035`), la de ciclo único por evento no
(`TASK-036`, entrega 2).

La entrega 1 es la **capa 2 del alcance sin la capa 1**: el sistema defiende posiciones abiertas
mucho más rápido, pero todavía no adelanta la apertura de decisiones nuevas.

## Advertencia operativa

> **La entrega 1 no debe desplegarse con más de una réplica hasta que `TASK-035` esté en verde.**
>
> `TASK-016` implementa el dueño único por símbolo (lease Redis), y hasta que su prueba de dos
> instancias pase, la propiedad es una afirmación de diseño y no un hecho verificado. Con N
> réplicas y el lease fallando en silencio se obtienen N suscripciones por símbolo y N
> ejecuciones del fast path sobre la misma posición — es decir, N órdenes. Es exactamente el
> riesgo por el que el dev adelantó este test a la entrega 1.

## Opciones descartadas

- **Opción B — una sola entrega de ~3.2 semanas.** Descartada: excede el límite de 2 semanas del
  arnés sin ningún punto de corte intermedio, y deja todo el riesgo concentrado en un único merge.
- **Opción C — tres entregas de ≤2 semanas.** Descartada: ninguna entrega superaba el límite, pero
  costaba tres ciclos completos de revisión y cierre para un beneficio marginal sobre el corte en
  dos, que ya deja la entrega 1 con valor desplegable por sí sola.
