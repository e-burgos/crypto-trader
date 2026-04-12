# Spec 19 — Flujo E2E completo del Agente de Trading

## Objetivo

Verificar mediante pruebas end-to-end (Playwright) que el flujo completo del agente de trading funciona correctamente: desde la configuración inicial hasta el cierre manual de una posición abierta. Se usa el usuario `admin@crypto.com` (Admin1234!) que existe en el seed de la base de datos.

## Alcance

### Frontend (`e2e/`)

- `e2e/agent-flow.spec.ts` — spec principal con todos los bloques del flujo
- Autenticación inline con `admin@crypto.com` / `Admin1234!` (sin depender del storage compartido de trader)

### Tests cubiertos

1. **Autenticación** — login correcto redirige a `/dashboard`
2. **Configuración del Agente**
   - Navegación a `/dashboard/config`
   - Selección de asset (BTC), par (USDT), modo (SANDBOX)
   - Ajuste de sliders (buyThreshold, sellThreshold, stopLoss, takeProfit, maxTrade)
   - Guardado de configuración via botón "Save Config"
   - Aparición de la config en la tarjeta "Active Agents"
3. **Arranque del Agente**
   - Click en la tarjeta de la config guardada → abre `AgentDetailModal`
   - Click en "Start Agent" dentro del modal
   - Verificación del estado: badge verde "Running" en la tarjeta
4. **Agent Log** (`/dashboard/agent`)
   - Página carga con heading visible
   - Estado vacío o decisiones (BUY/SELL/HOLD/CLOSE) correctamente renderizadas
5. **Posiciones** (`/dashboard/positions`)
   - Página carga con encabezado visible
   - Tab OPEN muestra tabla o estado vacío
6. **Cierre manual de posición** (si existen posiciones abiertas)
   - Click en botón "Close" de la primera posición
   - Dialog de confirmación aparece con detalles de la posición
   - Click en "Close now" confirma el cierre
   - Posición aparece en tab CLOSED
7. **Parada del Agente**
   - Click en la tarjeta de config → `AgentDetailModal`
   - Click en "Stop Agent"
   - Badge cambia a "Stopped"

### Flujo SDD

- Branch: `feature/help-page-redesign` (rama activa actual; el spec se incorpora sin crear branch nuevo)

## Criterios de aceptación

- Todos los tests del bloque "Auth" pasan sin mock de estado
- La config BTC/USDT/SANDBOX se guarda exitosamente y aparece en la lista
- El agente pasa de estado "Stopped" a "Running" tras hacer click en Start Agent
- La página de Agent Log carga sin errores visibles
- La página de Positions carga y muestra tabla o empty state
- Si hay posiciones abiertas: el dialog de confirmación aparece y el cierre es ejecutado
- El agente pasa de "Running" a "Stopped" tras hacer click en Stop Agent
- Todos los tests corren con `pnpm nx e2e web-e2e` o `pnpm playwright test e2e/agent-flow.spec.ts`

---

**Depende de:** 13 (e2e-tests), 16 (frontend-completion)
**Siguiente:** Sin spec asignada aún
