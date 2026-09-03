# spec-e-burgos-009 cycle-01 — 2026-09-03

## Qué pasó

- El architect, al contrastar el DTO (40 campos) contra `createConfig`, encontró que el POST **persistía
  sólo 18** y devolvía 201: la UI avanzada habría sido mentira en el alta. Ningún test lo cubría
  porque los tests del service afirmaban lo que el service enviaba, no lo que el DTO aceptaba
  (FIX-e-burgos-026).
- FIX-e-burgos-027 quitó `isActive` del DTO mientras TASK-001 escribía el wire compartido con el
  `isActive` del architect; el chequeo de deriva hizo exactamente su trabajo y falló el typecheck de
  `apps/api`. El implementador lo tapó con un `declare isActive?: never` en el DTO; la corrección
  correcta era el wire.
- Dos implementadores paralelos compartieron el barrel `advanced/index.ts` y un commit se llevó los
  exports del otro; se corrigió en el acto pero costó un commit de reversión.

## Lección

- Cuando una spec agrega UI sobre campos existentes, el architect contrasta **DTO ↔ persistencia** con
  un test que envía el DTO completo y afirma lo que llega al `create`; el typecheck no lo detecta.
- Un fix que cambia la forma de un wire compartido actualiza el tipo en `libs/shared` **en el mismo
  commit**; un implementador que encuentra el chequeo de deriva rojo corrige el wire, no lo esquiva.
- En oleadas paralelas, un archivo compartido (barrel, `constants.tsx`) tiene **un solo dueño** por
  oleada; los demás no lo tocan y lo reportan.

## Costo evitable

- Un commit fantasma más su reversión, y un round-trip de corrección del wire.
