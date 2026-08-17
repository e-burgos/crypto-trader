# spec-e-burgos-001 cycle-02 — 2026-08-17

## Qué pasó

1. **El límite de sesión cortó una oleada de subagentes a mitad de camino.** De la oleada de
   implementación, 4 subagentes murieron sin terminar su task. El relanzamiento después del reset
   funcionó sin pérdida de trabajo: las tasks ya cerradas estaban commiteadas y las cortadas se
   rehicieron desde cero contra un árbol limpio. Lo que salvó la oleada fue que cada subagente
   tenía **una** task con alcance de archivos acotado y commiteaba al terminar — no había estado
   compartido a medio escribir entre subagentes.
2. **Dos specs de regresión hacen string-matching sobre un rango de texto del código fuente.**
   `trading.processor.isolation.spec.ts` y `trading.processor.decision-traceability.spec.ts` leen
   `trading.processor.ts` con `readFileSync` y afirman que el texto entre
   `private async checkOpenPositions` y `private parseSymbolForSandbox` contiene
   `$transaction`/`tx.sandboxWallet.*` y **no** contiene la palabra `decisionId`. La máquina de
   salidas del ciclo necesitaba exactamente lo contrario (el `Trade` del parcial lleva
   `decisionId`), así que la implementación tuvo que extraer `executePartialTakeProfit` a un
   método aparte y colocarlo **físicamente antes** de `checkOpenPositions` en el archivo para no
   romper las aserciones. El código quedó bien, pero su forma la decidió el test, no el diseño.
3. **El architect enumeró los consumidores de un rename de wire y se olvidó del frontend.**
   `§13.2` listaba `trading.processor.ts:129-131` como único consumidor a migrar cuando
   `AgentHealthItem.agentId` pasó a `slot`; `apps/web` también lee ese campo y quedó roto en
   silencio (TypeScript no lo detecta: el front declara su propia interfaz local del response).
   El ciclo cerró con todos sus tests en verde y una página de settings rota.

## Lección

- Diseñar cada oleada de subagentes como N unidades independientes que commitean al terminar: un
  corte por límite de sesión cuesta solo las tasks en vuelo, y el relanzamiento no necesita
  coordinación.
- No escribir tests que afirmen sobre el **texto fuente** de un rango entre dos símbolos: fijan la
  forma del archivo, no el comportamiento, y obligan a los ciclos siguientes a acomodar el código
  al test. Si hay que proteger una invariante estructural, afirmarla sobre el comportamiento
  observable o sobre un símbolo concreto, nunca sobre un rango de líneas.
- Cuando un ciclo backend renombra un campo del wire, buscar los consumidores con grep sobre
  `apps/web` además del backend: el front declara sus propias interfaces del response, así que el
  typecheck del monorepo **no** detecta la ruptura y los tests del backend quedan verdes.

## Costo evitable

- El punto 2 costó una vuelta completa de implementación de TASK-014: el subagente escribió la
  extracción del método, vio fallar dos specs que no tenían nada que ver con su cambio, y tuvo que
  investigar el string-matching antes de reordenar el archivo. Saberlo de antemano (o no tener
  esos tests) habría ahorrado esa iteración entera.
- El punto 3 se detecta en la revisión, no antes: un grep de 5 segundos sobre `apps/web` durante
  el diseño habría convertido una ruptura de producción en una línea del planner.
