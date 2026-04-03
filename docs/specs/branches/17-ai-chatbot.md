# Spec 17 — AI Chatbot (KRYPTO Agent)

**Fecha:** 2026-04-03
**Versión:** 1.1
**Estado:** Aprobado
**Branch:** `feature/ai-chatbot`
**Dependencias:** Spec 15 (backend completo), Spec 16 (frontend completo)

---

## 1. Resumen ejecutivo

Se añade un chatbot conversacional integrado en el dashboard llamado **KRYPTO** — la interfaz conversacional del agente de trading interno de la plataforma.

KRYPTO no es un asistente genérico. Es la personificación del mismo motor de decisiones que ejecuta las operaciones de compra/venta. Habla en primera persona, accumula experiencia a través de su historial de decisiones y posee conocimiento completo de todos los indicadores, configuraciones y flujos de la plataforma.

El usuario puede:
1. **Obtener ayuda** — entender indicadores, etiquetas, cómo configurar el agente, cómo colocar órdenes
2. **Crear operaciones** guiado por el agente con instrucciones paso a paso
3. **Consultar el mercado** — panorama actual basado en indicadores + noticias + decisión técnica justificada
4. **Aprender sobre blockchain** — KRYPTO actúa como instructor: explica criptografía, DeFi, wallets, consenso, Layer 2, tokenomics y cualquier concepto del ecosistema blockchain desde nivel básico hasta avanzado

---

## 2. Alcance

### Incluido (v1)
- Backend: `ChatModule` NestJS con persistencia de sesiones y mensajes en PostgreSQL
- **Streaming de respuestas via SSE** — texto generado token a token en tiempo real
- Selección de proveedor LLM + modelo por sesión (usa credenciales ya configuradas del usuario)
- Cuatro modos de conversación: `help` | `trade` | `market` | `blockchain` + conversación libre
- **Widget flotante** (FAB) accesible desde todo el dashboard + opción "Abrir en pantalla completa"
- **Página completa** `/dashboard/chat` con historial de sesiones y chat expandido — ambas opciones coexisten
- Sistema de prompts con contexto de plataforma: historial de decisiones, posiciones abiertas, configuraciones activas
- Persistencia de conversaciones en DB por usuario

### Excluido (v2)
- Ejecución de acciones directas por el chatbot (crear config, start/stop agent vía chat) — v1 solo guía al usuario
- Búsqueda semántica sobre historial de decisiones (RAG) — v1 envía los últimos 10 al contexto
- Chatbot visible en la landing page (usuarios no autenticados)
- Notificaciones push de insights proactivos del agente

---

## 3. Personas y casos de uso

| Persona | Caso de uso | Ejemplo de mensaje |
|---|---|---|
| **Nuevo usuario** | Entender indicadores | "¿Qué significa RSI 28 y qué debería hacer?" |
| **Nuevo usuario** | Crear primera operación | "Quiero empezar a operar BTC, ¿cómo hago?" |
| **Usuario intermedio** | Entender decisión del agente | "¿Por qué decidiste HOLD esta mañana con BTC?" |
| **Usuario intermedio** | Consultar mercado | "¿Cómo ves el mercado ahora mismo?" |
| **Usuario avanzado** | Justificación técnica | "Dame un análisis completo de ETH/USDT con todos los indicadores" |
| **Cualquier usuario** | Configuración | "¿Qué umbral de compra me recomendás para una estrategia conservadora?" |
| **Cualquier usuario** | Aprender blockchain | "¿Qué es una wallet HD y cómo generan las claves privadas?" |
| **Cualquier usuario** | DeFi / ecosistema | "Explicame qué es un AMM y cómo difiere de un order book centralizado" |
| **Usuario nuevo** | Conceptos básicos | "¿Qué es una blockchain y por qué Bitcoin no puede ser falsificado?" |

---

## 4. Arquitectura

### 4.1 Flujo de datos (con SSE streaming)

