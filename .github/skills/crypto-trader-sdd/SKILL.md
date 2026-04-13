---
name: crypto-trader-sdd
description: "SDD (Spec-Driven Development) flow for the crypto-trader project. INVOKE IMMEDIATELY when the user asks to implement a feature, start a task, work on a module, code something, or any implementation-related work. ALSO INVOKE when user mentions a spec number (e.g. 'Spec 28', 'spec 29'), a branch name, or says 'start implementing'. SKIP if user explicitly says 'quick fix', 'quick change', 'hotfix', 'minor tweak', or describes a change to a single file."
---

# SDD Flow — Crypto Trader

Este proyecto usa **Spec-Driven Development (SDD)**. Antes de escribir una sola línea de código de feature, debes verificar que existe la spec y el plan correspondiente.

---

## Regla de oro

> **Sin spec + plan aprobados → no hay implementación.**
>
> Excepción: el usuario dice explícitamente "quick fix", "hotfix", "cambio rápido" o describe una corrección de una sola línea/archivo.

---

## Decisión de flujo

Cuando el usuario pide implementar algo, evalúa primero:

```
¿El usuario usa palabras como "quick fix", "hotfix", "cambio rápido", "solo modifica X"?
  └─ SÍ → Implementar directamente. No hace falta flujo SDD.
  └─ NO → Seguir el flujo SDD completo (ver abajo).
```

---

## Flujo SDD completo

### Paso 1 — Verificar spec y plan existentes

```bash
# ¿Existe spec?
ls docs/specs/branches/NN-nombre.md

# ¿Existe plan?
ls docs/plans/NN-nombre.md

# ¿Está la branch en el branch plan?
grep "NN" docs/plans/crypto-trader-branch-plan.md
```

**Si spec Y plan existen → ir al Paso 2.**

**Si NO existen:**

Presenta al usuario este menú antes de continuar:

```
Antes de implementar, el flujo SDD de este proyecto requiere:
  1. Una spec (docs/specs/branches/NN-nombre.md)
  2. Un plan de implementación (docs/plans/NN-nombre.md)

Opciones:
  A) Crear spec + plan ahora (recomendado para features nuevas)
  B) Implementar directamente como "quick change" sin spec
  C) Cancelar

¿Qué preferís?
```

No implementar nada hasta recibir respuesta del usuario.

---

### Paso 2 — Leer spec y plan antes de implementar

```bash
cat docs/specs/branches/NN-nombre.md
cat docs/plans/NN-nombre.md
```

Confirmar:
- ¿Qué fase se va a implementar (A, B, C...)?
- ¿Cuáles son los criterios de aceptación de esa fase?
- ¿Cuál es el branch correcto?

---

### Paso 3 — Crear o verificar branch

```bash
# Ver branch actual
git branch --show-current

# Verificar que las dependencias estén mergeadas en main
git log main --oneline -3
```

**Si el branch de la spec NO existe todavía, crearlo automáticamente:**
```bash
# Siempre partir de main actualizado
git checkout main && git pull origin main
git checkout -b feature/nombre-branch
```
> No esperar a que el usuario lo cree. La branch se crea en este paso, antes de tocar código.

**Si el branch ya existe:**
```bash
git checkout feature/nombre-branch
git pull origin feature/nombre-branch  # por si hay commits previos
```

---

### Paso 4 — Implementar

- Seguir **exactamente** el plan de la fase activa
- No implementar más allá de la fase activa sin confirmar con el usuario
- Commits descriptivos: `feat(módulo): descripción — Spec NN`

---

### Paso 5 — Verificación antes de cerrar

```bash
pnpm nx build api        # si hay cambios backend
pnpm nx build web        # si hay cambios frontend
pnpm nx test api         # si hay cambios backend
pnpm nx test web         # si hay cambios frontend
```

**No crear PR con build rojo o tests fallando.**

---

### Paso 6 — Cierre de branch

Seguir el script de cierre definido en `docs/plans/NN-nombre.md` (sección "Cierre de branch"):
1. `git push origin feature/nombre`
2. `gh pr create ...` con el cuerpo del plan
3. Actualizar `docs/plans/crypto-trader-branch-plan.md`

### Paso 7 — Actualizar la Constitución del proyecto

