# Spec 33 — Bugfix Batch: UX & Data Integrity

**Fecha:** 2026-04-15  
**Versión:** 1.0  
**Estado:** Propuesto  
**Branch:** `feature/33-bugfix-batch-ux-data`  
**Dependencias:** Spec 31 (llm-provider-dashboard), Spec 32 (operation-mode-selector), Spec 28 (multi-agent-chat-rag)

---

## 1. Resumen ejecutivo

Colección de 8 bugs confirmados (UX, datos y lógica) detectados en la branch `feature/llm-provider-dashboard`. Afectan onboarding, configuración de agentes, chat, bot-analysis y settings de noticias. Cada bug se documenta como un **item independiente** con su contexto, causa raíz estimada y solución propuesta.

---

## 2. Inventario de bugs

| #   | Título corto                                                             | Severidad | Dominio    | Archivos principales                                   |
| --- | ------------------------------------------------------------------------ | --------- | ---------- | ------------------------------------------------------ |
| B1  | Chat widget visible sin autenticación                                    | 🔴 Alta   | Frontend   | `chat-widget.tsx`, `app.tsx`                           |
| B2  | Onboarding paso 2: API key compartida entre proveedores                  | 🟡 Media  | Frontend   | `onboarding.tsx`                                       |
| B3  | Onboarding paso 3: capital inicial no se persiste + falta USDC           | 🔴 Alta   | Full-stack | `onboarding.tsx`, `trading.processor.ts`               |
| B4  | Creación de agente no guarda LLM provider/model                          | 🔴 Alta   | Backend    | `trading.service.ts` (createConfig)                    |
| B5  | Settings Modelos IA: selector de modelo visible en proveedores inactivos | 🟡 Media  | Frontend   | `settings.tsx` o componente de tab modelos IA          |
| B6  | Settings Modelos IA: falta switch modelos recomendados vs todos          | 🟢 Baja   | Frontend   | Componente de tab Modelos IA                           |
| B7  | Chat: error 404 al cargar sin sesiones + falta welcome sin provider      | 🔴 Alta   | Full-stack | `chat-widget.tsx`, `use-chat.ts`, `chat.controller.ts` |
| B8  | Bot-analysis no muestra indicador de análisis vía IA                     | 🟡 Media  | Frontend   | `bot-analysis.tsx`                                     |
| B9  | News config: proveedor LLM no se guarda/carga en selectores              | 🟡 Media  | Full-stack | `news-config-panel.tsx`, backend news config           |

---

## 3. Detalle por bug

### B1 — Chat widget visible sin autenticación

**Síntoma:** El FAB del chat (`ChatWidget`) se renderiza en todas las rutas, incluyendo landing, login y registro. Un usuario no autenticado ve el botón y podría intentar interactuar, generando errores 401.

**Causa raíz:** `ChatWidget` se monta globalmente en el layout sin verificar `isAuthenticated` del store de auth.

**Solución:**

- En el componente que monta `ChatWidget` (probablemente `app.tsx` o el layout del dashboard), condicionar el render a `isAuthenticated`.
- No renderizar el FAB ni el overlay si el usuario no está logueado.
- Si `ChatWidget` se monta dentro del `DashboardLayout`, verificar que no se escape a rutas públicas.

**Archivos afectados:**

- `apps/web/src/components/chat/chat-widget.tsx`
- `apps/web/src/app/app.tsx` (o layout donde se monta)

**Criterio de aceptación:**

- [ ] El FAB del chat NO aparece en `/`, `/login`, `/register`, `/onboarding`
- [ ] El FAB SÍ aparece en todas las rutas `/dashboard/*`
- [ ] No se pueden hacer llamadas a endpoints de chat sin token

---

### B2 — Onboarding paso 2: API key compartida entre proveedores

**Síntoma:** Al cambiar de proveedor LLM en el paso 2 del onboarding, se muestra un solo campo de API key (`llmApiKey`). Si el usuario escribe la key de Claude, luego cambia a OpenAI, la key de Claude desaparece y se pierde. Solo se puede guardar UNA key del proveedor seleccionado al final.

**Causa raíz:** El state `OnboardingState` tiene un solo campo `llmApiKey: string` compartido para todos los proveedores. Al cambiar proveedor se reutiliza el mismo campo.

**Solución:**