```
Usuario → Frontend (ChatWidget / ChatPage)
  → [1] POST /api/chat/sessions/:id/messages  (guarda user message)
  → [2] GET  /api/chat/sessions/:id/stream?content=...&capability=...
        (SSE endpoint — text/event-stream)
  → ChatController → ChatService
  → [3] buildContext(userId) → Prisma (decisiones + configs + posiciones)
  → [4] buildSystemPrompt(context, capability)
  → [5] callLLMStream(provider, model, apiKey, systemPrompt, history)
    → Claude API (stream: true) / OpenAI API (stream: true) / Groq API (stream: true)
    → Cada chunk de texto → SSE event: data: { delta: "texto..." }
  → Al finalizar el stream → SSE event: data: { done: true, messageId: "..." }
  → ChatService persiste el mensaje completo en DB

Flujo de dos pasos:
  PASO 1: POST /messages  → guarda user msg → 201 { userMessageId }
  PASO 2: GET  /stream    → SSE stream de la respuesta del agente → cierra al terminar
```

#### Por qué dos pasos en vez de uno
El endpoint `POST` persiste el mensaje del usuario de forma síncrona y retorna su ID. El endpoint SSE `GET` inicia el stream de la respuesta. Esto permite:
- Reintentar el stream sin duplicar el mensaje del usuario
- Cancelar el stream (cerrar `EventSource`) sin perder el mensaje enviado
- Compatibilidad con proxies/CDN que no soportan SSE en respuesta a POST

### 4.2 Integración con LLM providers

El chatbot **reutiliza las credenciales de LLM ya configuradas** por el usuario en Settings. No requiere nueva configuración. La selección de proveedor/modelo se hace al crear una sesión de chat.

Si el usuario no tiene credenciales configuradas → el chatbot muestra un estado vacío con un CTA hacia Settings.

### 4.3 Contexto dinámico del agente

En cada mensaje, el sistema inyecta automáticamente al system prompt:

| Dato | Fuente | Cantidad |
|---|---|---|
| Decisiones recientes | `agent_decisions` | Últimas 10 |
| Configuraciones activas | `trading_configs` | Todas |
| Posiciones abiertas | `positions WHERE status=OPEN` | Todas |
| Modo de conversación | Request (`capability`) | 1 |

---

## 5. Base de datos

### 5.1 Nuevos modelos Prisma

```prisma
enum ChatRole {
  USER
  ASSISTANT
  SYSTEM
}

model ChatSession {
  id        String      @id @default(cuid())
  userId    String
  title     String      @default("New Chat")
  provider  LLMProvider
  model     String
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  user     User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages ChatMessage[]

  @@index([userId, createdAt])
  @@map("chat_sessions")
}

model ChatMessage {
  id        String   @id @default(cuid())
  sessionId String
  role      ChatRole
  content   String
  createdAt DateTime @default(now())
  metadata  Json?    // para datos adicionales: capability usado, tokens consumidos, etc.

  session ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
  @@map("chat_messages")
}
```

### 5.2 Relación con User

```prisma
model User {
  // ... campos existentes ...
  chatSessions ChatSession[]
}
```

---

## 6. API REST

### Endpoints del `ChatController` (`/api/chat`)

Todos protegidos con `JwtAuthGuard`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/chat/llm-options` | Proveedores y modelos disponibles según credenciales configuradas |
| `GET` | `/chat/sessions` | Lista de sesiones del usuario (con conteo de mensajes) |
| `POST` | `/chat/sessions` | Crear nueva sesión |
| `GET` | `/chat/sessions/:id` | Obtener sesión con todos sus mensajes |
| `DELETE` | `/chat/sessions/:id` | Eliminar sesión y mensajes |
| `POST` | `/chat/sessions/:id/messages` | Persistir mensaje del usuario → retorna `{ userMessageId }` |
| `GET` | `/chat/sessions/:id/stream` | **SSE** — Stream de respuesta del agente (`text/event-stream`) |

### SSE — Protocolo de eventos

```
# Cada chunk de texto durante el stream:
data: {"delta": "El RSI de BTC está en"}

# Al finalizar:
data: {"done": true, "messageId": "clxyz123", "fullContent": "..."}

# En caso de error del proveedor LLM:
data: {"error": "Provider returned status 429. Check your API key quota."}

