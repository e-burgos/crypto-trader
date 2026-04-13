<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

---

## Spec-Driven Development (SDD) — Regla obligatoria

Este proyecto usa un flujo SDD estricto. Antes de implementar cualquier feature:

1. **SIEMPRE invocar el skill `crypto-trader-sdd`** cuando el usuario pide implementar algo, trabajar en un módulo, empezar una feature, o menciona una spec/branch.
2. El skill determina si existe spec + plan, y guía el flujo completo.
3. **Excepción:** el usuario dice explícitamente "quick fix", "hotfix", "cambio rápido" o describe una corrección puntual de una sola línea/archivo → implementar directamente sin flujo SDD.

### Trigger words que activan el flujo SDD
- "implementa", "empecemos con", "trabajemos en", "codea", "crea el módulo"
- "Spec NN", "branch feature/...", "fase A/B/C"
- "empieza la implementación", "vamos con la siguiente feature"

### Documentos clave del proyecto

| Tipo | Ruta |
|------|------|
| **Fuente de verdad del proyecto** | `docs/CONSTITUTION.md` |
| Specs de features | `docs/specs/branches/NN-nombre.md` |
| Planes de implementación | `docs/plans/NN-nombre.md` |
| Branch plan maestro | `docs/plans/crypto-trader-branch-plan.md` |
| Skill SDD | `.github/skills/crypto-trader-sdd/SKILL.md` |

### Dónde y cómo crear nuevas specs y plans

**Numeración:** el siguiente número libre en `docs/specs/branches/`. Revisar qué existe antes de asignar:
```bash
ls docs/specs/branches/ | sort
```

**Spec nueva** → `docs/specs/branches/NN-nombre-kebab-case.md`
- Formato: ver cualquier spec existente como referencia (ej. `28-multi-agent-chat-rag.md`)
- Secciones obligatorias: Resumen ejecutivo, Arquitectura, Modelos de datos, API endpoints, Fases de implementación, Out of scope, Decisiones de diseño

**Plan nuevo** → `docs/plans/NN-nombre-kebab-case.md`
- El nombre debe coincidir exactamente con el de la spec
- Secciones obligatorias: Estado inicial requerido, una sección por Fase (A/B/C...), Criterios de aceptación, Cierre de branch
- Incluir script completo de `gh pr create` al final

**Registrar en el branch plan maestro** → `docs/plans/crypto-trader-branch-plan.md`
- Agregar fila en la tabla con: `| NN | feature/nombre-kebab-case | NN-nombre-kebab-case.md | dep |`
- Actualizar la tabla de estado si corresponde

**Al cerrar cada branch** → actualizar `docs/CONSTITUTION.md` si la feature introdujo cambios en stack, módulos, modelos de datos, convenciones o env vars.
