# Spec 23 — Settings Page (Gestión de API Keys y Perfil)

**Fecha:** 2026-04-12
**Versión:** 1.0
**Estado:** Implementado (retrospec)
**Branch:** `feature/settings-page`
**Dependencias:** Spec 16 (frontend-completion), Spec 20 (testnet)

---

## 1. Resumen ejecutivo

La página `settings.tsx` concentra toda la gestión de credenciales y perfil del usuario en una única sección del dashboard (`/dashboard/settings`). Es **distinta** de `config.tsx` (que gestiona la configuración del agente de trading).

El spec original mencionaba settings como parte de Spec 10 pero sin detalle. La implementación incluye cuatro secciones independientes:

1. **Binance API Keys** — producción (LIVE)
2. **Binance API Keys** — testnet
3. **LLM Provider Keys** — uno o más proveedores (Claude, OpenAI, Groq)
4. **News API Keys** — fuentes opcionales de pago (NewsData.io)
5. **Perfil de usuario** — actualización de email/contraseña

---

## 2. Estructura de la página

### 2.1 Layout

La página usa un layout de tabs o secciones expandibles con scroll. El parámetro de URL `?tab=binance|llm|news|profile` permite navegar directamente a una sección específica (usado desde notificaciones y onboarding).

```
/dashboard/settings
  ├── Tab: Binance Keys (producción)
  ├── Tab: Binance Keys (testnet)
  ├── Tab: LLM Providers
  ├── Tab: News APIs
  └── Tab: Perfil
```

### 2.2 Navegación desde otras páginas

- Notificación `agentNoLLM` → `/dashboard/settings?tab=llm`
- Notificación `agentNoTestnetKeys` → `/dashboard/settings?tab=testnet`
- Onboarding Step 1 (si el usuario quiere ir al settings completo)
- Config page: warning TESTNET → `Link` a `/dashboard/settings?tab=testnet`

---

## 3. Sección: Binance API Keys (Producción)

### 3.1 Estado de la sección

- Llama a `useBinanceKeyStatus()` → `GET /users/me/binance-keys/status`
- Devuelve `{ hasKeys: boolean; isActive: boolean }`
- Si `hasKeys = true`: muestra badge verde "Conectado" + botón "Eliminar"
- Si `hasKeys = false`: muestra formulario de alta

### 3.2 Formulario de alta

Campos:
- `apiKey` — input de texto (obfuscado por seguridad)
- `apiSecret` — `PasswordInput` con toggle show/hide

Al guardar:
- `useSetBinanceKeys()` → `POST /users/me/binance-keys`
- Validación previa: ambos campos no vacíos, sin espacios
- Toast de éxito/error

### 3.3 Test de conexión

Botón "Verificar conexión":
- `useTestBinanceConnection()` → `GET /users/me/binance-keys/test`
- Muestra: CheckCircle (verde) si OK | XCircle (rojo) + mensaje si falla
- Resultado se muestra inline debajo del formulario

### 3.4 Eliminar keys

- `useDeleteBinanceKeys()` → `DELETE /users/me/binance-keys`
- Requiere confirmación (dialog/modal antes de ejecutar)
- Si hay agentes LIVE activos: warning que serán detenidos

---

## 4. Sección: Binance API Keys (Testnet)

Idéntica a la sección de producción pero usando endpoints de testnet:

| Hook | Endpoint |
|------|----------|
| `useTestnetBinanceKeyStatus()` | `GET /users/me/binance-keys/testnet/status` |
| `useSetTestnetBinanceKeys()` | `POST /users/me/binance-keys/testnet` |
| `useDeleteTestnetBinanceKeys()` | `DELETE /users/me/binance-keys/testnet` |
| `useTestTestnetBinanceConnection()` | `GET /users/me/binance-keys/testnet/test` |

Diferencias visuales:
- Badge naranja "Testnet" en el header de la sección
- Instrucciones específicas: `testnet.binance.vision` para crear las keys
- Advertencia: "Las claves testnet solo funcionan con modo TESTNET"

---

## 5. Sección: LLM Provider Keys

### 5.1 Providers soportados

| Provider | Label | Modelos disponibles |
|----------|-------|---------------------|
| `CLAUDE` | Anthropic Claude | claude-opus-4-5, claude-3-5-sonnet-20241022, claude-3-haiku-20240307 |
| `OPENAI` | OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo |
| `GROQ` | Groq | llama-3.3-70b-versatile, mixtral-8x7b-32768 |

### 5.2 Lista de keys configuradas

- Llama a `useLLMKeys()` → `GET /users/me/llm-keys/status`
- Lista las keys activas: provider, modelo seleccionado, badge "Activo"
- Para cada key: botón de test, botón de eliminar

### 5.3 Formulario de alta

Por cada provider no configurado:
- Select de modelo
- `PasswordInput` para la API key
- Botón "Guardar"
- `useSetLLMKey()` → `POST /users/me/llm-keys`

### 5.4 Body del endpoint

```typescript
POST /users/me/llm-keys
{
  provider: 'CLAUDE' | 'OPENAI' | 'GROQ',
  apiKey: string,
  selectedModel: string
}
```

### 5.5 Test de LLM