# Query params del endpoint GET /stream:
?content=<mensaje_url_encoded>&capability=<help|trade|market|blockchain>
```

> El token JWT se pasa como query param `?token=` ya que `EventSource` nativo del browser no soporta headers personalizados.

### DTOs

#### `CreateSessionDto`
```typescript
{
  provider: LLMProvider;      // CLAUDE | OPENAI | GROQ
  model: string;              // e.g. "claude-sonnet-4-20250514"
  title?: string;             // opcional, auto-generado del primer mensaje si no se provee
}
```

#### `SendMessageDto`
```typescript
{
  content: string;            // mensaje del usuario
  capability?: 'help' | 'trade' | 'market' | 'blockchain'; // hint de modo (opcional)
}
```

#### `GET /chat/llm-options` — Response
```typescript
[
  {
    provider: "CLAUDE",
    label: "Anthropic Claude",
    model: "claude-sonnet-4-20250514",       // modelo seleccionado en Settings
    models: ["claude-sonnet-4-20250514", "claude-opus-4-5", ...]  // todos los modelos del provider
  },
  ...
]
```

---

## 7. System Prompt — Diseño

### 7.1 Identidad del agente (KRYPTO)

El system prompt establece que KRYPTO es el propio agente de trading interno, no un asistente externo. Puntos clave:

- **Habla en primera persona**: "yo decidí HOLD esta mañana porque..."
- **Conoce la plataforma al 100%**: todos los indicadores, cada campo de configuración, cada sección del dashboard
- **Acumula experiencia**: referencia su historial de decisiones inyectado en el contexto
- **Es técnico pero accesible**: calibra el nivel de explicación según el usuario

### 7.2 Modos de conversación (capability hints)

| Capability | Comportamiento | Trigger sugerido en UI |
|---|---|---|
| `help` | Explicaciones detalladas y educativas de la plataforma, ejemplos prácticos, analogías | Botón "Cómo usar la plataforma" |
| `trade` | Guía paso a paso por la UI del dashboard para crear una operación, solicita asset/par/modo si no se indicó | Botón "Quiero operar" |
| `market` | Análisis técnico completo → BUY/SELL/HOLD con justificación, referencia indicadores y noticias | Botón "Ver mercado" |
| `blockchain` | Modo instructor: explica conceptos del ecosistema blockchain, DeFi, wallets, consenso, Layer 2, tokenomics — profundidad adaptada al nivel del usuario | Botón "Aprende blockchain" |
| `undefined` | Libre, KRYPTO adapta estilo según el contexto del mensaje | Conversación abierta |

### 7.3 Conocimiento codificado en el prompt

El system prompt incluye siempre:

**Plataforma:**
- Descripción de cada indicador: RSI, MACD, Bollinger Bands, EMA (9/21/50/200), Volumen
- Descripción de cada sección del dashboard (Overview, Chart, Positions, History, Agent Log, Analytics, Market, News, Config, Settings)
- Descripción de cada parámetro de configuración con valores recomendados
- Diferencia entre SANDBOX y LIVE
- Guía de configuración por perfil de riesgo (conservador / moderado / agresivo)
- Decisiones recientes del agente (últimas 10)
- Configuraciones activas del usuario
- Posiciones abiertas

**Blockchain (dominio del instructor):**
- Fundamentos: ¿qué es una blockchain?, bloques, hashes, inmutabilidad, nodos
- Criptografía aplicada: claves públicas/privadas, firmas digitales, wallets HD (BIP-32/39/44)
- Mecanismos de consenso: Proof of Work, Proof of Stake, diferencias, trade-offs
- Bitcoin: UTXO model, halving, mempool, lightning network, script
- Ethereum: EVM, gas, account model, smart contracts, solidity básico
- DeFi: AMMs, liquidity pools, impermanent loss, yield farming, lending protocols
- Tokens: ERC-20, ERC-721 (NFT), ERC-1155, tokenomics basics
- Layer 2 y scaling: rollups (optimistic vs ZK), sidechains, state channels
- Exchanges: CEX vs DEX, order books, AMM (Uniswap model), slippage
- Seguridad: seed phrases, custodial vs non-custodial, tipos de ataque comunes
- Regulación: panorama general, AML/KYC en crypto, jurisdicciones relevantes

### 7.4 Idioma

KRYPTO responde siempre en el mismo idioma en que el usuario escribe. El system prompt lo establece explícitamente.

---

## 8. Frontend

### 8.1 Componentes

```
apps/web/src/
├── components/
│   └── chat/
│       ├── chat-widget.tsx          # FAB + chat flotante (overlay)
│       ├── chat-session-panel.tsx   # Lista de sesiones (sidebar del chat)
│       ├── chat-messages.tsx        # Historial de mensajes con markdown rendering
│       ├── chat-input.tsx           # Input + botones de capability + send
│       ├── llm-selector.tsx         # Selector de provider + modelo
│       └── capability-buttons.tsx   # Botones de inicio rápido (Ayuda / Trade / Mercado)
│
├── pages/dashboard/
│   └── chat.tsx                     # Página full de chat /dashboard/chat
│
├── hooks/
│   └── use-chat.ts                  # React Query hooks para sesiones y mensajes
│
└── store/
    └── chat.store.ts                # Estado del widget (open/closed, sessionId activo)
