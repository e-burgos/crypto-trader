# spec-e-burgos-009 cycle-01 — 2026-09-03

## Estado

- La SPA expone los **40 campos** de configuración del bot (antes 11). Los 25 avanzados viven en
  cuatro secciones, **Protección**, **Señal y tamaño**, **Loop reactivo** y **Entrada**, en el alta
  (paso `advanced` nuevo entre `timing` y `review`, colapsado y todo apagado), en la edición
  (precargadas con el estado real) y en el detalle (solo lectura). El POST del alta por default es
  byte a byte el de antes (CA-002, test congelado); el PUT envía sólo lo cambiado (CA-003).
- El wire de configuración se importa de `@crypto-trader/shared`; la `interface TradingConfig` local
  de `use-trading.ts` desapareció (CA-001).

## Estructura

- `src/components/config/advanced/`: `advanced-fields.ts` (catálogo `ADVANCED_FIELDS` de los 25
  campos: control, rango, default, sección, dependencia, clave i18n; `fieldsBySection`),
  `advanced-draft.ts` (`AdvancedDraft`, `DEFAULT_ADVANCED_DRAFT`, `toAdvancedDraft`,
  `isFieldEnabled`, `clampToRange`, `diffToCreateInput`, `diffToUpdatePayload`),
  `use-advanced-draft.ts` (un solo hook para alta y edición), `advanced-field-control.tsx`
  (switch/slider/select según el catálogo, clamp, interruptores sintéticos para
  `maxPositionHoldMinutes` = "Sin límite" y `entryTrailingDeltaBips` = "Nivel fijo", callout de
  SANDBOX para `entryOrderMode`), `advanced-section.tsx`, `advanced-config-sections.tsx`
  (contenedor; `defaultOpen` por `surface`), `agent-advanced-summary.tsx` (solo lectura; valores
  fuera del wire degradan a "Unknown"), `fixtures.ts` (fixtures del wire por sección).
- Reglas visibles: `entryOrderMode` deshabilitado con explicación en SANDBOX; `entryTrailingDeltaBips`
  sólo con `OCO`; el modo resuelto del bot llega por prop (D11). Los dos puntos de exhaustividad
  (`ADVANCED_FIELDS: Record<TradingConfigAdvancedField, …>` y `DEFAULT_ADVANCED_DRAFT`) hacen fallar
  el build si el wire suma un campo avanzado.
- `constants.tsx`: `StepId` suma `advanced`; `STEPS` tiene 7 pasos. Los helpers de E2E que
  navegaban el stepper contemplan el paso extra.
- i18n: namespace `config.advanced.*` (87 claves nuevas por locale) y `notificationMessages`
  `entryOrderPlaced`, `entryOrderFilled`, `entryOrderMissing`; `locales-parity.spec.ts` garantiza la
  paridad es/en de todo el árbol.
- Tests: 267 en `apps/web` (eran 59): equivalencia CA-002, diff del PUT, 127 casos de propiedad de
  las reglas de habilitación generados desde el catálogo, detalle con degradación.

## Dependencias

- `@crypto-trader/shared` (wire), `@crypto-trader/ui` (ToggleSwitch, SliderField, Select, Collapsible,
  InfoTooltip, KeyValueRow, Badge, SectionTitle).

## Qué sigue

- cycle-02 de la spec: vista de entradas descansando sobre EP-017, tiempo real por `entry-order:*` en
  `use-websocket.ts`, y enlace desde las notificaciones.
- Backend: FIX-e-burgos-026 (el POST persistía sólo 18 de los 40 campos) y 027 (`isActive` en el DTO de
  edición) salieron de este ciclo; validarlos en el cierre.
