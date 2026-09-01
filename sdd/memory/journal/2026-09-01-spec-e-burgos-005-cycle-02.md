# spec-e-burgos-005 cycle-02 — 2026-09-01

## Qué pasó

- Un **probe de escritura crudo contra TESTNET** corrido *antes* del architect (colocar, consultar y
  cancelar cada tipo con `fetch` + HMAC) devolvió tres hechos que la documentación no deja claros y
  que el contrato necesitaba: la pierna contingente del OCO recibe `aboveTrailingDelta` (no
  `trailingDelta`), el filtro `TRAILING_DELTA` falla con el **mismo** `-1013` que `LOT_SIZE`, y con
  `stopPrice` el trailing queda dormido (`trailingTime: -1`). El architect citó el artifact en cada
  payload y ningún implementador tuvo que descubrirlo.
- `pnpm nx test api --testFile=<spec>` **no filtra**: corrió las 88 suites. El flag que filtra en el
  jest de `apps/api` es `--testPathPatterns=`.
- El jest de `apps/api` mapea `generated/prisma` a un mock: un spec de integración con Prisma real
  no puede correr con `jest.config.js`; hizo falta `jest.testnet.config.js` sin ese mapper y
  `testPathIgnorePatterns` en el default.
- Con seis implementadores en paralelo sobre la misma rama, dos editaron `tasks.json` pese a la
  instrucción de no tocar `sdd/**` y un commit de archivo completo barrió el bookkeeping de otro
  (TASK-019 volvió a `in-progress`, TASK-020 quedó dentro del commit de TASK-022).

## Lección

- Correr un probe de escritura crudo contra el sandbox del proveedor **antes** de escribir el
  contrato: los payloads medidos valen más que la documentación y cuestan minutos.
- En `apps/api` filtrar specs con `--testPathPatterns=`, nunca con `--testFile=`.
- Un spec de integración con Prisma real necesita un config de jest sin el mock de
  `generated/prisma` y un `testPathIgnorePatterns` en el default.
- El registro SDD tiene **un solo escritor** por oleada: el orquestador. Los implementadores paralelos
  reportan `usage` en su informe y no tocan `sdd/**`; verificar el estado del registro al cierre
  de cada oleada.

## Costo evitable

- Sin el probe, el `aboveTrailingDelta` y el `-1013` compartido habrían aparecido recién en el
  harness (una vuelta de architect + implementador de data-fetcher, ~150k tokens).
- El `--testFile` corrió la suite completa (~4 min) en vez de un spec (~5 s); el barrido de
  `tasks.json` costó un commit de restauración y verificación manual.
