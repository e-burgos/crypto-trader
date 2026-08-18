# spec-e-burgos-001 cycle-01 — 2026-08-17

## Qué pasó

**1. Un subsistema entero estaba registrado en DI y no tenía un solo caller.** `agents/tools/`
(826 líneas, 6 tools + registry) y `model-router.service.ts` (326 líneas) estaban provistos en
`AppModule` y aparecían en el grafo de módulos como si fueran parte del sistema. Nadie los invocaba.
Peor: dos de las tres tools "valiosas" consultaban columnas que **no existen** en el schema
(`Trade.createdAt`, `Trade.configId`, `Trade.pnl`, `Position.unrealizedPnl`) — habrían lanzado en
runtime la primera vez que corrieran. El error estaba oculto porque cada lectura de Prisma iba
envuelta en `as Record<string, unknown>`, que apaga el chequeo de tipos del cliente generado.
El architect lo descubrió leyendo el schema real contra el código; el brief y la spec asumían que
"rescatar" era mover archivos, y en realidad era re-especificar el cálculo.

**2. Un criterio de aceptación de la spec no era ejecutable como estaba escrito.** "el dashboard
muestra costo > $0 para tráfico OpenRouter" es imposible de cumplir con el preset por defecto, que
usa modelos `:free`: ahí el costo correcto **es** $0. El criterio útil resultó ser otro —
`pricingSource` nunca nulo — para que "gratis" y "no se pudo tarifar" dejen de ser el mismo 0.

## Lección

- Presencia en el contenedor de DI **no** es evidencia de que algo se ejecute: antes de rescatar,
  refactorizar o confiar en un subsistema, verificar callers reales con grep; y antes de portar su
  lógica, verificarla contra el schema real, porque un cast a `Record<string, unknown>` puede estar
  escondiendo queries que nunca corrieron.
- Un criterio de aceptación que mide un **valor** (`> $0`) en vez de una **propiedad**
  (el origen del valor es conocido) puede ser infalsable o incumplible por configuración: al
  detectarlo, el architect debe reescribirlo como criterio ejecutable y el reviewer validar contra
  esa reinterpretación, no contra la letra.

## Costo evitable

El diagnóstico de la spec ("~1.900 líneas de código muerto, la lógica de las tools se rescata") se
escribió sin verificar callers ni schema. Verificarlo antes habría ahorrado el rediseño de los
contratos de dos de los tres servicios de dominio a mitad de ciclo, y habría evitado planificar
como "mover archivo" (TASK-001/003, 6 h estimadas) lo que era re-especificar el cálculo contra
columnas distintas. Un `grep` de callers y una lectura del `schema.prisma` cuestan minutos.
