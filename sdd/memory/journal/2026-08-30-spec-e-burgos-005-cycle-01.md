# spec-e-burgos-005 cycle-01 — 2026-08-30

## Qué pasó

El ciclo corrió con 9 agentes en paralelo sobre un working tree compartido, particionado por
**carril de archivos**: el `files[]` de cada task era su lote exclusivo. Funcionó para lo que se
diseñó — hubo 3 colisiones de archivo, las tres detectadas y sin daño — pero produjo un agujero
que nadie vio hasta el review: **`ReactiveModule` quedó sin importar en `app/app.module.ts`**.

Se crearon 9 servicios, 4 archivos de coordinación, 3 migraciones y ~2.400 líneas de test verdes,
y el módulo entero es inalcanzable en el proceso: `grep -rn "ReactiveModule" apps/api/src` devuelve
una sola línea, su propia declaración. Poner `reactiveLoopEnabled = true` no produce ningún efecto.

Tres cosas se alinearon para esconderlo:

1. **El composition root no era el carril de nadie.** Ninguna task declaró `app.module.ts` en su
   `files[]`, y el architect dibujó el grafo de módulos (§7.1) sin asignarle dueño al cableado —
   describir el grafo se leyó como haberlo construido.
2. **Ningún test lo tocaba.** Los 9 specs de `src/reactive/` construyen los servicios con `new`,
   no con `Test.createTestingModule`. 666 tests en verde con el módulo huérfano.
3. **El kill switch tapó el síntoma.** El ciclo nace apagado por diseño, así que "no pasa nada al
   arrancar" era el resultado esperado y no despertó sospecha.

Segundo agujero de la misma familia: `degradedNotifyAfterMs` quedó como constante definida y sin
un solo lector — la notificación persistente de degradación que pide el architect §5.3 no está en
el `files[]` de ninguna task.

## Lección

El particionado por carril de archivos contiene colisiones pero **deja huérfano todo archivo que
no sea el carril de nadie**: al planificar en paralelo, dar dueño explícito al composition root
(`app.module.ts`) y a los archivos de cableado, y cerrar cada módulo Nest nuevo con un test que
lo resuelva desde `AppModule` — un spec que instancia servicios con `new` no prueba que existan
en la aplicación.

Corolario del mismo agujero: al terminar un ciclo, **grepear los símbolos nuevos buscando
lectores**, no solo definiciones. Un identificador con cero lectores (`ReactiveModule`,
`degradedNotifyAfterMs`) es una task que no se hizo, y sale con un grep de 5 segundos.

## Costo evitable

Un ciclo entero de 36 tasks / ~4M tokens llegó al review con su capacidad principal inalcanzable,
por una línea de import. Se detectó en el review por un grep, pero podría haberse ido a producción
como "entrega 1 desplegable" (así la describe `artifacts/delivery-split.md`) y el diagnóstico
posterior — feature encendida por config que "no hace nada", sin error ni log — es de los caros:
no falla, no avisa, y el sospechoso obvio es el kill switch, no el contenedor de DI.

## Desenlace

Ambos agujeros se cerraron dentro del mismo ciclo, registrados como TASK-037 y TASK-038 antes de
tocar código (el SPEC GATE aplica igual a lo que aparece durante una revisión). El ciclo cerró
aprobado en segunda pasada, con 669/669 en `apps/api`. El candado contra la recaída es
`reactive-module-wiring.spec.ts`: borrar el import de `app.module.ts` lo hace fallar.

Sobre el segundo agujero se tomó la decisión de **implementar** la notificación en vez de retirar
`degradedNotifyAfterMs`. Vale anotar por qué: borrar el requisito era el camino barato a un ciclo
cerrado, y es exactamente el atajo que el review acababa de detectar en otra forma. Una perilla
sin lector se arregla dándole un lector o borrándola, pero la elección no puede depender de cuál
de las dos deja cerrar antes.

## Lección 2 — construir a mano una clase de DI contagia dependencias opcionales

Al implementar la notificación hubo que declarar `NotificationsService` como dependencia
**opcional** de `StreamHealthService`, con un test extra de "no explota si no está wireada". No
por diseño: porque `TradingController` construye esa clase con `new` pasándole 3 de sus 6
argumentos, para esquivar un ciclo entre módulos.

El mecanismo es general y se repite solo: **mientras exista un `new` a mano de una clase de DI,
toda colaboración nueva de esa clase nace opcional**, porque obligarla rompería el sitio que la
construye a mano. Y una dependencia opcional es una que puede faltar en producción sin que nada
avise. La deuda no se queda quieta en el archivo donde se tomó el atajo: le cobra un peaje a cada
cambio futuro de la clase, y el peaje se paga en robustez, no en tiempo.

Al revisar: un parámetro de constructor que se vuelve opcional "para no romper un test o un
llamador" es señal de deuda estructural en el llamador, no una decisión local. Vale subirle la
prioridad al follow-up que la elimina — la evidencia de que se propaga ya no es hipotética.