> `docs/CONSTITUTION.md` es la **fuente de verdad** del proyecto. Toda feature mergeada que cambie arquitectura, modelos de datos, módulos, stack o convenciones **debe reflejarse aquí**.

Después de mergear el PR, revisar si la feature cambia alguna de estas secciones:

| Sección Constitución | Actualizar si... |
|---------------------|------------------|
| `## 3. Stack Tecnológico` | Se agrega una librería nueva o se cambia una existente |
| `## 4. Arquitectura del Backend` | Nuevo módulo NestJS, servicio o integración backend |
| `## 5. Arquitectura del Frontend` | Nueva página, componente raíz o cambio en el routing |
| `## 6. Modelos de Datos` | Nuevos modelos Prisma o cambios en modelos existentes |
| `## 7. Convenciones de Código` | Se establece un nuevo patrón o convención |
| `## 9. Variables de Entorno` | Nuevas env vars requeridas |
| `## 11. Decisiones Arquitecturales` | Decisión técnica importante tomada en la spec |

**Cómo actualizar:**
```bash
# Leer la sección relevante primero
cat docs/CONSTITUTION.md

# Editar solo las secciones afectadas — no reescribir secciones no tocadas
# Mantener el formato de tabla y los ejemplos de código existentes
```

> Si la spec tiene una sección "Decisiones de diseño", las decisiones más importantes deben migrar a `## 11` de la Constitución.

---

## Dónde viven los documentos

| Tipo | Ruta |
|------|------|
| **Fuente de verdad del proyecto** | `docs/CONSTITUTION.md` |
| Specs de features | `docs/specs/branches/NN-nombre.md` |
| Planes de implementación | `docs/plans/NN-nombre.md` |
| Branch plan maestro | `docs/plans/crypto-trader-branch-plan.md` |
| Prompt del orquestador SDD | `.vscode/prompts/sdd-orchestrator.prompt.md` |

## Cómo crear nuevas specs y plans

### 1. Determinar el número siguiente

```bash
ls docs/specs/branches/ | sort
# El siguiente NN libre es el máximo actual + 1
```

### 2. Crear la spec

**Ruta:** `docs/specs/branches/NN-nombre-kebab-case.md`

Frontmatter obligatorio:
```markdown
# Spec NN — Título descriptivo

**Fecha:** YYYY-MM-DD
**Versión:** 1.0
**Estado:** Propuesto
**Branch:** `feature/nombre-kebab-case`
**Dependencias:** Spec XX (nombre)
```

Secciones obligatorias (en este orden):
1. Resumen ejecutivo
2. Arquitectura / diseño
3. Modelos de datos (Prisma schema si aplica)
4. API endpoints (si aplica)
5. Componentes frontend (si aplica)
6. Fases de implementación (Fase A, B, C...)
7. Out of scope
8. Decisiones de diseño (tabla `| # | Decisión | Alternativa | Razón |`)

### 3. Crear el plan

**Ruta:** `docs/plans/NN-nombre-kebab-case.md`  
**Nombre:** debe coincidir exactamente con el de la spec.

Secciones obligatorias:
```markdown
# Plan NN — Título

**Spec:** docs/specs/branches/NN-nombre.md
**Branch:** feature/nombre
**Depende de:** Spec XX mergeada en main

## Estado inicial requerido   ← comandos bash para verificar precondiciones
## Fase A — Nombre           ← una sección por fase de la spec
## Fase B — Nombre
## Criterios de aceptación   ← lista de checkboxes [ ]
## Cierre de branch           ← script completo git push + gh pr create
```

### 4. Registrar en el branch plan maestro

**Ruta:** `docs/plans/crypto-trader-branch-plan.md`

Agregar fila en la tabla:
```markdown
| NN  | feature/nombre-kebab-case | NN-nombre-kebab-case.md | XX (dep) |
```

Si ya existe la tabla de estado en `.vscode/prompts/sdd-orchestrator.prompt.md`, agregarla también ahí.

---

## Cuándo NO aplicar este skill

- "Corrige el typo en este archivo"
- "Cambia el color de este botón"
- "Arregla este error de TypeScript"
- "Quick fix para el build roto"
- Cualquier cambio que el usuario describa como **puntual, urgente o de una sola línea**

En esos casos: implementar directamente sin flujo SDD.