```

### 8.2 Chat Widget (FAB)

- Botón flotante en la esquina inferior derecha del dashboard, visible en todas las rutas del dashboard
- Ícono: `BotMessageSquare` (Lucide) con badge animado cuando se está esperando respuesta
- Click → abre overlay chat de 380×520px, posicionado por encima del FAB
- Estado persistido en `chat.store.ts` (Zustand): `isOpen`, `activeSessionId`
- Animación: `gsap.from` con scale + opacity al abrir/cerrar
- El widget muestra `ChatMessages` + `ChatInput`
- Link "Abrir en pantalla completa" → navega a `/dashboard/chat` preservando la sesión activa

### 8.3 Página `/dashboard/chat`

Layout de tres columnas:

```
┌────────────────────────────────────────────────────────────┐
│  SIDEBAR (260px)          │  CHAT MESSAGES   │  INFO PANEL │
│  ─────────────────────    │  ─────────────── │  (opcional) │
│  [+ Nueva sesión]         │  KRYPTO header   │             │
│  ─────────────────────    │  con LLM badge   │             │
│  📅 Hoy                   │                  │             │
│    • Market analysis...   │  [mensajes]      │             │
│    • Cómo configurar...   │                  │             │
│  📅 Ayer                  │                  │             │
│    • Análisis ETH...      │                  │             │
│  ─────────────────────    │  CapabilityBtns  │             │
│                           │  ─────────────── │             │
│                           │  [ Input... ] ▶  │             │
└────────────────────────────────────────────────────────────┘
```

- Sidebar: lista de sesiones agrupadas por fecha (Hoy / Ayer / Esta semana / Anteriores), con botón eliminar por sesión
- Header del chat: nombre "KRYPTO", ícono del provider LLM (Claude/OpenAI/Groq), modelo seleccionado en badge
- Mensajes: burbujas diferenciadas (user derecha, agente izquierda), markdown renderizado, auto-scroll al nuevo mensaje
- Botones de capability: tres botones rápidos visibles cuando el chat está vacío o como acciones rápidas
- Input: textarea con auto-resize, Ctrl+Enter para enviar, indicador de loading mientras el LLM responde

### 8.4 `LLMSelector` — Selección de proveedor y modelo

Aparece al crear una nueva sesión (modal o inline):

```
┌─────────────────────────────────────────┐
│  Seleccionar modelo de IA               │
│                                         │
│  Proveedor:  [Anthropic Claude     ▼]   │
│  Modelo:     [claude-sonnet-4...   ▼]   │
│                                         │
│  ⚠ Si no ves proveedores, configura    │
│    tus API keys en Settings             │
│                                         │
│              [Cancelar]  [Crear chat]   │
└─────────────────────────────────────────┘
```

- Solo muestra proveedores con credenciales activas (`GET /chat/llm-options`)
- Si no hay credenciales → estado vacío con link a `/dashboard/settings?tab=ai`

### 8.5 Capability Buttons (inicio rápido)

Cuatro botones visibles cuando la sesión no tiene mensajes, dispuestos en grid 2×2:

| Botón | Ícono | capability | Mensaje pre-llenado |
|---|---|---|---|
| **Cómo usar la plataforma** | `HelpCircle` | `help` | `¿Por dónde debería empezar para entender la plataforma?` |
| **Quiero operar ahora** | `TrendingUp` | `trade` | `Quiero crear una operación de trading. ¿Puedes guiarme?` |
| **¿Cómo está el mercado?** | `BarChart2` | `market` | `Dame un análisis del mercado actual con tu recomendación de inversión.` |
| **Aprende blockchain** | `BookOpen` | `blockchain` | `Quiero aprender sobre blockchain. ¿Por dónde empezamos?` |

Al hacer click → el mensaje se envía directamente con el capability hint correspondiente.

Cuando la sesión ya tiene mensajes, los 4 botones se muestran como chips compactos debajo del input (modo secundario).

### 8.6 Renderizado de mensajes

- Renderizar markdown con `react-markdown` + `remark-gfm` (tablas, código, listas, negrita)
- Resaltar bloques de código con `rehype-highlight`
- Timestamps hover en cada mensaje (tiempo relativo: "hace 2 min")
- Botón "Copiar" en respuestas largas del agente
- Avatar del agente: icono del provider LLM (Claude/OpenAI/Groq) en un círculo, color según proveedor

### 8.7 Estados de la UI

| Estado | Comportamiento |
|---|---|
| Sin credenciales LLM | Pantalla vacía con CTA → Settings |
| Sin sesiones | Pantalla de bienvenida con los 4 capability buttons |
| **Streaming activo** | Burbuja del agente se va llenando con el texto en tiempo real, botón enviar deshabilitado, botón "Detener" activo |
| **Streaming detenido por usuario** | El mensaje parcial se guarda en DB con sufijo `[...]`, se habilita el input |
| Error LLM (stream) | El texto parcial ya mostrado permanece visible + mensaje inline `"Error al generar respuesta"` |
| Sesión vacía (nueva) | Solo muestra los 4 capability buttons en grid 2×2 |
| Widget minimizado | Solo FAB visible, sin badge cuando no hay streaming activo |

---

## 9. Hooks de React Query

```typescript
// Archivo: apps/web/src/hooks/use-chat.ts