- Reemplazar `llmApiKey: string` por `llmApiKeys: Record<LLMProvider, string>` en el state.
- Al hacer click en un proveedor, mostrar el input con el valor correspondiente a ese proveedor.
- Al finalizar onboarding, guardar todas las keys que el usuario haya introducido (iterar sobre `llmApiKeys` y hacer POST para cada una que tenga valor).
- El input sigue siendo único visualmente, pero el valor cambia según el proveedor seleccionado.
- Extender `LLM_PROVIDERS` en onboarding para incluir los 6 proveedores disponibles: CLAUDE, OPENAI, GROQ, GEMINI, MISTRAL, TOGETHER.

**Archivos afectados:**

- `apps/web/src/pages/onboarding.tsx` — tipo `OnboardingState`, componente `StepLLM`, función `handleFinish`

**Criterio de aceptación:**

- [ ] Al cambiar entre proveedores, cada uno conserva su API key independiente
- [ ] Al finalizar onboarding, se guardan todas las keys introducidas (no solo la del proveedor seleccionado)
- [ ] Si solo se introdujo una key, solo se guarda esa
- [ ] El placeholder del input refleja el proveedor activo
- [ ] El modelo seleccionado al cambio de proveedor es el primer modelo del array del proveedor elegido

---

### B3 — Onboarding paso 3: capital inicial no se persiste + falta input USDC

**Síntoma:** En el paso 3, el input de capital inicial (modo SANDBOX) no envía el valor seleccionado al backend. El sandbox wallet siempre se inicializa con 10,000 (hardcodeado en `trading.processor.ts` línea ~628). Además, falta input para USDC (solo hay USDT).

**Causa raíz:**

1. En `handleFinish()` del onboarding, el PUT a `/trading/config` no incluye el campo `initialCapital`.
2. En `trading.processor.ts`, el upsert del `sandboxWallet` usa `balance: 10_000` hardcodeado en el `create` clause.
3. No existe concepto de capital inicial configurable en el modelo `TradingConfig` ni en el flujo de onboarding para USDC.

**Solución:**

- **Frontend:** Agregar un segundo input para USDC (solo visible en modo SANDBOX). Enviar ambos capitales al crear la configuración.
- **Backend:** Aceptar campos opcionales `initialCapitalUsdt` e `initialCapitalUsdc` en el DTO de creación (o en un endpoint separado de inicialización de sandbox wallet). Usarlos al crear el `sandboxWallet` en lugar del hardcodeado `10_000`.
- **Alternativa minimalista:** Usar el mismo endpoint de onboarding para inicializar wallets vía un POST específico `/trading/sandbox-wallet/init` con `{ usdt: number, usdc: number }`.
- Los inputs de capital inicial SOLO se muestran en modo SANDBOX. En TESTNET y LIVE no se muestran.

**Archivos afectados:**

- `apps/web/src/pages/onboarding.tsx` — `OnboardingState`, `StepMode`, `handleFinish`
- `apps/api/src/trading/trading.service.ts` o nuevo endpoint para init wallet
- `apps/api/src/trading/trading.processor.ts` — eliminar hardcode 10_000

**Criterio de aceptación:**

- [ ] El valor de capital inicial USDT elegido por el usuario se refleja en el balance del sandbox wallet
- [ ] Existe un input para USDC con un valor por defecto (ej. 10000)
- [ ] Los inputs de capital SOLO aparecen en modo SANDBOX
- [ ] Si el usuario no modifica el valor, se usa el default (1000 USDT, 10000 USDC o lo que se defina)
- [ ] El sandbox wallet NO se crea con 10,000 hardcodeados si el usuario eligió otro valor

---

### B4 — Creación de agente no guarda LLM provider/model

**Síntoma:** Al crear un agente desde `/dashboard/config` (wizard de creación), los campos `primaryProvider`, `primaryModel`, `fallbackProvider` y `fallbackModel` NO se persisten en el backend. El agente se crea con estos campos como `null`. **Sin embargo**, al _actualizar_ un agente existente, los campos sí se guardan correctamente.

**Causa raíz:** En `trading.service.ts` método `createConfig()`, el `data` del `prisma.tradingConfig.create()` no incluye los campos `primaryProvider`, `primaryModel`, `fallbackProvider`, `fallbackModel`. Solo está mapeando: `name`, `asset`, `pair`, `mode`, thresholds, risk params e `intervalMode`.

