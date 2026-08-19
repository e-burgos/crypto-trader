# spec-e-burgos-004 cycle-01 — 2026-08-19

## Estado

El trader gestiona sus propias API keys de data sources desde
`/dashboard/settings/data-sources`, sin pasar por el panel de admin. Cada fuente muestra su
categoría, su salud y exactamente uno de tres estados de acceso: _Your key_, _Admin shared_ o
_No key_.

## Estructura

- `pages/dashboard/settings/data-sources.tsx` — página, agrupa por categoría.
- `components/settings/trader-data-source-card.tsx` — card por fuente con el badge de acceso.
- `components/settings/trader-api-key-modal.tsx` — carga y borrado de la key propia.
- `hooks/use-trader-data-sources.ts` — listado y mutaciones, con invalidación del listado.

El estado de acceso se deriva de `hasOwnCredential` / `hasSharedCredential` que devuelve el
servidor; la pantalla no lo infiere. La API key nunca vuelve al cliente: solo los últimos 4
caracteres de la que el propio trader acaba de enviar, y nunca la identidad del admin que comparte.

## Dependencias

Ninguna nueva.

## Qué sigue

- No hay UI de admin para el flag `shared`: hoy se setea por API
  (`PUT /admin/data-sources/:id/credential`).
- Las credenciales de proveedores de noticias (`NewsApiCredential`) ya resuelven contra la
  credencial compartida en el backend, pero la pantalla de noticias todavía no distingue _propia_
  de _compartida_ como sí lo hace esta.