// Lista de proveedores disponibles
useChatLLMOptions(): { provider, label, model, models }[]

// Lista de sesiones del usuario
useChatSessions(): ChatSessionSummary[]

// Sesión activa con mensajes
useChatSession(sessionId: string): ChatSessionWithMessages

// Crear nueva sesión
useCreateChatSession(): Mutation<CreateSessionDto, ChatSession>

// Eliminar sesión
useDeleteChatSession(): Mutation<string, void>

// Persistir mensaje del usuario (paso 1 del flujo SSE)
useSendUserMessage(sessionId: string): Mutation<SendMessageDto, { userMessageId: string }>

// Hook de streaming SSE (paso 2 del flujo SSE)
// Retorna las funciones para iniciar/detener el stream y el estado actual
useChatStream(sessionId: string): {
  streamingContent: string;      // texto acumulado durante el stream
  isStreaming: boolean;          // true mientras el EventSource está activo
  startStream: (content: string, capability?: string) => void;  // abre EventSource
  stopStream: () => void;        // cierra EventSource (cancela generación)
  error: string | null;          // error del LLM si lo hubo
}
```

#### Implementación de `useChatStream`

```typescript
// El hook maneja EventSource internamente
// Al llamar startStream():
//   1. Crea EventSource con /chat/sessions/:id/stream?content=...&token=...
//   2. Acumula `event.data.delta` en estado local → re-render incremental
//   3. Al recibir `done: true` → invalida query ['chat','sessions',sessionId]
//      para que el mensaje persista en la lista
//   4. Al recibir `error` o al cerrar EventSource → actualiza estado de error
```

Query keys:
```typescript
['chat', 'llm-options']
['chat', 'sessions']
['chat', 'sessions', sessionId]
```

---

## 10. Store de Zustand

```typescript
// Archivo: apps/web/src/store/chat.store.ts