El frontend SÍ envía los campos en el `handleSubmit()` del wizard (ver `config.tsx` línea ~674, el DTO incluye `primaryProvider`, `primaryModel`, etc.). Pero el backend los ignora en el create.

**Solución:**

- En `trading.service.ts`, método `createConfig()`, agregar los 4 campos al `data` del `prisma.tradingConfig.create()`:
  ```typescript
  primaryProvider: dto.primaryProvider ?? null,
  primaryModel: dto.primaryModel ?? null,
  fallbackProvider: dto.fallbackProvider ?? null,
  fallbackModel: dto.fallbackModel ?? null,
  ```
- Verificar que `CreateTradingConfigDto` acepta estos campos (probablemente ya los tiene porque update funciona).

**Archivos afectados:**

- `apps/api/src/trading/trading.service.ts` — método `createConfig`
- `apps/api/src/trading/dto/` — verificar que el DTO de creación incluye los campos

**Criterio de aceptación:**

- [ ] Al crear un agente con provider/model seleccionados, la respuesta del API incluye esos valores
- [ ] Al consultar GET `/trading/config`, los agentes recién creados tienen `primaryProvider` y `primaryModel` poblados
- [ ] El comportamiento de update no se ve afectado

---

### B5 — Settings Modelos IA: selector de modelo visible en proveedores inactivos

**Síntoma:** En la pestaña "Modelos IA" de `/dashboard/settings`, se muestra el dropdown de selección de modelo para TODOS los proveedores, incluyendo los que no están activos (sin API key o con `isActive: false`). Esto confunde al usuario.

**Causa raíz:** El componente que renderiza la lista de proveedores en la tab de modelos IA no filtra por `isActive`.

**Solución:**

- Solo renderizar el selector de modelo (`DynamicModelSelect` o equivalente) para proveedores cuyo `isActive === true` según el hook `useLLMKeys()`.
- Para proveedores inactivos, mostrar un estado deshabilitado con mensaje "Configura tu API key para usar este proveedor".
- El modelo seleccionado en este selector será el modelo por defecto que tome el agente cuando use ese proveedor (actualizar `selectedModel` en la tabla `LLMKey`).

**Archivos afectados:**

- `apps/web/src/components/settings/` — componente donde se renderizan los proveedores en tab Modelos IA
- `apps/web/src/components/settings/dynamic-model-select.tsx`

**Criterio de aceptación:**

- [ ] Solo se muestra selector de modelo para proveedores con `isActive: true`
- [ ] Proveedores inactivos muestran estado deshabilitado claro
- [ ] El modelo seleccionado se persiste como `selectedModel` del proveedor

---

### B6 — Settings Modelos IA: falta switch modelos recomendados vs todos

**Síntoma:** En la tab "Modelos IA", al lado del label "Modelo" de cada proveedor activo, no hay forma de filtrar entre modelos que tienen sentido para CryptoTrader (analíticos, buenos para razonamiento financiero) y la lista completa de modelos del proveedor.

**Causa raíz:** No existe esta funcionalidad — es una mejora nueva.

**Solución:**

- Agregar un switch (toggle) al lado del label "Modelo" de cada proveedor activo con dos modos:
  - **Modelos recomendados** (default): Filtra la lista de modelos a solo los que tienen sentido para análisis financiero/trading. Lista curada mantenida en un mapa estático por proveedor.
  - **Todos los modelos**: Muestra todos los modelos disponibles (de la API dinámica del proveedor). Mostrar una advertencia: "Algunos modelos no están optimizados para análisis financiero. El rendimiento puede variar."
- El mapa de modelos recomendados por proveedor:

```typescript
const RECOMMENDED_MODELS: Record<string, string[]> = {
  CLAUDE: [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-opus-4-5',
  ],
  OPENAI: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  GROQ: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  GEMINI: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  MISTRAL: [
    'mistral-small-latest',
    'mistral-medium-latest',
    'mistral-large-latest',
  ],
  TOGETHER: [
    'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  ],
};
```

**Archivos afectados:**

- `apps/web/src/components/settings/dynamic-model-select.tsx` o componente de tab Modelos IA
- Agregar constante `RECOMMENDED_MODELS` en shared o en el componente

**Criterio de aceptación:**

- [ ] Cada proveedor activo muestra un switch "Recomendados / Todos"
- [ ] Por defecto se muestran solo modelos recomendados
- [ ] Al activar "Todos", se muestran todos los modelos con advertencia visible
- [ ] La selección del switch NO se persiste (es solo visual, por sesión)

