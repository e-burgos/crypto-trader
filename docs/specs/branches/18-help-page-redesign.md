# Spec 18 — Help Page Redesign (GitBook-style)

## Objetivo
Rediseñar la página `/help` de una columna centrada a un layout de dos columnas estilo GitBook: sidebar de navegación sticky a la izquierda + área de contenido scrollable a la derecha. Migrar la documentación de las tabs **Guía** y **Conceptos** de `/config` al nuevo grupo **Agent & Configuration** en `/help`. En `/config`, reemplazar esas tabs con un callout que direcciona al usuario a `/help`. Mejor orientación al usuario y estructura escalable para documentación futura.

## Alcance

### Nuevo componente
- `apps/web/src/components/help/help-sidebar.tsx`
  - `HelpSidebar`: sidebar sticky con grupos y links de navegación
  - Grupos: **Getting Started**, **Platform Behavior**, **Agent & Configuration**, **Integrations**
  - Links con ícono, label, estado activo (border-l teal + bg-primary/5)
  - Sub-links indentados (`pl-7`) para sub-secciones
  - Mobile: botón flotante "Contents" (fixed bottom-right) que abre panel `z-50`

### Página modificada — `apps/web/src/pages/help.tsx`
  - Layout: `flex` con sidebar `w-56` + contenido `flex-1 max-w-2xl`
  - `IntersectionObserver` único observando todos los `<section id="...">` con `rootMargin: '-20% 0px -60% 0px'`
  - Scroll imperativo con offset de 80px para compensar navbar
  - Hero section (ícono + título centrado) reemplazado por `h1` simple en el área de contenido
  - Secciones con `id`: `faq`, `guide`, `behaviors`, `agent-flow`, `agent-presets`, `agent-params`, `config-concepts`, `api-keys`, `binance`, `claude`, `openai`, `groq`

### Estructura del sidebar
```
Getting Started
  > FAQ                        (HelpCircle)
  > Paso a Paso                (BookOpen)

Platform Behavior
  > Comportamientos y Avisos   (AlertTriangle)

Agent & Configuration
  > Cómo decide el Agente      (GitFork,   id: agent-flow)
  > Presets de Estrategia      (Sliders,   id: agent-presets)
  > Referencia de Parámetros   (BookOpen,  id: agent-params)
    > Umbrales de Decisión     (indent,    id: config-concepts-thresholds)
    > Stop Loss / Take Profit  (indent,    id: config-concepts-sl)
    > Capital por Trade        (indent,    id: config-concepts-capital)
    > Intervalo de Análisis    (indent,    id: config-concepts-interval)
    > Offset de Precio         (indent,    id: config-concepts-offset)

Integrations
  > API Keys                   (Key)
    > Binance                  (indent)
    > Claude                   (indent)
    > OpenAI                   (indent)
    > Groq                     (indent)
```

### Contenido migrado desde `/config`

El contenido de las dos tabs se traslada tal cual a `/help` como secciones propias. No se reescribe — se reutiliza el JSX y las claves de locale existentes (`config.guide.*`, `config.explain.*`):

| Tab origen (`/config`) | Sección destino (`/help`) | id |
|---|---|---|
| Guía → flujo de decisión | Cómo decide el Agente | `agent-flow` |
| Guía → presets | Presets de Estrategia | `agent-presets` |
| Guía → referencia de parámetros (4 cards) | Referencia de Parámetros | `agent-params` |
| Conceptos → Umbrales | Umbrales de Decisión | `config-concepts-thresholds` |
| Conceptos → Stop Loss / TP | Stop Loss y Take Profit | `config-concepts-sl` |
| Conceptos → Capital | Capital por Trade | `config-concepts-capital` |
| Conceptos → Intervalo | Intervalo de Análisis | `config-concepts-interval` |
| Conceptos → Offset | Offset de Precio de Orden | `config-concepts-offset` |

### Página modificada — `apps/web/src/pages/dashboard/config.tsx`
- Eliminar las tabs **Guía** y **Conceptos** (y sus componentes `GuidePanel`, `ConceptsPanel` / `explain`)
- Eliminar el estado `activeTab` que manejaba `'form' | 'guide' | 'explain'`
- La página queda solo con el formulario de configuración (`'form'`)
- Agregar un callout informativo debajo del título de la página:

```
┌─────────────────────────────────────────────────────┐
│  📖  ¿Querés entender cada parámetro antes de       │
│      configurar? Consultá la documentación →        │
│      [Ver Guía del Agente]  [Ver Conceptos]         │
└─────────────────────────────────────────────────────┘
```

Los botones del callout navegan a `/help#agent-flow` y `/help#config-concepts-thresholds` respectivamente usando `react-router-dom`.

### Locales — sin cambios estructurales
- Las claves `config.guide.*` y `config.explain.*` en `en.ts` / `es.ts` se mantienen (el contenido ahora vive en `/help` pero sigue usando las mismas claves)
- Agregar solo las claves nuevas del callout:
  - `config.docsCallout`: texto del callout
  - `config.docsCalloutGuide`: label del botón "Ver Guía del Agente"
  - `config.docsCalloutConcepts`: label del botón "Ver Conceptos"
  - `help.agentGroup`: label del grupo en sidebar ("Agent & Configuration")
  - `help.agentFlow`, `help.agentPresets`, `help.agentParams`: labels de los links

### Sin cambios
- Routing (`/help` sigue en `PublicLayout`)
- Contenido de las secciones existentes (FAQ, Guide, Behaviors, API Keys)

## Criterios de aceptación
- El sidebar es sticky y permanece visible durante el scroll en desktop
- Al scrollear, el link activo del sidebar se actualiza automáticamente
- Al hacer click en un link, el scroll es suave y la sección queda correctamente posicionada bajo el navbar
- En mobile (`< md`) el sidebar está oculto y el botón "Contents" es funcional
- El grupo **Agent & Configuration** muestra todo el contenido migrado de `/config` correctamente
- `/config` solo muestra el formulario + callout; las tabs Guía y Conceptos ya no existen
- Los botones del callout en `/config` navegan correctamente a las secciones en `/help`
- No hay regresiones visuales en las secciones existentes (FAQ, Paso a Paso, Behaviors, API Keys)
- Branch: `feature/help-page-redesign`

---

**Depende de:** 16-frontend-completion, 17-ai-chatbot
**Siguiente:** Nuevas secciones de documentación (sin spec asignada aún)