interface ChatStore {
  isOpen: boolean;
  activeSessionId: string | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setActiveSession: (id: string | null) => void;
}
```

---

## 11. Sidebar — enlace al chat

Agregar entrada en la navegación del sidebar del dashboard:

| Ruta | Label | Ícono |
|---|---|---|
| `/dashboard/chat` | `sidebar.chat` (i18n) | `BotMessageSquare` |

Posición sugerida: entre "News" y "Config".

---

## 12. i18n

Claves nuevas a agregar en `en.json` y `es.json`:

```json
{
  "sidebar": {
    "chat": "AI Agent Chat"
  },
  "chat": {
    "title": "KRYPTO — Trading Agent",
    "newSession": "New Session",
    "noCredentials": "No AI providers configured",
    "noCredentialsDesc": "Configure your API keys in Settings to use the chat",
    "goToSettings": "Go to Settings",
    "deleteSession": "Delete conversation",
    "deleteConfirm": "Are you sure you want to delete this conversation?",
    "inputPlaceholder": "Ask KRYPTO anything...",
    "send": "Send",
    "typing": "KRYPTO is thinking...",
    "openFullscreen": "Open full screen",
    "capabilities": {
      "help": "Explain the platform",
      "trade": "I want to trade now",
      "market": "Market overview"
    },
    "capabilityMessages": {
      "help": "Where should I start to understand the platform?",
      "trade": "I want to create a trading operation. Can you guide me?",
      "market": "Give me a current market analysis with your investment recommendation."
    },
    "sessionGroups": {
      "today": "Today",
      "yesterday": "Yesterday",
      "thisWeek": "This week",
      "older": "Older"
    },
    "errorResponse": "KRYPTO encountered an issue. Please check your API key in Settings.",
    "streamError": "The response was interrupted. You can try again.",
    "stopStream": "Stop generating",
    "welcome": "Hello! I'm KRYPTO, your internal trading agent. I can explain the platform, guide you to create a trade, give you a market analysis, or teach you about blockchain. What would you like to do?",
    "capabilities": {
      "help": "How to use the platform",
      "trade": "I want to trade now",
      "market": "Market overview",
      "blockchain": "Learn blockchain"
    },
    "capabilityMessages": {
      "help": "Where should I start to understand the platform?",
      "trade": "I want to create a trading operation. Can you guide me?",
      "market": "Give me a current market analysis with your investment recommendation.",
      "blockchain": "I want to learn about blockchain. Where do we start?"
    }
  }
}
```

---

## 13. Animaciones (GSAP)

Siguiendo el design system del proyecto:

| Elemento | Animación |
|---|---|
| Widget FAB → apertura del overlay | `gsap.from` con `scale: 0.8, opacity: 0, duration: 0.3, ease: 'back.out(1.7)'` |
| Cada mensaje nuevo (user + assistant) | `gsap.from` con `opacity: 0, y: 10, duration: 0.25, ease: 'power2.out'` |
| Capability buttons en sesión vacía | `gsap.from(.capability-btn, { opacity: 0, y: 20, stagger: 0.08 })` |
| Typing indicator | CSS `@keyframes` bounce en los 3 puntos |
| Lista de sesiones al cargar | `gsap.from(.session-item, { opacity: 0, x: -10, stagger: 0.05 })` |

---

## 14. Seguridad

- Todos los endpoints del `ChatController` están protegidos con `JwtAuthGuard`
- Las API keys de LLM se obtienen de DB encriptadas y se desencriptan en memoria solo para la llamada → nunca se exponen al frontend
- El historial de chat es estrictamente por usuario (`WHERE userId = req.user.id`)
- El contenido de los mensajes no se loggea en archivos de log del servidor (solo metadata)
- No se permite inyección de prompts del usuario en el system prompt: el contexto es siempre construido desde DB por el servidor

---

## 15. Criterios de aceptación

### Backend
- [ ] `GET /chat/llm-options` retorna solo los proveedores con credenciales activas del usuario
- [ ] `POST /chat/sessions` falla con 400 si el usuario no tiene credenciales para el provider elegido
- [ ] `POST /chat/sessions/:id/messages` guarda solo el mensaje del usuario y retorna `{ userMessageId }`
- [ ] `GET /chat/sessions/:id/stream` emite chunks SSE con `{ delta }` y cierra con `{ done: true, messageId }`
- [ ] El stream persiste la respuesta completa en DB al finalizar
- [ ] El system prompt incluye siempre las últimas 10 decisiones del agente, configs activas y posiciones abiertas del usuario
- [ ] `DELETE /chat/sessions/:id` elimina en cascada todos los mensajes
- [ ] El historial de conversación (hasta 30 mensajes anteriores) se envía al LLM para mantener coherencia conversacional
- [ ] Título de la sesión se auto-genera del primer mensaje del usuario
- [ ] Los 3 providers (Claude/OpenAI/Groq) streaman correctamente con `stream: true` en sus respectivas APIs

### Frontend — Widget
- [ ] El FAB es visible en todas las rutas del dashboard
- [ ] El overlay se abre/cierra con animación GSAP
- [ ] El link "Abrir en pantalla completa" navega a `/dashboard/chat` preservando la sesión activa
- [ ] El estado open/closed y activeSessionId persiste al navegar entre páginas (Zustand)
- [ ] El FAB muestra un indicator pulsante mientras hay un stream activo

### Frontend — Página `/dashboard/chat`
- [ ] Sidebar muestra sesiones agrupadas por fecha
- [ ] `LLMSelector` muestra solo proveedores con credenciales configuradas
- [ ] Si no hay credenciales → estado vacío con CTA a Settings
- [ ] Los 4 capability buttons se muestran en grid 2×2 en sesiones sin mensajes
- [ ] Los 4 capability buttons se muestran como chips compactos debajo del input cuando hay mensajes
- [ ] El texto de la respuesta aparece en tiempo real (streaming visible caracter a caracter)
- [ ] Botón "Detener" activo durante el streaming, cancela y guarda lo generado hasta ese momento
- [ ] Markdown se renderiza correctamente en las respuestas (tablas, código, listas)
- [ ] Auto-scroll al último mensaje durante el streaming
- [ ] Error del LLM → texto parcial visible + mensaje de error inline

### UX — Capabilities
- [ ] El chatbot responde en el mismo idioma en que el usuario escribe
- [ ] En modo `market`: la respuesta incluye una decisión concreta (BUY/SELL/HOLD) con justificación técnica referenciando indicadores
- [ ] En modo `trade`: la respuesta incluye instrucciones de navegación específicas (e.g. "Ve a Config → Agregar configuración → selecciona BTC/USDT")
- [ ] En modo `help`: las explicaciones de indicadores son comprensibles para usuarios sin experiencia previa
- [ ] En modo `blockchain`: KRYPTO adapta la profundidad de la explicación según las preguntas del usuario (básico → avanzado progresivamente)
- [ ] En modo `blockchain`: cubre correctamente al menos: wallets, consenso, DeFi/AMM, Layer 2, diferencias CEX/DEX

---

## 16. Orden de implementación

```
FASE 1 — Backend
1. Migración Prisma: enum ChatRole + models ChatSession + ChatMessage + relación User
2. pnpm prisma migrate dev --name add_chat
3. ChatModule: dto + service (request/response normal, sin SSE aún) + controller
4. Registro en AppModule
5. Prueba manual con Swagger: crear sesión → POST message → verificar respuesta y persistencia

