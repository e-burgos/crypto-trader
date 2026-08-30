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