---

### B7 — Chat: error 404 al cargar sin sesiones + falta welcome sin provider

**Síntoma (imagen 2 adjunta):** Al abrir el chat por primera vez (sin sesiones), se dispara una llamada a un endpoint de chat session con un ID inexistente, resultando en un error 404 "Chat session not found". Además, hay llamadas fallidas con IDs de agente (flechas rojas en la imagen).

**Síntoma adicional (imagen 3 adjunta):** Si el usuario entra al chat y no tiene proveedor/modelo LLM configurado, no se muestra un mensaje de bienvenida adecuado. El chat queda vacío con solo el selector de modelo visible.

**Causa raíz:**

1. El hook `useChatSession(activeSessionId)` se invoca con un `activeSessionId` que es un string vacío o un ID stale de una sesión anterior ya no existente. No hay guard para `activeSessionId === null/undefined/''.
2. El `ChatWidget` no verifica si hay sesiones activas antes de hacer la query.
3. No hay lógica para mostrar un welcome screen cuando no hay provider/modelo configurado.

**Solución:**

- En `useChatSession`, no ejecutar la query si `sessionId` es falsy (agregar `enabled: !!sessionId && sessionId.length > 0`).
- En `ChatWidget`, si `activeSessionId` es null/empty, mostrar un estado de bienvenida en lugar de un panel vacío.
- Si no hay LLM keys configuradas, mostrar un mensaje de bienvenida con CTA para ir a configurar LLM keys.
- No llamar endpoints de agent status con IDs de sesión de chat.

**Archivos afectados:**

- `apps/web/src/hooks/use-chat.ts` — `useChatSession` query guard
- `apps/web/src/components/chat/chat-widget.tsx` — welcome state
- `apps/web/src/store/chat.store.ts` — limpiar `activeSessionId` stale

**Criterio de aceptación:**

- [ ] No se disparan requests 404 al abrir el chat sin sesiones
- [ ] Si no hay sesiones activas, se muestra un welcome screen con opción de crear nueva sesión
- [ ] Si no hay LLM keys configuradas, se muestra mensaje sugiriendo ir a settings
- [ ] No hay errores en console/network al abrir el chat limpio

---

### B8 — Bot-analysis no muestra indicador de análisis vía IA

**Síntoma (imagen 4 adjunta):** En `/dashboard/bot-analysis`, cuando el agente toma una decisión y el análisis de noticias estaba activo (ver imagen 5: toggle "Agente analiza noticias antes de decidir" activado), no se muestra ningún indicador visual de que la decisión fue influenciada por análisis de noticias vía IA.

**Causa raíz:** La sección de noticias en bot-analysis muestra los datos de sentiment (score, distribución, método), pero no hay un indicador explícito que diga "Este análisis fue ejecutado con IA" vinculado a la configuración `botEnabled` de noticias.

**Solución:**

- En la sección "SENTIMIENTO DE NOTICIAS" del bot-analysis, agregar un badge/indicador que muestre:
  - Si `newsConfig.botEnabled === true` y el análisis tiene noticias: "✨ Análisis IA activo" (badge verde)
  - Si `newsConfig.botEnabled === false`: "📊 Solo indicadores técnicos" o no mostrar la sección de noticias
- En la sección "ENTRADAS DEL AGENTE" → card "NOTICIAS", mostrar si el bot usó IA en ese análisis específico.
- Verificar que la decisión (AgentDecision) registra si se usaron noticias-IA en el campo `newsAnalysisUsed` o similar.

**Archivos afectados:**

- `apps/web/src/pages/dashboard/bot-analysis.tsx` — secciones de noticias y entradas del agente

**Criterio de aceptación:**

- [ ] Cuando `botEnabled` está activo y hay noticias, se muestra badge "Análisis IA activo"
- [ ] Cuando `botEnabled` está desactivado, no se muestra la sección de noticias en entradas del agente (o se muestra grayed out)
- [ ] El indicador visual es claro y no requiere interpretar otros datos

---

### B9 — News config: proveedor LLM no se guarda/carga en selectores

**Síntoma (imagen 6 adjunta):** En `/dashboard/settings?tab=news`, los selectores de "Modelo de IA para Análisis" (Primario y Secundario/fallback) muestran "Seleccionar proveedor" vacío incluso después de haber guardado una configuración con proveedor seleccionado.

**Causa raíz:** Posibles causas:

1. El `handleSave()` del `NewsConfigPanel` envía `primaryProvider` y `primaryModel` pero el backend NO los persiste en el modelo `NewsConfig`.
2. O el backend SÍ los guarda pero el frontend NO los carga al montar el componente (los `useState` se inicializan con `config?.primaryProvider ?? ''` pero `config` no trae esos campos).
3. O el modelo Prisma `NewsConfig` no tiene estos campos.

**Solución:**

- **Verificar modelo Prisma:** Confirmar que `NewsConfig` tiene los campos `primaryProvider`, `primaryModel`, `fallbackProvider`, `fallbackModel`.
- **Backend:** Verificar que el endpoint de update de news config persiste estos campos.
- **Frontend:** Verificar que `useNewsConfig()` retorna estos campos y que el `useState` se sincroniza cuando `config` cambia (usar `useEffect` para sync o inicializar correctamente).
- Agregar `useEffect` para sincronizar los estados locales cuando `config` se carga asincrónicamente.

**Archivos afectados:**

- `apps/web/src/components/settings/news-config-panel.tsx`
- `apps/api/src/` — endpoint y servicio de news config
- `apps/api/prisma/schema.prisma` — modelo `NewsConfig`

**Criterio de aceptación:**

- [ ] Al guardar configuración de noticias con proveedor/modelo, los valores se persisten en DB
- [ ] Al recargar la página, los selectores muestran el proveedor/modelo previamente guardado
- [ ] Si no hay proveedor seleccionado, se muestra "Seleccionar proveedor" como placeholder

---

## 4. Fases de implementación

### Fase A — Backend fixes (B4, B3-backend, B9-backend)

1. **B4:** Agregar campos LLM al `createConfig` en `trading.service.ts`
2. **B3-backend:** Crear mecanismo para inicializar sandbox wallet con capital custom
3. **B9-backend:** Verificar y corregir persistencia de LLM provider en news config

### Fase B — Frontend fixes críticos (B1, B7, B3-frontend)

1. **B1:** Condicionar render de `ChatWidget` a autenticación
2. **B7:** Guards en queries de chat + welcome screen
3. **B3-frontend:** Input USDC + envío de capital inicial

### Fase C — Frontend fixes UX (B2, B5, B8, B9-frontend)

1. **B2:** Refactorizar state de API keys en onboarding
2. **B5:** Filtrar selector de modelo por proveedores activos
3. **B8:** Indicador visual de análisis IA en bot-analysis
4. **B9-frontend:** Sync de selectores LLM en news config

### Fase D — Feature menor (B6)

1. **B6:** Switch de modelos recomendados vs todos

---

## 5. Out of scope

- Cambios en el modelo Prisma de `TradingConfig` (los campos `primaryProvider`, `primaryModel`, `fallbackProvider`, `fallbackModel` ya existen).
- Refactor completo del chat (solo se corrigen los errores reportados).
- Migración de proveedores hardcodeados a dinámicos en onboarding (eso es de Spec 31).
- Tests E2E nuevos (se cubrirán en una spec separada si es necesario).

---

## 6. Decisiones de diseño

| Decisión                                               | Justificación                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Capital inicial como campo de onboarding, no de config | El capital de sandbox es per-wallet, no per-config. Un usuario puede tener múltiples configs compartiendo el mismo wallet. |
| `llmApiKeys` como Record en lugar de array             | Más ergonómico para lookup por proveedor en UI. Mapea directamente al patrón existente de botones.                         |
| Switch recomendados/todos NO persiste                  | Es preferencia visual efímera. El modelo seleccionado sí se persiste, pero el filtro no.                                   |
| Welcome screen en chat embebido (widget)               | El chat full-page ya tiene su propio welcome. El widget overlay necesita su versión compacta.                              |

---

## 7. Riesgos

| Riesgo                                        | Mitigación                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| B3 puede romper wallets existentes            | Solo afecta nuevos wallets creados post-fix. Los existentes mantienen su balance.                          |
| B4 puede afectar configs existentes           | No — solo cambia el `create`, no el `update`. Configs existentes sin provider seguirán usando auto-select. |
| B6 lista de recomendados queda desactualizada | Mantener como constante estática revisable. No bloquea al usuario (siempre puede elegir "Todos").          |