FASE 2 — Backend SSE
6. Agregar streaming a los 3 providers (Claude/OpenAI/Groq) con axios responseType:stream
7. Nuevo endpoint GET /stream en controller con @Sse() y Observable<MessageEvent>
8. ChatService.streamMessage(): build context → stream LLM → persist on done
9. Prueba con curl: `curl -N -H 'Authorization: Bearer ...' /api/chat/sessions/:id/stream?content=...`

FASE 3 — Frontend base
10. use-chat.ts: hooks React Query (sesiones + mensajes) + useChatStream (EventSource)
11. chat.store.ts: Zustand store (isOpen, activeSessionId)
12. Instalar dependencias: react-markdown remark-gfm rehype-highlight
13. ChatMessages: renderizado estático con markdown + auto-scroll
14. LLMSelector + CreateSessionModal

FASE 4 — Frontend completo
15. ChatInput con capability chips + botón stop durante stream
16. ChatSessionPanel con agrupación por fecha + delete
17. ChatPage /dashboard/chat: layout sidebar + chat + integración stream en vivo
18. ChatWidget FAB + overlay + animaciones GSAP
19. Registro en sidebar + ruta en app.tsx
20. Traducciones en.json + es.json

FASE 5 — QA
21. Tests E2E: flujo crear sesión → enviar mensaje → verificar stream → verificar persistencia
22. Validación de todos los criterios de aceptación
```

---

## 17. Dependencias de librerías

Verificar que estén instaladas en `apps/web`:

| Librería | Uso | Ya instalada |
|---|---|---|
| `react-markdown` | Renderizar markdown en respuestas | Por verificar |
| `remark-gfm` | GitHub Flavored Markdown (tablas, código) | Por verificar |
| `rehype-highlight` | Syntax highlighting en bloques de código | Por verificar |

Si no están, agregar con:
```bash
pnpm --filter @crypto-trader/web add react-markdown remark-gfm rehype-highlight
```

---

**Siguiente spec:** 18 — Notificaciones push (proactive agent insights vía WebSocket → chatbot)