- `useTestLLMKey(provider)` → `GET /users/me/llm-keys/:provider/test`
- Realiza una llamada mínima a la API del provider
- Retorna: OK | error + mensaje

---

## 6. Sección: News API Keys

### 6.1 Fuentes gratuitas (informativo)

Lista read-only de las fuentes gratuitas disponibles con su estado de conectividad:
- Llama a `useNewsSourcesStatus()` → `GET /market/news-sources/status`
- Muestra cada fuente: icono de estado (OK/error), nombre, descripción, badge "Sin API key"

### 6.2 Fuentes opcionales (pago)

Para cada provider de pago (NewsData.io):
- Si no tiene key: formulario con campo `apiKey`, enlace a la página de registro del provider
- Si tiene key: badge "Activo" + botón de test + botón eliminar
- `useSetNewsApiKey()` → `POST /users/me/news-api-keys`
- `useDeleteNewsApiKey(provider)` → `DELETE /users/me/news-api-keys/:provider`
- `useTestNewsApiKey(provider)` → `GET /users/me/news-api-keys/:provider/test`

---

## 7. Sección: Perfil

### 7.1 Datos del perfil

- Llama a `useUserProfile()` → `GET /users/me`
- Muestra: email, rol, fecha de creación del cuenta

### 7.2 Actualización de email

- Campo email editable
- `useUpdateProfile()` → `PUT /users/me` con `{ email: string }`

### 7.3 Cambio de contraseña

- Campos: contraseña actual, nueva contraseña, confirmar nueva
- Validación: nueva y confirmación deben coincidir, mínimo 8 caracteres
- Endpoint: `PUT /users/me/password` con `{ currentPassword, newPassword }`

---

## 8. Hooks requeridos

### `use-user.ts` — hooks añadidos o modificados

```typescript
// Binance keys producción (existentes)
useBinanceKeyStatus()
useSetBinanceKeys()
useDeleteBinanceKeys()
useTestBinanceConnection()

// Binance keys testnet (añadidos en spec 20)
useTestnetBinanceKeyStatus()
useSetTestnetBinanceKeys()
useDeleteTestnetBinanceKeys()
useTestTestnetBinanceConnection()

// LLM keys
useLLMKeys()
useSetLLMKey()
useDeleteLLMKey()
useTestLLMKey(provider: string)

// Profile
useUserProfile()
useUpdateProfile()

// News API keys
useNewsSourcesStatus()
useNewsApiKeys()
useSetNewsApiKey()
useDeleteNewsApiKey()
useTestNewsApiKey()
```

---

## 9. Endpoints backend requeridos

Todos en `UsersController` (`apps/api/src/users/users.controller.ts`):

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/users/me` | Perfil del usuario |
| `PUT` | `/users/me` | Actualizar email |
| `PUT` | `/users/me/password` | Cambiar contraseña |
| `GET` | `/users/me/binance-keys/status` | Estado keys producción |
| `POST` | `/users/me/binance-keys` | Guardar keys producción |
| `DELETE` | `/users/me/binance-keys` | Eliminar keys producción |
| `GET` | `/users/me/binance-keys/test` | Verificar conexión producción |
| `GET` | `/users/me/binance-keys/testnet/status` | Estado keys testnet |
| `POST` | `/users/me/binance-keys/testnet` | Guardar keys testnet |
| `DELETE` | `/users/me/binance-keys/testnet` | Eliminar keys testnet |
| `GET` | `/users/me/binance-keys/testnet/test` | Verificar conexión testnet |
| `GET` | `/users/me/llm-keys/status` | Lista de keys LLM activas |
| `POST` | `/users/me/llm-keys` | Guardar key LLM |
| `DELETE` | `/users/me/llm-keys/:provider` | Eliminar key LLM |
| `GET` | `/users/me/llm-keys/:provider/test` | Verificar key LLM |
| `GET` | `/users/me/news-api-keys` | Lista de keys de noticias |
| `POST` | `/users/me/news-api-keys` | Guardar key de noticias |
| `DELETE` | `/users/me/news-api-keys/:provider` | Eliminar key de noticias |
| `GET` | `/users/me/news-api-keys/:provider/test` | Verificar key de noticias |

---

## 10. Criterios de aceptación

- [ ] El usuario puede guardar y eliminar Binance keys de producción y testnet
- [ ] El test de conexión de Binance producción y testnet muestra resultado inline
- [ ] El usuario puede configurar hasta 3 providers LLM simultáneamente
- [ ] El test de LLM realiza una llamada real a la API del provider
- [ ] El usuario puede agregar y eliminar keys de NewsData.io
- [ ] La sección de fuentes gratuitas muestra el estado de conectividad en tiempo real
- [ ] El perfil se puede actualizar (email)
- [ ] El cambio de contraseña valida la contraseña actual antes de cambiar
- [ ] La navegación por `?tab=` funciona correctamente desde cualquier parte del dashboard
- [ ] Las keys nunca se muestran en texto plano después de guardadas (solo el estado "Configurado")

---

**Depende de:** Spec 02 (users module), Spec 20 (testnet), Spec 21 (market/news)
**Consumidores:** Onboarding wizard, Notifications, Config page
