# spec-e-burgos-010 cycle-01 — 2026-09-04

## Qué pasó

El ciclo entero —functional, planner, architect, 13 tasks, ~6.200 líneas, 2,5 M de tokens— se
diseñó sobre `POST /api/v3/userDataStream` de Binance. Recién en TASK-013, la última task, al
correr el harness TESTNET, apareció que el endpoint responde **`410 Gone` desde nginx**, en
TESTNET y en producción. No es firma, ni API key, ni IP: Binance lo retiró a nivel de
infraestructura. D-03 (ciclo de vida REST del `listenKey`) y D-04 (socket `/ws/<listenKey>`)
dependen enteros de él: sin key no hay socket, y el mecanismo de detección completo del ciclo es
inerte. El código está implementado, con tests verdes contra dobles, y no puede ejercitarse
contra el exchange.

La comprobación que lo hubiera revelado es **una línea de curl sin credenciales**:

```
curl -s -o /dev/null -w '%{http_code}' -X POST https://testnet.binance.vision/api/v3/userDataStream
```

## Lección

Antes de que el architect diseñe sobre un endpoint de un tercero, probar con un request sin
credenciales que el endpoint todavía existe: un `410`/`404` en la fase de brief cuesta un curl, y
descubrirlo en la última task cuesta el ciclo completo. Vale para cualquier endpoint que la spec
mencione y el repo no esté llamando ya hoy en producción.

## Costo evitable

~2,5 M de tokens de entrada y ~340 K de salida, 13 tasks y todo el trabajo de los cuatro
documentos del ciclo. La verificación previa cuesta un request y cero tokens de modelo.
