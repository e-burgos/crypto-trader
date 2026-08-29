# FIX-e-burgos-004-001 — La página de data sources solo renderiza la categoría NEWS

| Campo         | Valor                                     |
| ------------- | ----------------------------------------- |
| **ID**        | FIX-e-burgos-004-001                      |
| **Tipo**      | BUGFIX                                    |
| **Severidad** | high                                      |
| **Keyword**   | [BUGFIX]                                  |
| **Fecha**     | 2026-08-19                                |
| **Autor**     | e-burgos                                  |
| **Estado**    | implemented                               |
| **Spec**      | spec-e-burgos-004-data-source-credentials |

## Problema

Detectado levantando la app contra la base local, no por los tests: de las 8 fuentes sembradas,
la página `/dashboard/settings/data-sources` renderizaba **una sola**.

`SettingsDataSourcesPage` agrupaba con una lista hardcodeada
`CATEGORY_ORDER = ['PRICE', 'NEWS', 'ONCHAIN', 'SOCIAL', 'ALTERNATIVE']` y renderizaba con
`CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(...)`. Esas categorías no son las del
tipo canónico `DataSourceCategoryType` de `libs/shared`
(`TECHNICAL | SENTIMENT | DERIVATIVES | DEFI_ONCHAIN | NEWS | MARKET_DATA | PREDICTION | TOKEN_UNLOCKS`):
la única coincidencia es `NEWS`. Toda categoría fuera de la lista se descartaba en silencio.

Peor que un error visible: la barra de resumen contaba las 8 fuentes correctamente
(_Active: 8_), así que la pantalla se veía coherente mientras ocultaba 7 de 8 tarjetas. El
`sources.length === 0` que muestra el estado vacío tampoco se disparaba.

Dos defectos secundarios de la misma tarjeta, visibles en la misma corrida:

- El nombre de la fuente compartía fila con los badges bajo `flex-1 min-w-0` + `truncate`, y en
  una grilla de 3 columnas quedaba truncado a cero: la tarjeta de Coinalyze se veía sin nombre.
- La categoría se renderizaba como `source.category.toLowerCase()` con `capitalize`, produciendo
  `Defi_onchain` y `Market_data`.

## Justificación del bypass

El cycle-01 ya está cerrado y validado; esto es un defecto puntual de presentación en el
frontend del mismo ciclo, sin cambios de contrato de API, de entidades ni de resolución de
credenciales. Tres archivos de UI y sus tests. No justifica un ciclo SDD propio.

## Solución

- `components/settings/data-source-categories.ts` (nuevo): `CATEGORY_LABELS` tipado como
  `Record<DataSourceCategoryType, string>` — el compilador ahora exige una etiqueta por cada
  valor del tipo canónico, así que agregar una categoría al union rompe el build en vez de
  desaparecer de la pantalla. `orderedCategories()` ordena las conocidas y **agrega al final**
  las desconocidas en lugar de descartarlas.
- La página y la tarjeta consumen ese módulo. La tarjeta pasa el nombre a su propia fila
  (`break-words`) y muestra la etiqueta legible de la categoría.

## Verificación

`apps/web/src/pages/dashboard/settings/data-sources.spec.tsx` (nuevo):

- renderiza una fuente por cada una de las 8 categorías canónicas y exige que las 8 aparezcan;
- inyecta una categoría inexistente y exige que igual se renderice.

Ambos tests se corrieron contra el código anterior y **fallan** (2 failed), y pasan con el fix.
Confirmado además en el navegador: las 8 fuentes se listan con su badge de acceso correcto,
y el flujo _Set Key → Your key ✓ → Remove Key → Admin shared_ funciona punta a punta.
