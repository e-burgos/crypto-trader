# FIX-e-burgos-023 — POST /api/users/me/llm-keys responde 500 con una clave invalida en vez de 4xx

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-023                                   |
| **Tipo**      | BUGFIX                                  |
| **Severidad** | low                                   |
| **Keyword**   | [BUGFIX]                                |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | validated                               |
| **Spec**      | N/A (repo-level)                        |

## Problema

Observado en los setups E2E: '[setup-admin] LLM key update: 500' al enviar una clave no valida. Deberia ser 400/422 con mensaje; no bloquea la suite porque los setups solo lo loguean.

## Justificación del bypass

Bug real destapado al actualizar la suite E2E (FIX-e-burgos-020). Se registra para no perderlo; no
está implementado todavía.

### Archivos a modificar

- `apps/api/src/users/users.controller.ts`
- `apps/api/src/users/users.service.ts`

### Test de validación

- **Referencia:** pendiente, test unitario del componente o servicio afectado al implementar.

### Decisión del Reviewer

> Revisado por sdd-reviewer el **2026-09-03** — evidencia ejecutada, no leída.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia:** `pnpm nx test api --testPathPatterns="users.service|auth.dto"` (2026-09-03): 3 suites / 34 tests passed. Contra producción con sesión TRADER el 2026-09-03: `POST /api/users/me/llm-keys {"provider":"BOGUS"…}` → **400** `provider must be one of the following values: CLAUDE, OPENAI, GROQ, GEMINI, MISTRAL, TOGETHER, OPENROUTER`; `DELETE /api/users/me/llm-keys/MISTRAL` → **404** `No MISTRAL LLM credential configured for this user`. Ya no hay 500.
