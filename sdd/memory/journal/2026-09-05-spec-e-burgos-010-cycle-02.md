# spec-e-burgos-010 cycle-02 — 2026-09-05

## Qué pasó

La verificación contra el exchange de este ciclo dependía de una clave Ed25519 que **solo el dueño
de la cuenta de Binance puede crear**: ningún agente podía desbloquearla. En cycle-01 un bloqueo
equivalente (el `410 Gone` del `listenKey`) dejó la task de verificación sin producir una sola
observación contra el exchange real.

Acá el harness se escribió partido en dos mitades desde el diseño: una que no necesita credencial
(`ping`, `time`, y `userDataStream.subscribe` **sin** sesión, que debe ser rechazado con `-1193`) y
otra autenticada que se auto-skipea con un mensaje explícito cuando la clave falta. La mitad sin
credencial corrió contra TESTNET real y probó tres cosas que ningún doble puede probar: que el
socket abre, que la envoltura de respuesta es `{ id, status, result | error, rateLimits }`, y que
`userDataStream.subscribe` sigue vivo detrás de la autenticación de sesión. El bloqueo pasó de
total a parcial sin simular nada.

El rechazo con un código de error de negocio (`-1193` "session not authenticated") es evidencia
positiva de que el método existe; un `410` de nginx es evidencia de que no. Son observaciones de
distinta naturaleza y conviene pedirle a la sonda la primera.

## Lección

Cuando la verificación contra un tercero depende de una credencial que solo un humano puede crear,
partir el harness en una mitad sin credenciales —que corre siempre contra el ambiente real y busca
el rechazo de autenticación como prueba de vida del método— y una mitad autenticada que se skipea
con el motivo escrito en la salida: el ciclo cierra con evidencia real en vez de con cero.

## Costo evitable

Sin la partición, el ciclo cerraría con la misma cantidad de código y cero observaciones del
exchange, y la siguiente sesión tendría que reabrir el trabajo de verificación entero para saber si
el transporte estaba vivo. La mitad sin credencial cuesta tres requests y ninguna clave.
